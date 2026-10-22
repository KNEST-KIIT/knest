/** Local review helper: separate host-only cookies for each fictional persona. */
import http from 'node:http'

const port = 3100
const upstream = '127.0.0.1:3000'
const personas = [
  ['student', 'Student — first visit', '/dashboard'],
  ['student-ready', 'Student — dashboard', '/dashboard'],
  ['founder', 'Founder', '/dashboard'],
  ['investor', 'Investor', '/dashboard'],
  ['mentor', 'Mentor', '/dashboard'],
  ['alumni', 'Alumni', '/dashboard'],
  ['partner', 'Partner', '/dashboard'],
  ['admin', 'Administrator', '/admin/overview'],
  ['reviewer', 'Application reviewer', '/admin/applications'],
  ['manager', 'Program manager', '/admin/overview'],
  ['content', 'Content editor', '/admin'],
  ['startupmanager', 'Startup manager', '/admin'],
  ['mentormanager', 'Mentor manager', '/admin'],
  ['labadmin', 'Lab administrator', '/admin/labs'],
  ['labhead', 'Lab head', '/dashboard/lab-staff/local-test-lab'],
  ['assistant', 'Lab assistant', '/dashboard/lab-staff/local-test-lab'],
] as const

function personaFor(req: http.IncomingMessage) {
  const index = personas.findIndex(([name]) => req.headers.host === `${name}.localhost:${port}`)
  return index < 0 ? null : { index, persona: personas[index] }
}

function headersFor(req: http.IncomingMessage, index: number): http.OutgoingHttpHeaders | null {
  // Validate the actual browser origin before translating it to the upstream origin.
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return null
  if (!req.headers.origin && req.headers['sec-fetch-site'] === 'cross-site' && !['GET', 'HEAD'].includes(req.method ?? 'GET')) return null
  const headers = { ...req.headers }
  headers.host = upstream
  if (headers.origin) headers.origin = `http://${upstream}`
  if (headers.referer?.startsWith(`http://${req.headers.host}/`)) headers.referer = headers.referer.replace(`http://${req.headers.host}`, `http://${upstream}`)
  headers['x-forwarded-host'] = upstream
  headers['x-forwarded-proto'] = 'http'
  // Stable loopback client per persona, like separate local test browsers.
  // Incoming forwarded addresses are never trusted by this helper.
  headers['x-forwarded-for'] = `127.0.0.${index + 11}`
  return headers
}

const server = http.createServer((req, res) => {
  if (req.headers.host === `review.localhost:${port}` && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" })
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KNEST · Portal review</title><style>body{font:16px/1.6 system-ui;background:#faf8f5;color:#242126;margin:0;padding:40px;max-width:1100px}h1{font-size:40px;line-height:1.15}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px}a{display:block;background:white;border:1px solid #dfd9d4;border-radius:12px;padding:20px;color:#702333;text-decoration:none}a:hover,a:focus{outline:2px solid #702333}small{display:block;color:#666}p{max-width:760px}code{background:#eee5df;padding:3px 6px}</style><h1>KNEST portal review</h1><p>Each portal has its own local sign-in. Switching tabs keeps the other accounts signed in. All accounts and content are fictional.</p><p>Demo password: <code>Knest-Local-Test-2026!</code> · <a style="display:inline;padding:0;border:0;background:none" href="http://127.0.0.1:8025/" target="_blank" rel="noopener">Test inbox</a></p><main>${personas.map(([name, label, route]) => `<a href="http://${name}.localhost:${port}${route}" target="_blank" rel="noopener"><strong>${label}</strong><small>${name}@knest.local</small></a>`).join('')}</main><p>Review order: student onboarding → student dashboard → founder → investor/mentor → reviewer/manager → admin/content → lab request and approval.</p></html>`)
    return
  }
  const found = personaFor(req)
  const headers = found && headersFor(req, found.index)
  if (!headers) { res.writeHead(403); res.end('This helper accepts only its named local portals and same-origin requests.'); return }
  const proxy = http.request({ hostname: '127.0.0.1', port: 3000, method: req.method, path: req.url, headers }, (response) => {
    const responseHeaders = { ...response.headers }
    if (responseHeaders.location?.startsWith(`http://${upstream}/`)) responseHeaders.location = responseHeaders.location.replace(`http://${upstream}`, `http://${req.headers.host}`)
    res.writeHead(response.statusCode ?? 502, responseHeaders)
    response.pipe(res)
  })
  proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Local KNEST is starting. Refresh shortly.'); })
  req.on('aborted', () => proxy.destroy())
  res.on('close', () => proxy.destroy())
  req.pipe(proxy)
})

server.on('upgrade', (req, socket, head) => {
  const found = personaFor(req)
  const headers = found && headersFor(req, found.index)
  if (!headers) { socket.destroy(); return }
  const proxy = http.request({ hostname: '127.0.0.1', port: 3000, method: req.method, path: req.url, headers })
  proxy.on('upgrade', (response, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`)
    if (head.length) upstreamSocket.write(head)
    if (upstreamHead.length) socket.write(upstreamHead)
    socket.pipe(upstreamSocket).pipe(socket)
    socket.on('error', () => upstreamSocket.destroy())
    upstreamSocket.on('error', () => socket.destroy())
  })
  proxy.on('error', () => socket.destroy())
  proxy.end()
})
server.listen(port, '127.0.0.1', () => console.log(`Portal review: http://review.localhost:${port}/ (start pnpm dev:local first)`))
