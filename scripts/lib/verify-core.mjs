// Checks that a deployed KNEST answers the way the design says it must. Used by
// scripts/verify-production.mjs against the real distribution and, in tests
// (infra/verify/verify.test.ts), against a local server that behaves like a good
// deployment and like several bad ones. Each check returns { name, ok, detail };
// nothing here prints, so the caller decides what to record.
import http from 'node:http'
import https from 'node:https'

/** One HTTP(S) request with a hard timeout. `connectTo` sends the connection to a given IP while keeping the URL's host for SNI and the Host header. */
export function request(url, { method = 'GET', headers = {}, connectTo, timeoutMs = 15000, maxBytes = 200_000 } = {}) {
  const target = new URL(url)
  const client = target.protocol === 'https:' ? https : http
  return new Promise((resolve) => {
    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: target.pathname + target.search,
        method,
        headers: { 'user-agent': 'knest-verify/1', accept: '*/*', ...headers },
        lookup: connectTo ? (_host, _opts, cb) => cb(null, connectTo, connectTo.includes(':') ? 6 : 4) : undefined,
        servername: target.hostname,
        timeout: timeoutMs,
      },
      (res) => {
        // Read the certificate now: once the response ends the socket may already be detached.
        const cert = res.socket?.getPeerCertificate?.()
        const chunks = []
        let size = 0
        res.on('data', (c) => {
          size += c.length
          if (size <= maxBytes) chunks.push(c)
        })
        res.on('end', () => {
          resolve({
            ok: true,
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            certExpires: cert && cert.valid_to ? new Date(cert.valid_to) : null,
          })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
    req.on('error', (e) => resolve({ ok: false, error: e.code || e.message }))
    req.end()
  })
}

const basicHeader = (userPass) => ({ authorization: 'Basic ' + Buffer.from(userPass).toString('base64') })
const result = (name, ok, detail) => ({ name, ok: Boolean(ok), detail })
const hdr = (r, name) => String(r.headers?.[name] ?? '')

/** Paths that depend on who is signed in or carry private data; none may be cacheable. */
export const PRIVATE_PATHS = ['/login', '/signup', '/dashboard', '/admin', '/api/auth/session', '/api/lab-bookings?limit=0', '/api/health']

export async function runChecks(options) {
  const { baseUrl, basic, expectGate = false, expectWaf = false, originUrl, altHosts = [], connectTo, canonicalOrigin = 'https://kiitnest.com' } = options
  const base = new URL(baseUrl)
  const auth = basic ? basicHeader(basic) : {}
  const out = []
  const get = (path, extra = {}) => request(new URL(path, base).toString(), { headers: { ...auth, ...(extra.headers ?? {}) }, connectTo, ...extra })

  // 1. HTTPS with a certificate that is not about to expire; plain HTTP is redirected to it.
  if (base.protocol === 'https:') {
    const r = await get('/')
    const daysLeft = r.certExpires ? (r.certExpires - Date.now()) / 86_400_000 : 0
    out.push(result('https answers with a valid certificate', r.ok && daysLeft > 14, r.ok ? 'certificate valid for ' + Math.floor(daysLeft) + ' more days' : r.error))
    const plain = await request('http://' + base.host + '/', { connectTo })
    out.push(result('plain http is redirected to https', plain.ok && [301, 308].includes(plain.status) && hdr(plain, 'location').startsWith('https://'), plain.ok ? plain.status + ' ' + hdr(plain, 'location') : plain.error))
  }

  // 2. The private-first gate.
  if (expectGate) {
    const anon = await request(new URL('/', base).toString(), { connectTo })
    out.push(result('the site refuses a visitor with no credentials (401 + Basic challenge)', anon.ok && anon.status === 401 && /basic/i.test(hdr(anon, 'www-authenticate')), anon.ok ? String(anon.status) : anon.error))
    const wrong = await request(new URL('/', base).toString(), { connectTo, headers: basicHeader('nobody:wrong') })
    out.push(result('the site refuses wrong credentials', wrong.ok && wrong.status === 401, wrong.ok ? String(wrong.status) : wrong.error))
  }

  // 3. The home page and the security headers the application sets.
  const home = await get('/login')
  const sec = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']
  const missing = sec.filter((h) => !hdr(home, h))
  out.push(result('the sign-in page loads (200)', home.ok && home.status === 200, home.ok ? String(home.status) : home.error))
  out.push(result('security headers are present', home.ok && missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : 'all present'))
  if (base.protocol === 'https:') out.push(result('HSTS is sent', home.ok && /max-age=\d{7,}/.test(hdr(home, 'strict-transport-security')), hdr(home, 'strict-transport-security') || 'absent'))

  // 4. Nothing private is cacheable, and the CDN did not serve it from its cache.
  for (const path of PRIVATE_PATHS) {
    const first = await get(path)
    const second = await get(path)
    const cc = hdr(first, 'cache-control').toLowerCase()
    const hit = /hit from cloudfront/i.test(hdr(second, 'x-cache'))
    out.push(result('not cacheable: ' + path, first.ok && cc.includes('no-store') && !/public|s-maxage/.test(cc) && !hit, first.ok ? 'cache-control="' + cc + '"' + (hit ? ', served from the CDN cache' : '') : first.error))
  }

  // 5. Fingerprinted build assets ARE cached (otherwise the site is slow and the policy is wrong).
  const asset = /\/_next\/static\/[^"'\s)]+\.(?:js|css)/.exec(home.body ?? '')?.[0]
  if (asset) {
    await get(asset)
    const again = await get(asset)
    out.push(result('build assets are cached: ' + asset.slice(0, 48), again.ok && again.status === 200 && /max-age=\d{5,}|immutable/.test(hdr(again, 'cache-control')), 'cache-control="' + hdr(again, 'cache-control') + '"'))
  }

  // 6. Anonymous callers cannot read private data or reach the console.
  const labs = await get('/api/lab-bookings?limit=0')
  out.push(result('anonymous lab-bookings read is refused', labs.ok && [401, 403].includes(labs.status), labs.ok ? String(labs.status) : labs.error))
  const admin = await get('/admin')
  out.push(result('the console is hidden from anonymous visitors', admin.ok && [307, 308, 401, 403, 404].includes(admin.status), admin.ok ? String(admin.status) : admin.error))
  const forged = await request(new URL('/api/auth/password/login', base).toString(), {
    method: 'POST',
    connectTo,
    headers: { ...auth, origin: 'https://evil.example', 'content-type': 'application/json' },
  })
  out.push(result('a cross-origin write is refused', forged.ok && forged.status === 403, forged.ok ? String(forged.status) : forged.error))

  // 7. The WAF blocks an obvious attack string before it reaches the application.
  if (expectWaf) {
    const attack = await get('/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E')
    out.push(result('the WAF blocks a script-injection probe (403)', attack.ok && attack.status === 403, attack.ok ? String(attack.status) : attack.error))
  }

  // 8. The origin cannot be reached around the CDN.
  if (originUrl) {
    const direct = await request(originUrl, { timeoutMs: 8000 })
    const refused = !direct.ok || direct.status === 403
    out.push(result('the origin refuses a direct request', refused, direct.ok ? 'status ' + direct.status : 'no answer (' + direct.error + ')'))
  }

  // 9. Alternate hostnames redirect to the canonical site, keeping path and query.
  for (const host of altHosts) {
    const r = await request(new URL('/programs/incubate?ref=a&x=1', base).toString(), { connectTo, headers: { ...auth, host } })
    const location = hdr(r, 'location')
    out.push(result('redirects ' + host + ' to the canonical site', r.ok && r.status === 301 && location === canonicalOrigin + '/programs/incubate?ref=a&x=1', r.ok ? r.status + ' ' + location : r.error))
  }
  return out
}

export function summarise(results) {
  return { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length }
}
