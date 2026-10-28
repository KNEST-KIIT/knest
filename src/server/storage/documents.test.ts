import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { ScanConfig } from '@/server/security/scan-config'
import { base64ToHex, createDocumentStorage, hexToBase64, StorageError } from './documents'

const config: ScanConfig = {
  region: 'ap-south-1',
  quarantineBucket: 'knest-quarantine',
  documentsBucket: 'knest-documents',
  kmsKeyArn: 'arn:aws:kms:ap-south-1:123456789012:key/11111111-2222-3333-4444-555555555555',
  queueUrl: 'https://sqs.ap-south-1.amazonaws.com/123456789012/q',
  verdictDeadlineMinutes: 30,
  pollWaitSeconds: 20,
}
const BYTES = Buffer.from('%PDF-1.4 test')
const SHA_HEX = createHash('sha256').update(BYTES).digest('hex')
const KEY = '2026-10-27/0123456789abcdef0123456789abcdef.pdf'

type Sent = { name: string; input: Record<string, unknown> }
function fake(respond: (sent: Sent, calls: Sent[]) => unknown) {
  const calls: Sent[] = []
  return {
    calls,
    client: {
      send: async (command: unknown) => {
        const c = command as { constructor: { name: string }; input: Record<string, unknown> }
        const sent = { name: c.constructor.name, input: c.input }
        calls.push(sent)
        return respond(sent, calls)
      },
    },
  }
}
const awsError = (status: number, name: string) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } })

describe('writing an upload to quarantine', () => {
  it('encrypts with the customer-managed key, sends a checksum S3 verifies, and returns the exact version', async () => {
    const f = fake(() => ({ VersionId: 'ver-9', ETag: '"abc123"' }))
    const out = await createDocumentStorage(config, f.client).putQuarantine({ key: KEY, body: BYTES, contentType: 'application/pdf', sha256Hex: SHA_HEX })
    expect(out).toEqual({ bucket: 'knest-quarantine', key: KEY, versionId: 'ver-9', etag: 'abc123' })
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0]!.name).toBe('PutObjectCommand')
    expect(f.calls[0]!.input).toMatchObject({
      Bucket: 'knest-quarantine',
      Key: KEY,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: config.kmsKeyArn,
      BucketKeyEnabled: true,
      ChecksumSHA256: createHash('sha256').update(BYTES).digest('base64'),
    })
  })

  it('never writes to the clean bucket', async () => {
    const f = fake(() => ({ VersionId: 'v', ETag: '"e"' }))
    await createDocumentStorage(config, f.client).putQuarantine({ key: KEY, body: BYTES, contentType: 'application/pdf', sha256Hex: SHA_HEX })
    expect(f.calls.every((c) => c.input.Bucket === 'knest-quarantine')).toBe(true)
  })

  it('refuses a bucket that does not report a version id or an ETag: a verdict could not be bound', async () => {
    for (const reply of [{ ETag: '"e"' }, { VersionId: 'v' }]) {
      const f = fake(() => reply)
      await expect(createDocumentStorage(config, f.client).putQuarantine({ key: KEY, body: BYTES, contentType: 'application/pdf', sha256Hex: SHA_HEX })).rejects.toMatchObject({ kind: 'mismatch' })
    }
  })
})

describe('reading what S3 says about a quarantine version', () => {
  const ref = { bucket: 'knest-quarantine', key: KEY, versionId: 'ver-9' }

  it('reads the scan tag of that version first and stops there unless it is clean', async () => {
    for (const tag of [undefined, 'THREATS_FOUND', 'UNSUPPORTED', 'FAILED']) {
      const f = fake(() => ({ TagSet: tag ? [{ Key: 'GuardDutyMalwareScanStatus', Value: tag }] : [] }))
      const out = await createDocumentStorage(config, f.client).inspectQuarantine(ref)
      expect(out).toEqual({ scanTag: tag ?? null })
      expect(f.calls.map((c) => c.name)).toEqual(['GetObjectTaggingCommand'])
      expect(f.calls[0]!.input).toMatchObject({ Bucket: 'knest-quarantine', Key: KEY, VersionId: 'ver-9' })
    }
  })

  it('for a clean tag also returns that version’s size, ETag and checksum', async () => {
    const f = fake((sent) =>
      sent.name === 'GetObjectTaggingCommand'
        ? { TagSet: [{ Key: 'other', Value: 'x' }, { Key: 'GuardDutyMalwareScanStatus', Value: 'NO_THREATS_FOUND' }] }
        : { ContentLength: BYTES.length, ETag: '"abc123"', ChecksumSHA256: hexToBase64(SHA_HEX) },
    )
    const out = await createDocumentStorage(config, f.client).inspectQuarantine(ref)
    expect(out).toEqual({ scanTag: 'NO_THREATS_FOUND', size: BYTES.length, etag: 'abc123', checksumSha256Hex: SHA_HEX })
    expect(f.calls[1]!.name).toBe('HeadObjectCommand')
    expect(f.calls[1]!.input).toMatchObject({ VersionId: 'ver-9', ChecksumMode: 'ENABLED' })
  })
})

describe('promoting one version to clean storage', () => {
  const source = { bucket: 'knest-quarantine', key: KEY, versionId: 'ver/9+x=', etag: 'abc123' }
  const input = { source, cleanKey: KEY, contentType: 'application/pdf', sha256Hex: SHA_HEX }

  it('copies exactly that version, only if its ETag still matches, into the separate bucket, encrypted, with a checksum', async () => {
    const f = fake(() => ({ VersionId: 'clean-1', CopyObjectResult: { ChecksumSHA256: hexToBase64(SHA_HEX) } }))
    const out = await createDocumentStorage(config, f.client).promote(input)
    expect(out).toEqual({ cleanVersionId: 'clean-1' })
    expect(f.calls[0]!.name).toBe('CopyObjectCommand')
    expect(f.calls[0]!.input).toMatchObject({
      Bucket: 'knest-documents',
      Key: KEY,
      CopySource: `knest-quarantine/2026-10-27/0123456789abcdef0123456789abcdef.pdf?versionId=${encodeURIComponent('ver/9+x=')}`,
      CopySourceIfMatch: '"abc123"',
      MetadataDirective: 'REPLACE',
      ContentType: 'application/pdf',
      ChecksumAlgorithm: 'SHA256',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: config.kmsKeyArn,
      BucketKeyEnabled: true,
    })
  })

  it('refuses a copy whose checksum differs from the upload, and withdraws it', async () => {
    const f = fake((sent) => (sent.name === 'CopyObjectCommand' ? { VersionId: 'clean-1', CopyObjectResult: { ChecksumSHA256: hexToBase64('0'.repeat(64)) } } : {}))
    await expect(createDocumentStorage(config, f.client).promote(input)).rejects.toMatchObject({ kind: 'mismatch' })
    expect(f.calls.map((c) => c.name)).toEqual(['CopyObjectCommand', 'DeleteObjectCommand'])
    expect(f.calls[1]!.input).toMatchObject({ Bucket: 'knest-documents', Key: KEY })
    expect(f.calls[1]!.input.VersionId).toBeUndefined()
  })

  it('refuses a copy that carries no checksum, or no version id', async () => {
    for (const reply of [{ VersionId: 'clean-1', CopyObjectResult: {} }, { CopyObjectResult: { ChecksumSHA256: hexToBase64(SHA_HEX) } }]) {
      const f = fake((sent) => (sent.name === 'CopyObjectCommand' ? reply : {}))
      await expect(createDocumentStorage(config, f.client).promote(input)).rejects.toMatchObject({ kind: 'mismatch' })
      expect(f.calls.map((c) => c.name)).toEqual(['CopyObjectCommand', 'DeleteObjectCommand'])
    }
  })

  it('reports a failed ETag precondition as a mismatch, not as a retryable error', async () => {
    const f = fake(() => {
      throw awsError(412, 'PreconditionFailed')
    })
    await expect(createDocumentStorage(config, f.client).promote(input)).rejects.toMatchObject({ kind: 'mismatch' })
  })
})

describe('deleting and reading', () => {
  it('deletes a quarantine version permanently and a clean object by marker', async () => {
    const f = fake(() => ({}))
    const storage = createDocumentStorage(config, f.client)
    await storage.deleteQuarantineVersion({ bucket: 'knest-quarantine', key: KEY, versionId: 'ver-9' })
    await storage.deleteClean(KEY)
    expect(f.calls[0]!.input).toMatchObject({ Bucket: 'knest-quarantine', Key: KEY, VersionId: 'ver-9' })
    expect(f.calls[1]!.input).toEqual({ Bucket: 'knest-documents', Key: KEY })
  })

  it('reads only a named version from the clean bucket', async () => {
    const f = fake(() => ({ Body: { transformToByteArray: async () => new Uint8Array(BYTES) } }))
    const out = await createDocumentStorage(config, f.client).readClean(KEY, 'clean-1')
    expect(out.equals(BYTES)).toBe(true)
    expect(f.calls[0]!.input).toEqual({ Bucket: 'knest-documents', Key: KEY, VersionId: 'clean-1' })
  })

  it('lists the clean bucket across pages', async () => {
    const pages = [
      { Contents: [{ Key: 'a', LastModified: new Date(1), Size: 1 }], IsTruncated: true, NextContinuationToken: 't1' },
      { Contents: [{ Key: 'b', LastModified: new Date(2), Size: 2 }, { Key: 'no-date' }], IsTruncated: false },
    ]
    const f = fake((_s, calls) => pages[calls.length - 1])
    const out = await createDocumentStorage(config, f.client).listClean('2026-')
    expect(out.map((o) => o.key)).toEqual(['a', 'b'])
    expect(f.calls[0]!.input).toMatchObject({ Bucket: 'knest-documents', Prefix: '2026-' })
    expect(f.calls[1]!.input.ContinuationToken).toBe('t1')
  })
})

describe('error classification', () => {
  it.each([
    [404, 'NoSuchKey', 'not-found'],
    [404, 'NoSuchVersion', 'not-found'],
    [403, 'AccessDenied', 'denied'],
    [403, 'Forbidden', 'denied'],
    [412, 'PreconditionFailed', 'mismatch'],
    [400, 'BadDigest', 'mismatch'],
    [500, 'InternalError', 'transient'],
    [503, 'SlowDown', 'transient'],
  ])('%i %s is %s', async (status, name, kind) => {
    const f = fake(() => {
      throw awsError(status, name)
    })
    const error = await createDocumentStorage(config, f.client).readClean(KEY, 'v').catch((e) => e)
    expect(error).toBeInstanceOf(StorageError)
    expect(error.kind).toBe(kind)
  })

  it('treats a network failure as transient', async () => {
    const f = fake(() => {
      throw new Error('socket hang up')
    })
    const error = await createDocumentStorage(config, f.client).readClean(KEY, 'v').catch((e) => e)
    expect(error.kind).toBe('transient')
  })
})

describe('checksum encodings', () => {
  it('round-trips hex and base64 SHA-256', () => {
    expect(base64ToHex(hexToBase64(SHA_HEX))).toBe(SHA_HEX)
    expect(hexToBase64(SHA_HEX)).toBe(createHash('sha256').update(BYTES).digest('base64'))
  })
})
