import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

/**
 * A minimal S3-compatible server for tests (path-style, no authentication). It
 * stores each object as a file under `dir/<bucket>/<key>` so a test running in
 * another process can read what the application wrote. It understands PUT, GET,
 * HEAD and DELETE of a single object, including the `aws-chunked` body framing the AWS
 * SDK uses when it sends a checksum trailer. It does not check signatures: it
 * proves that the application's real S3 client code path stores and retrieves
 * bytes, not that AWS accepts the credentials.
 */

export type S3Stub = { port: number; endpoint: string; dir: string; close: () => Promise<void> }

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

export function startS3Stub(dir: string): Promise<S3Stub> {
  mkdirSync(dir, { recursive: true })
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub')
    const objectPath = path.posix.normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '')
    // reject traversal and anything that is not bucket/key
    const isList = req.method === 'GET' && url.searchParams.get('list-type') === '2'
    if (objectPath.startsWith('..') || (!objectPath.includes('/') && !isList)) {
      res.writeHead(400).end()
      return
    }
    const file = path.join(dir, ...objectPath.split('/'))
    // Content types are kept beside the objects, not inside the folder tests inspect.
    const metaFile = path.join(dir + '-meta', ...objectPath.split('/')) + '.json'

    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        let body: Buffer = Buffer.concat(chunks)
        const encoding = String(req.headers['content-encoding'] ?? '')
        const sha = String(req.headers['x-amz-content-sha256'] ?? '')
        if (encoding.includes('aws-chunked') || sha.startsWith('STREAMING-')) body = decodeAwsChunked(body)
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, body)
        mkdirSync(path.dirname(metaFile), { recursive: true })
        writeFileSync(metaFile, JSON.stringify({ contentType: String(req.headers['content-type'] ?? 'application/octet-stream') }))
        res.writeHead(200, { ETag: '"stub"' }).end()
      })
      return
    }

    // ListObjectsV2: GET /<bucket>?list-type=2[&prefix=...], enough for storage reconciliation.
    if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const bucket = objectPath.split('/')[0] ?? ''
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

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404, { 'content-type': 'application/xml' })
        res.end('<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>not found</Message></Error>')
        return
      }
      const body = readFileSync(file)
      const contentType = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, 'utf8')) as { contentType: string }).contentType : 'application/octet-stream'
      res.writeHead(200, { 'content-length': body.length, 'content-type': contentType })
      res.end(req.method === 'HEAD' ? undefined : body)
      return
    }

    if (req.method === 'DELETE') {
      rmSync(file, { force: true })
      rmSync(metaFile, { force: true })
      res.writeHead(204).end()
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
      })
    })
  })
}
