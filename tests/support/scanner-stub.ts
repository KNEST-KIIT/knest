import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { EICAR_SIGNATURE } from '@/server/security/malware-scan'

export type ScannerStub = { endpoint: string; port: number; close: () => Promise<void> }

/**
 * Lightweight local antivirus scanner stub for integration test suites.
 *
 * Runs on loopback under NODE_ENV=production, returning strict positive verdicts:
 * - Clean documents receive { clean: true, infected: false }
 * - EICAR test signatures receive { clean: false, infected: true, threat: 'EICAR-Standard-AV-Test-File' }
 * - Disguised PE binaries receive { clean: false, infected: true, threat: 'Disguised-PE-Binary' }
 */
export function startScannerStub(): Promise<ScannerStub> {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end('Method Not Allowed')
      return
    }

    const chunks: Buffer[] = []
    let totalBytes = 0
    req.on('data', (c: Buffer) => {
      chunks.push(c)
      totalBytes += c.length
      if (totalBytes > 20 * 1024 * 1024) {
        req.destroy()
      }
    })

    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const bodyStr = body.toString('utf8', 0, Math.min(body.length, 1024 * 1024))

      // Detect EICAR test signature
      if (bodyStr.includes(EICAR_SIGNATURE)) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ clean: false, infected: true, threat: 'EICAR-Standard-AV-Test-File' }))
        return
      }

      // Detect disguised PE executable
      if (body.length >= 2 && body[0] === 0x4d && body[1] === 0x5a && bodyStr.includes('this is not a pdf')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ clean: false, infected: true, threat: 'Disguised-PE-Binary' }))
        return
      }

      // Strict positive clean verdict
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ clean: true, infected: false }))
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        port,
        endpoint: `http://127.0.0.1:${port}/scan`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}
