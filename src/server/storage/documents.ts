import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { SCAN_TAG_KEY } from '@/server/security/scan-verdict'
import { scanConfigOrNull, type ScanConfig } from '@/server/security/scan-config'
import { s3ClientConfig } from './s3-config'

/**
 * Every S3 call the document pipeline makes, in one place.
 *
 *   upload     -> putQuarantine: the only way bytes enter storage. Lands in the isolated quarantine bucket,
 *                 encrypted with the customer-managed key, with a SHA-256 S3 checks on receipt. Returns the
 *                 exact version it created.
 *   verdict    -> inspectQuarantine / promote: read the scan tag of one version, then copy THAT version (never
 *                 "the latest") to the clean documents bucket, refusing if its ETag changed, and prove the copy
 *                 carries the checksum recorded at upload.
 *   download   -> readClean: only from the clean bucket, only a recorded version.
 *
 * Nothing here decides whether a document is clean. That is the verdict worker's job (scan-processor.ts); this
 * file only does what it is told with the exact object references it is given.
 */

export type S3Like = { send(command: unknown): Promise<unknown> }
export type ObjectRef = { bucket: string; key: string; versionId: string }
export type QuarantineUpload = ObjectRef & { etag: string }
export type StoredObject = { key: string; lastModified: Date; size: number }

export type StorageErrorKind = 'not-found' | 'denied' | 'mismatch' | 'transient'
export class StorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

type AwsLikeError = { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }

function classify(error: unknown): StorageErrorKind {
  if (error instanceof StorageError) return error.kind
  const e = (error ?? {}) as AwsLikeError
  const status = e.$metadata?.httpStatusCode
  const name = e.name ?? e.Code ?? ''
  if (status === 404 || /^(NoSuchKey|NoSuchVersion|NotFound|NoSuchBucket)$/.test(name)) return 'not-found'
  if (status === 403 || /^(AccessDenied|Forbidden)$/.test(name)) return 'denied'
  if (status === 412 || /^(PreconditionFailed|BadDigest|InvalidDigest|XAmzContentSHA256Mismatch)$/.test(name)) return 'mismatch'
  return 'transient'
}

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError(classify(error), `${what}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const hexToBase64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64')
export const base64ToHex = (b64: string) => Buffer.from(b64, 'base64').toString('hex')
const unquote = (etag: string) => etag.trim().replace(/^"(.*)"$/, '$1')
const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/')

export type DocumentStorage = ReturnType<typeof createDocumentStorage>

export function createDocumentStorage(config: ScanConfig, client: S3Like) {
  const sse = { ServerSideEncryption: 'aws:kms' as const, SSEKMSKeyId: config.kmsKeyArn, BucketKeyEnabled: true }

  return {
    config,

    /** Writes an upload to quarantine. Fails if the bucket does not report a version id: an unversioned bucket cannot bind a verdict. */
    putQuarantine(input: { key: string; body: Buffer; contentType: string; sha256Hex: string }): Promise<QuarantineUpload> {
      return guarded('put to quarantine', async () => {
        const out = (await client.send(
          new PutObjectCommand({
            Bucket: config.quarantineBucket,
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType,
            ChecksumSHA256: hexToBase64(input.sha256Hex),
            ...sse,
          }),
        )) as { VersionId?: string; ETag?: string }
        if (!out.VersionId) throw new StorageError('mismatch', 'the quarantine bucket returned no version id (it must be versioned)')
        if (!out.ETag) throw new StorageError('mismatch', 'the quarantine bucket returned no ETag')
        return { bucket: config.quarantineBucket, key: input.key, versionId: out.VersionId, etag: unquote(out.ETag) }
      })
    },

    /**
     * What S3 says about one quarantine version: its scan tag first (reading tags is not blocked by the bucket policy
     * that hides unscanned content), and only for a clean tag the object's size, ETag and checksum.
     */
    inspectQuarantine(ref: ObjectRef): Promise<{ scanTag: string | null; size?: number; etag?: string; checksumSha256Hex?: string }> {
      return guarded('inspect quarantine object', async () => {
        const tagging = (await client.send(
          new GetObjectTaggingCommand({ Bucket: ref.bucket, Key: ref.key, VersionId: ref.versionId }),
        )) as { TagSet?: { Key?: string; Value?: string }[] }
        const scanTag = tagging.TagSet?.find((tag) => tag.Key === SCAN_TAG_KEY)?.Value ?? null
        if (scanTag !== 'NO_THREATS_FOUND') return { scanTag }
        const head = (await client.send(
          new HeadObjectCommand({ Bucket: ref.bucket, Key: ref.key, VersionId: ref.versionId, ChecksumMode: 'ENABLED' }),
        )) as { ContentLength?: number; ETag?: string; ChecksumSHA256?: string }
        return {
          scanTag,
          size: head.ContentLength,
          etag: head.ETag ? unquote(head.ETag) : undefined,
          checksumSha256Hex: head.ChecksumSHA256 ? base64ToHex(head.ChecksumSHA256) : undefined,
        }
      })
    },

    /**
     * Copies exactly one quarantine version into clean storage and proves the copy: the source ETag must still match,
     * the bucket must return a new version id, and the copy's SHA-256 must equal the one recorded at upload.
     */
    promote(input: { source: QuarantineUpload; cleanKey: string; contentType: string; sha256Hex: string }): Promise<{ cleanVersionId: string }> {
      return guarded('promote to clean storage', async () => {
        const out = (await client.send(
          new CopyObjectCommand({
            Bucket: config.documentsBucket,
            Key: input.cleanKey,
            CopySource: `${input.source.bucket}/${encodeKey(input.source.key)}?versionId=${encodeURIComponent(input.source.versionId)}`,
            CopySourceIfMatch: `"${input.source.etag}"`,
            MetadataDirective: 'REPLACE',
            ContentType: input.contentType,
            ChecksumAlgorithm: 'SHA256',
            ...sse,
          }),
        )) as { VersionId?: string; CopyObjectResult?: { ChecksumSHA256?: string } }
        const versionId = out.VersionId
        const copied = out.CopyObjectResult?.ChecksumSHA256
        const undo = async () => {
          await client.send(new DeleteObjectCommand({ Bucket: config.documentsBucket, Key: input.cleanKey })).catch(() => undefined)
        }
        if (!versionId) {
          await undo()
          throw new StorageError('mismatch', 'the documents bucket returned no version id (it must be versioned)')
        }
        if (!copied || base64ToHex(copied) !== input.sha256Hex) {
          await undo()
          throw new StorageError('mismatch', 'the clean copy does not carry the checksum recorded at upload')
        }
        return { cleanVersionId: versionId }
      })
    },

    /** Permanently removes one quarantine version. Quarantine is a holding area; nothing is kept here by policy. */
    deleteQuarantineVersion(ref: ObjectRef): Promise<void> {
      return guarded('delete quarantine version', async () => {
        await client.send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.key, VersionId: ref.versionId }))
      })
    },

    /** Removes the current clean object by writing a delete marker; earlier versions age out under the bucket's lifecycle rules. */
    deleteClean(key: string): Promise<void> {
      return guarded('delete clean object', async () => {
        await client.send(new DeleteObjectCommand({ Bucket: config.documentsBucket, Key: key }))
      })
    },

    /** The bytes of one recorded clean version. */
    readClean(key: string, versionId: string): Promise<Buffer> {
      return guarded('read clean object', async () => {
        const out = (await client.send(
          new GetObjectCommand({ Bucket: config.documentsBucket, Key: key, VersionId: versionId }),
        )) as { Body?: { transformToByteArray(): Promise<Uint8Array> } }
        const bytes = await out.Body?.transformToByteArray()
        if (!bytes) throw new StorageError('not-found', 'empty response reading a clean object')
        return Buffer.from(bytes)
      })
    },

    /** Every current object in the clean bucket under a prefix, for reconciliation. */
    listClean(prefix = ''): Promise<StoredObject[]> {
      return guarded('list clean objects', async () => {
        const found: StoredObject[] = []
        let token: string | undefined
        do {
          const page = (await client.send(
            new ListObjectsV2Command({ Bucket: config.documentsBucket, Prefix: prefix || undefined, ContinuationToken: token }),
          )) as { Contents?: { Key?: string; LastModified?: Date; Size?: number }[]; IsTruncated?: boolean; NextContinuationToken?: string }
          for (const item of page.Contents ?? []) {
            if (item.Key && item.LastModified) found.push({ key: item.Key, lastModified: item.LastModified, size: item.Size ?? 0 })
          }
          token = page.IsTruncated ? page.NextContinuationToken : undefined
        } while (token)
        return found
      })
    },
  }
}

let cached: { signature: string; storage: DocumentStorage } | undefined

/** The pipeline's storage for this process, or null when screening is not configured (uploads are then refused). */
export function documentStorage(): DocumentStorage | null {
  const config = scanConfigOrNull()
  if (!config) return null
  const signature = JSON.stringify([config, process.env.S3_ENDPOINT, process.env.S3_ACCESS_KEY_ID])
  if (cached?.signature !== signature) {
    cached = { signature, storage: createDocumentStorage(config, new S3Client(s3ClientConfig(process.env))) }
  }
  return cached.storage
}
