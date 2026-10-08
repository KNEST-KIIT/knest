import { appendFileSync } from 'node:fs'
import net from 'node:net'

/**
 * A minimal SMTP server for tests. It accepts any message and appends one JSON
 * line per message (envelope + raw body) to a capture file, so a test can prove
 * that nodemailer really delivered something over SMTP. It speaks only as much
 * of the protocol as nodemailer needs: no TLS, no AUTH.
 */
const CRLF = String.fromCharCode(13, 10)

export type SmtpStub = { port: number; close: () => Promise<void> }

export function startSmtpStub(captureFile: string): Promise<SmtpStub> {
  const server = net.createServer((socket) => {
    let inData = false
    let buffer = ''
    let from = ''
    const to: string[] = []
    let body = ''
    socket.write(`220 knest-test-smtp ready${CRLF}`)

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      for (;;) {
        if (inData) {
          const end = buffer.indexOf(`${CRLF}.${CRLF}`)
          if (end === -1) {
            return
          }
          body = buffer.slice(0, end)
          buffer = buffer.slice(end + 5)
          inData = false
          appendFileSync(captureFile, JSON.stringify({ from, to: [...to], body }) + '\n')
          to.length = 0
          socket.write(`250 queued${CRLF}`)
          continue
        }
        const eol = buffer.indexOf(CRLF)
        if (eol === -1) return
        const line = buffer.slice(0, eol)
        buffer = buffer.slice(eol + 2)
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'EHLO' || cmd === 'HELO') socket.write(`250-knest-test-smtp${CRLF}250 8BITMIME${CRLF}`)
        else if (cmd === 'MAIL') {
          from = line.slice(10).replace(/[<>]/g, '').trim()
          socket.write(`250 ok${CRLF}`)
        } else if (cmd === 'RCPT') {
          to.push(line.slice(8).replace(/[<>]/g, '').trim())
          socket.write(`250 ok${CRLF}`)
        } else if (cmd === 'DATA') {
          inData = true
          socket.write(`354 go ahead${CRLF}`)
        } else if (cmd === 'QUIT') {
          socket.write(`221 bye${CRLF}`)
          socket.end()
          return
        } else if (cmd === 'RSET' || cmd === 'NOOP') socket.write(`250 ok${CRLF}`)
        else socket.write(`502 not implemented${CRLF}`)
      }
    })
    socket.on('error', () => {})
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo
      resolve({ port, close: () => new Promise((r) => server.close(() => r())) })
    })
  })
}
