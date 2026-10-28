import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

/**
 * A small S3-compatible server for tests (path-style, no authentication). It does NOT validate credentials, so it
 * proves that the application's real S3 client code path stores, versions, tags, copies and reads bytes the way S3
 * does; it cannot prove AWS accepts the credentials, the bucket policy or the KMS key.
 *
 * What it models, because the document pipeline depends on it:
 *  - versioning: every PUT and COPY returns a new x-amz-version-id; GET, HEAD and DELETE accept ?versionId=; a DELETE
 *    without a version writes a delete marker; deleting the newest version exposes the previous one again.
 *  - checksums: x-amz-checksum-sha256 on PUT is verified (400 BadDigest on mismatch) and echoed by HEAD and COPY.
 *  - tagging: GET ?tagging[&versionId=] reads the tags of one version; tagVersion() writes them (the GuardDuty stand-in).
 *  - CopyObject: x-amz-copy-source with ?versionId=, x-amz-copy-source-if-match (412 on mismatch), new version id back.
 *  - the quarantine bucket policy: in a bucket registered with denyReadUnlessClean(), GET, HEAD and copying FROM a
 *    version are 403 AccessDenied unless that version is tagged GuardDutyMalwareScanStatus=NO_THREATS_FOUND, so any
 *    attempt by the application to read an unscanned object fails here exactly as it would on AWS.
 *  - the current object of each key is mirrored to disk at dir/<bucket>/<key> so a test running in another process can
 *    inspect it, and ListObjectsV2 reads that directory, so a test may also drop a file there directly.
 *
 * GET /__stub/versions?bucket=&key= returns each version's metadata as JSON (size, etag, tags, sse, kms key, checksum).
 */

export type S3Stub = {
  port: number
  endpoint: string
  dir: string
  close: () => Promise<void>
  /** Registers a bucket whose objects cannot be read until their version is tagged NO_THREATS_FOUND. */
  denyReadUnlessClean: (bucket: string) => void
  /** Writes the tags of one version (what GuardDuty does after a scan). Returns false if the version does not exist. */
  tagVersion: (bucket: string, key: string, versionId: string, tags: Record<string, string>) => boolean
  /** Bytes and metadata of one version, bypassing the bucket policy (for the scanner stand-in only). */
  readVersion: (bucket: string, key: string, versionId: string) => StubVersion | null
  /** Called after every PUT or COPY that creates a version. */
  onObjectCreated: (listener: (created: { bucket: string; key: string; versionId: string; etag: string; size: number }) => void) => void
}

export type StubVersion = {
  id: string
  body: Buffer
  contentType: string
  etag: string
  checksumSha256?: string
  lastModified: Date
  tags: Record<string, string>
  deleteMarker: boolean
  sse?: string
  kmsKeyId?: string
}

const SCAN_TAG = 'GuardDutyMalwareScanStatus'

function decodeAwsChunked(raw: Buffer): Buffer {
  const parts: Buffer[] = []
  let pos = 0
  for (;;) {
    const lineEnd = raw.indexOf('\r\n', pos)
    if (lineEnd === -1) break
    const header = raw.subarray(pos, lineEnd).toString('latin1')
    const size = parseInt(header.split(';')[0]!, 16)
    if (!Number.isFinite(size)) break
    pos = lineEnd + 2
    if (size === 0) break
    parts.push(raw.subarray(pos, pos + size))
    pos += size + 2
  }
  return Buffer.concat(parts)
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const errorXml = (code: string, message: string) => `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${xmlEscape(message)}</Message></Error>`

export function startS3Stub(dir: string, options: { persist?: boolean } = {}): Promise<S3Stub> {
  mkdirSync(dir, { recursive: true })
  // bucket -> key -> versions, newest first
  const store = new Map<string, Map<string, StubVersion[]>>()
  const policyBuckets = new Set<string>()
  const listeners: Parameters<S3Stub['onObjectCreated']>[0][] = []
  let counter = 0

  // Opt-in persistence (the local platform restarts between review sessions; the integration suite does not need it).
  const stateFile = dir + '-state.json'
  type SavedVersion = Omit<StubVersion, 'body' | 'lastModified'> & { body: string; lastModified: string }
  if (options.persist && existsSync(stateFile)) {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8')) as { counter: number; buckets: Record<string, Record<string, SavedVersion[]>> }
    counter = saved.counter
    for (const [bucket, keys] of Object.entries(saved.buckets)) {
      const map = new Map<string, StubVersion[]>()
      for (const [key, versions] of Object.entries(keys)) {
        map.set(key, versions.map((v) => ({ ...v, body: Buffer.from(v.body, 'base64'), lastModified: new Date(v.lastModified) })))
      }
      store.set(bucket, map)
    }
  }
  const save = () => {
    if (!options.persist) return
    const buckets: Record<string, Record<string, SavedVersion[]>> = {}
    for (const [bucket, keys] of store) {
      buckets[bucket] = {}
      for (const [key, versions] of keys) {
        buckets[bucket][key] = versions.map((v) => ({ ...v, body: v.body.toString('base64'), lastModified: v.lastModified.toISOString() }))
      }
    }
    writeFileSync(stateFile, JSON.stringify({ counter, buckets }))
  }

  const versionsOf = (bucket: string, key: string): StubVersion[] => {
    let keys = store.get(bucket)
    if (!keys) store.set(bucket, (keys = new Map()))
    let versions = keys.get(key)
    if (!versions) keys.set(key, (versions = []))
    return versions
  }
  const newVersionId = () => `v${(++counter).toString(36)}${randomBytes(6).toString('hex')}`
  const fileFor = (bucket: string, key: string) => path.join(dir, bucket, ...key.split('/'))
  const metaFor = (bucket: string, key: string) => path.join(dir + '-meta', bucket, ...key.split('/')) + '.json'

  /** Makes the disk mirror agree with the newest version of a key. */
  const syncDisk = (bucket: string, key: string) => {
    const newest = versionsOf(bucket, key)[0]
    const file = fileFor(bucket, key)
    if (!newest || newest.deleteMarker) {
      rmSync(file, { force: true })
      rmSync(metaFor(bucket, key), { force: true })
      return
    }
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, newest.body)
    mkdirSync(path.dirname(metaFor(bucket, key)), { recursive: true })
    writeFileSync(metaFor(bucket, key), JSON.stringify({ contentType: newest.contentType }))
  }

  const readableWithoutTag = (bucket: string, version: StubVersion) => !policyBuckets.has(bucket) || version.tags[SCAN_TAG] === 'NO_THREATS_FOUND'

  const addVersion = (bucket: string, key: string, input: Omit<StubVersion, 'id' | 'lastModified' | 'deleteMarker' | 'tags'>): StubVersion => {
    const version: StubVersion = { ...input, id: newVersionId(), lastModified: new Date(), tags: {}, deleteMarker: false }
    versionsOf(bucket, key).unshift(version)
    syncDisk(bucket, key)
    save()
    for (const listener of listeners) listener({ bucket, key, versionId: version.id, etag: version.etag, size: version.body.length })
    return version
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub')

    if (url.pathname === '/__stub/versions') {
      const bucket = url.searchParams.get('bucket') ?? ''
      const key = url.searchParams.get('key') ?? ''
      const body = versionsOf(bucket, key).map((v) => ({
        versionId: v.id, size: v.body.length, etag: v.etag, tags: v.tags, deleteMarker: v.deleteMarker, sse: v.sse ?? null,
        kmsKeyId: v.kmsKeyId ?? null, checksumSha256: v.checksumSha256 ?? null, contentType: v.contentType,
      }))
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      return
    }

    const objectPath = path.posix.normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '')
    const isList = req.method === 'GET' && url.searchParams.get('list-type') === '2'
    // reject traversal and anything that is not bucket/key
    if (objectPath.startsWith('..') || (!objectPath.includes('/') && !isList)) {
      res.writeHead(400).end()
      return
    }
    const bucket = objectPath.split('/')[0] ?? ''
    const key = objectPath.slice(bucket.length + 1)
    const file = fileFor(bucket, key)
    const versionId = url.searchParams.get('versionId')

    const fail = (status: number, code: string, message: string) => {
      const body = req.method === 'HEAD' ? undefined : errorXml(code, message)
      res.writeHead(status, { 'content-type': 'application/xml' }).end(body)
    }

    /** The version a read targets: the one named, else the newest. A delete marker is "not found". */
    const target = (): StubVersion | 'missing-version' | null => {
      const versions = versionsOf(bucket, key)
      if (versionId) return versions.find((v) => v.id === versionId) ?? 'missing-version'
      const newest = versions[0]
      return newest && !newest.deleteMarker ? newest : null
    }

    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        const copySourceHeader = req.headers['x-amz-copy-source']
        if (typeof copySourceHeader === 'string') {
          // CopyObject: header is "<bucket>/<key>[?versionId=<id>]", URL-encoded.
          const [rawPath = '', rawQuery = ''] = decodeURIComponent(copySourceHeader).replace(/^\/+/, '').split('?')
          const srcBucket = rawPath.split('/')[0] ?? ''
          const srcKey = rawPath.slice(srcBucket.length + 1)
          const srcVersionId = new URLSearchParams(rawQuery).get('versionId')
          const sourceVersions = versionsOf(srcBucket, srcKey)
          const source = srcVersionId ? sourceVersions.find((v) => v.id === srcVersionId) : sourceVersions.find((v) => !v.deleteMarker)
          if (!source || source.deleteMarker) return fail(404, 'NoSuchKey', 'copy source not found')
          if (!readableWithoutTag(srcBucket, source)) return fail(403, 'AccessDenied', 'the bucket policy denies reading this object until it is scanned clean')
          const ifMatch = req.headers['x-amz-copy-source-if-match']
          if (typeof ifMatch === 'string' && ifMatch.replace(/"/g, '') !== source.etag.replace(/"/g, '')) {
            return fail(412, 'PreconditionFailed', 'at least one of the preconditions you specified did not hold')
          }
          const wantsSha = String(req.headers['x-amz-checksum-algorithm'] ?? '').toUpperCase() === 'SHA256'
          const copied = addVersion(bucket, key, {
            body: source.body,
            contentType: String(req.headers['x-amz-metadata-directive'] ?? '').toUpperCase() === 'REPLACE' ? String(req.headers['content-type'] ?? source.contentType) : source.contentType,
            etag: source.etag,
            checksumSha256: wantsSha ? createHash('sha256').update(source.body).digest('base64') : source.checksumSha256,
            sse: String(req.headers['x-amz-server-side-encryption'] ?? '') || undefined,
            kmsKeyId: String(req.headers['x-amz-server-side-encryption-aws-kms-key-id'] ?? '') || undefined,
          })
          const xml =
            `<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>${copied.etag}</ETag><LastModified>${copied.lastModified.toISOString()}</LastModified>` +
            `${copied.checksumSha256 ? `<ChecksumSHA256>${copied.checksumSha256}</ChecksumSHA256>` : ''}</CopyObjectResult>`
          res.writeHead(200, { 'content-type': 'application/xml', 'x-amz-version-id': copied.id, 'x-amz-copy-source-version-id': source.id }).end(xml)
          return
        }

        // Tagging writes (PUT ?tagging) are not used by the application, only by the scanner stand-in directly.
        let body: Buffer = Buffer.concat(chunks)
        const encoding = String(req.headers['content-encoding'] ?? '')
        const sha = String(req.headers['x-amz-content-sha256'] ?? '')
        if (encoding.includes('aws-chunked') || sha.startsWith('STREAMING-')) body = decodeAwsChunked(body)
        const declared = req.headers['x-amz-checksum-sha256']
        const actual = createHash('sha256').update(body).digest('base64')
        if (typeof declared === 'string' && declared !== actual) return fail(400, 'BadDigest', 'the x-amz-checksum-sha256 you specified did not match the calculated checksum')
        const created = addVersion(bucket, key, {
          body,
          contentType: String(req.headers['content-type'] ?? 'application/octet-stream'),
          etag: `"${createHash('md5').update(body).digest('hex')}"`,
          checksumSha256: typeof declared === 'string' ? declared : undefined,
          sse: String(req.headers['x-amz-server-side-encryption'] ?? '') || undefined,
          kmsKeyId: String(req.headers['x-amz-server-side-encryption-aws-kms-key-id'] ?? '') || undefined,
        })
        res.writeHead(200, { ETag: created.etag, 'x-amz-version-id': created.id, ...(created.checksumSha256 ? { 'x-amz-checksum-sha256': created.checksumSha256 } : {}) }).end()
      })
      return
    }

    // ListObjectsV2: GET /<bucket>?list-type=2[&prefix=...], enough for storage reconciliation. Reads the disk mirror.
    if (isList) {
      const prefix = url.searchParams.get('prefix') ?? ''
      const root = path.join(dir, bucket)
      const found: { key: string; size: number; mtime: Date }[] = []
      const walk = (folder: string, rel: string) => {
        if (!existsSync(folder)) return
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
          const next = rel ? `${rel}/${entry.name}` : entry.name
          if (entry.isDirectory()) walk(path.join(folder, entry.name), next)
          else if (next.startsWith(prefix)) {
            const st = statSync(path.join(folder, entry.name))
            found.push({ key: next, size: st.size, mtime: st.mtime })
          }
        }
      }
      walk(root, '')
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>' + bucket + '</Name><IsTruncated>false</IsTruncated>' +
        found.map((f) => `<Contents><Key>${f.key}</Key><LastModified>${f.mtime.toISOString()}</LastModified><Size>${f.size}</Size></Contents>`).join('') +
        '</ListBucketResult>'
      res.writeHead(200, { 'content-type': 'application/xml' }).end(xml)
      return
    }

    if (req.method === 'GET' && url.searchParams.has('tagging')) {
      const found = target()
      if (found === null || found === 'missing-version') return fail(404, found === null ? 'NoSuchKey' : 'NoSuchVersion', 'not found')
      const tags = Object.entries(found.tags).map(([k, v]) => `<Tag><Key>${xmlEscape(k)}</Key><Value>${xmlEscape(v)}</Value></Tag>`).join('')
      res.writeHead(200, { 'content-type': 'application/xml', 'x-amz-version-id': found.id }).end(`<?xml version="1.0" encoding="UTF-8"?><Tagging><TagSet>${tags}</TagSet></Tagging>`)
      return
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const versions = versionsOf(bucket, key)
      const found = target()
      if (found === 'missing-version') return fail(404, 'NoSuchVersion', 'version not found')
      if (found) {
        if (!readableWithoutTag(bucket, found)) return fail(403, 'AccessDenied', 'the bucket policy denies reading this object until it is scanned clean')
        const headers: Record<string, string | number> = {
          'content-length': found.body.length, 'content-type': found.contentType, ETag: found.etag,
          'x-amz-version-id': found.id, 'last-modified': found.lastModified.toUTCString(),
        }
        if (found.checksumSha256) headers['x-amz-checksum-sha256'] = found.checksumSha256
        res.writeHead(200, headers)
        res.end(req.method === 'HEAD' ? undefined : found.body)
        return
      }
      // Not known to the version store: fall back to a file a test placed on disk directly.
      if (versions.length === 0 && existsSync(file) && !statSync(file).isDirectory()) {
        const body = readFileSync(file)
        const contentType = existsSync(metaFor(bucket, key)) ? (JSON.parse(readFileSync(metaFor(bucket, key), 'utf8')) as { contentType: string }).contentType : 'application/octet-stream'
        res.writeHead(200, { 'content-length': body.length, 'content-type': contentType })
        res.end(req.method === 'HEAD' ? undefined : body)
        return
      }
      fail(404, 'NoSuchKey', 'not found')
      return
    }

    if (req.method === 'DELETE') {
      const versions = versionsOf(bucket, key)
      if (versionId) {
        const at = versions.findIndex((v) => v.id === versionId)
        if (at !== -1) versions.splice(at, 1)
        syncDisk(bucket, key)
        save()
        res.writeHead(204, { 'x-amz-version-id': versionId }).end()
        return
      }
      if (versions.length === 0) {
        // A file a test placed on disk directly, never versioned: remove it.
        rmSync(file, { force: true })
        rmSync(metaFor(bucket, key), { force: true })
        res.writeHead(204).end()
        return
      }
      const marker: StubVersion = { id: newVersionId(), body: Buffer.alloc(0), contentType: '', etag: '', lastModified: new Date(), tags: {}, deleteMarker: true }
      versions.unshift(marker)
      syncDisk(bucket, key)
      save()
      res.writeHead(204, { 'x-amz-version-id': marker.id, 'x-amz-delete-marker': 'true' }).end()
      return
    }

    res.writeHead(405).end()
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as import('node:net').AddressInfo
      resolve({
        port,
        endpoint: `http://127.0.0.1:${port}`,
        dir,
        close: () => new Promise<void>((done) => server.close(() => done())),
        denyReadUnlessClean: (bucket) => void policyBuckets.add(bucket),
        tagVersion: (bucket, key, versionId, tags) => {
          const found = versionsOf(bucket, key).find((v) => v.id === versionId)
          if (!found) return false
          found.tags = { ...found.tags, ...tags }
          save()
          return true
        },
        readVersion: (bucket, key, versionId) => versionsOf(bucket, key).find((v) => v.id === versionId) ?? null,
        onObjectCreated: (listener) => void listeners.push(listener),
      })
    })
  })
}
