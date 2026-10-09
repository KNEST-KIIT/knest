import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runChecks, summarise } from '../../scripts/lib/verify-core.mjs'

/**
 * The verification harness is tested against local servers that behave like a correct
 * deployment and like deployments with specific faults, so a green result on the real
 * distribution means something: the checks can fail.
 */

type Fault = 'none' | 'cacheable-private' | 'no-security-headers' | 'open-api' | 'accepts-foreign-origin'

function startServer(fault: Fault, options: { gate?: boolean } = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const secure: Record<string, string> =
      fault === 'no-security-headers'
        ? {}
        : {
            'content-security-policy': "default-src 'self'",
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'referrer-policy': 'strict-origin-when-cross-origin',
          }
    if (options.gate && !req.headers.authorization) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="x"', 'cache-control': 'no-store' }).end()
      return
    }
    if (options.gate && req.headers.authorization !== 'Basic ' + Buffer.from('rev:pw').toString('base64')) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="x"' }).end()
      return
    }
    const isPrivate = ['/login', '/signup', '/dashboard', '/admin', '/api/auth/session', '/api/lab-bookings', '/api/health'].includes(url.pathname)
    const cache = isPrivate ? (fault === 'cacheable-private' ? 'public, s-maxage=600' : 'private, no-store') : 'public, max-age=31536000, immutable'

    if (url.pathname === '/api/auth/password/login' && req.method === 'POST') {
      const foreign = req.headers.origin && req.headers.origin !== 'http://localhost'
      res.writeHead(foreign && fault !== 'accepts-foreign-origin' ? 403 : 401, { 'cache-control': 'no-store' }).end('x')
      return
    }
    if (url.pathname === '/api/lab-bookings') {
      res.writeHead(fault === 'open-api' ? 200 : 401, { ...secure, 'cache-control': cache }).end('[]')
      return
    }
    if (url.pathname === '/admin') {
      res.writeHead(404, { ...secure, 'cache-control': cache }).end()
      return
    }
    if (url.pathname.startsWith('/_next/static/')) {
      res.writeHead(200, { 'cache-control': cache, 'content-type': 'text/css' }).end('a{}')
      return
    }
    res
      .writeHead(200, { ...secure, 'cache-control': cache, 'content-type': 'text/html' })
      .end('<html><link rel="stylesheet" href="/_next/static/css/app.abc123.css"></html>')
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      }),
    ),
  )
}

const failing = (results: { ok: boolean; name: string }[]) => results.filter((r) => !r.ok).map((r) => r.name)

describe('runChecks against a correct deployment', () => {
  let server: Awaited<ReturnType<typeof startServer>>
  beforeAll(async () => {
    server = await startServer('none')
  })
  afterAll(() => server.close())

  it('passes every check', async () => {
    const results = await runChecks({ baseUrl: server.url })
    expect(failing(results)).toEqual([])
    expect(summarise(results).failed).toBe(0)
    expect(results.length).toBeGreaterThan(10)
  })

  it('an origin that answers directly is a failure; one that does not answer is a pass', async () => {
    const bad = await runChecks({ baseUrl: server.url, originUrl: server.url })
    expect(failing(bad)).toEqual(['the origin refuses a direct request'])
    const good = await runChecks({ baseUrl: server.url, originUrl: 'http://127.0.0.1:1' })
    expect(failing(good)).toEqual([])
  })
})

describe('runChecks catches each class of fault', () => {
  it.each([
    ['cacheable-private', 'not cacheable: /login'],
    ['no-security-headers', 'security headers are present'],
    ['open-api', 'anonymous lab-bookings read is refused'],
    ['accepts-foreign-origin', 'a cross-origin write is refused'],
  ] as [Fault, string][])('%s', async (fault, expected) => {
    const server = await startServer(fault)
    try {
      const failed = failing(await runChecks({ baseUrl: server.url }))
      expect(failed).toContain(expected)
    } finally {
      await server.close()
    }
  })
})

describe('the private-first gate', () => {
  it('passes when the site demands credentials and accepts the right ones', async () => {
    const server = await startServer('none', { gate: true })
    try {
      const results = await runChecks({ baseUrl: server.url, expectGate: true, basic: 'rev:pw' })
      expect(failing(results)).toEqual([])
    } finally {
      await server.close()
    }
  })

  it('fails when the gate is expected but the site is open', async () => {
    const server = await startServer('none')
    try {
      const failed = failing(await runChecks({ baseUrl: server.url, expectGate: true }))
      expect(failed).toContain('the site refuses a visitor with no credentials (401 + Basic challenge)')
    } finally {
      await server.close()
    }
  })
})
