import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE } from '../support/helpers'

/**
 * Module 6: Google sign-in in its ENABLED state, with no real credentials. A second copy of the
 * production build runs with stub Google credentials and AUTH_GOOGLE_ISSUER pointing at a local
 * OpenID discovery stand-in, so the whole start of the flow runs for real: the buttons, the
 * provider list, the POST that begins the exchange, the state and PKCE cookies, and the
 * redirect to the (stub) authorisation endpoint. The disabled state is covered in 70-core-journey.
 */

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLIENT_ID = 'stub-google-client-id'

let oidc: http.Server
let oidcBase = ''
let server: ChildProcess | null = null
let enabledBase = ''

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo
      s.close(() => resolve(port))
    })
  })
}

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms
  for (;;) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status < 600) return
    } catch {
      // not up yet
    }
    if (Date.now() > until) throw new Error(`server did not become ready: ${url}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

beforeAll(async () => {
  if (!existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) return

  oidc = http.createServer((req, res) => {
    if (req.url?.startsWith('/.well-known/openid-configuration')) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          issuer: oidcBase,
          authorization_endpoint: `${oidcBase}/authorize`,
          token_endpoint: `${oidcBase}/token`,
          userinfo_endpoint: `${oidcBase}/userinfo`,
          jwks_uri: `${oidcBase}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
        }),
      )
      return
    }
    res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => oidc.listen(0, '127.0.0.1', () => resolve()))
  oidcBase = `http://127.0.0.1:${(oidc.address() as net.AddressInfo).port}`

  const port = await freePort()
  enabledBase = `http://127.0.0.1:${port}`
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    AUTH_URL: enabledBase,
    AUTH_TRUST_HOST: 'true',
    SITE_URL: enabledBase,
    NEXT_PUBLIC_SITE_URL: enabledBase,
    CLIENT_IP_SOURCE: 'x-forwarded-for',
    DATABASE_SSL: 'off',
    AUTH_GOOGLE_ID: CLIENT_ID,
    AUTH_GOOGLE_SECRET: 'stub-google-client-secret',
    AUTH_GOOGLE_ISSUER: oidcBase,
    TURNSTILE_SECRET_KEY: 'integration-turnstile-secret',
    TURNSTILE_SITE_KEY: 'integration-site-key',
    EMAIL_TRANSPORT: 'smtp',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: process.env.TEST_SMTP_PORT ?? '2525',
    SMTP_USER: '',
    EMAIL_FROM: 'KNEST Tests <no-reply@knest.test>',
    S3_BUCKET: process.env.TEST_S3_BUCKET ?? 'knest-it-documents',
    S3_REGION: 'ap-south-1',
    S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? 'http://127.0.0.1:9',
    S3_ACCESS_KEY_ID: 'test-access-key-id',
    S3_SECRET_ACCESS_KEY: 'test-secret-access-key',
  }
  server = spawn('npx', ['next', 'start', ROOT, '-p', String(port), '-H', '127.0.0.1'], {
    cwd: os.tmpdir(),
    env,
    shell: true,
    stdio: 'ignore',
  })
  await waitFor(`${enabledBase}/login`, 90_000)
}, 150_000)

afterAll(async () => {
  if (server?.pid) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { shell: true })
    server.kill()
  }
  await new Promise<void>((resolve) => (oidc ? oidc.close(() => resolve()) : resolve()))
})

const ready = () => Boolean(server)

describe('Google sign-in, enabled with a stubbed provider', () => {
  it('shows the Google button as a POST form on log in and sign up', async () => {
    if (!ready()) return
    for (const [route, label] of [
      ['/login', 'Continue with Google'],
      ['/signup', 'Sign up with Google'],
    ] as const) {
      const html = await (await fetch(`${enabledBase}${route}`)).text()
      expect(html, route).toContain(label)
      expect(html, route).toMatch(/<form[^>]*action="\/api\/auth\/google\/start"[^>]*method="post"|<form[^>]*method="post"[^>]*action="\/api\/auth\/google\/start"/)
      // a plain link to Auth.js's GET endpoint only bounces back to /login
      expect(html, route).not.toContain('href="/api/auth/signin/google')
    }
  })

  it('lists google among the providers', async () => {
    if (!ready()) return
    const providers = await (await fetch(`${enabledBase}/api/auth/providers`)).json()
    expect(Object.keys(providers)).toEqual(['google'])
  })

  it('starts the exchange: 303 to the provider with state and PKCE, and remembers a safe return path', async () => {
    if (!ready()) return
    const form = new URLSearchParams({ next: '/programs' })
    const res = await fetch(`${enabledBase}/api/auth/google/start`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.7' },
      body: form,
    })
    expect(res.status).toBe(303)
    const location = new URL(res.headers.get('location')!)
    expect(`${location.origin}${location.pathname}`).toBe(`${oidcBase}/authorize`)
    expect(location.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(location.searchParams.get('redirect_uri')).toBe(`${enabledBase}/api/auth/callback/google`)
    expect(location.searchParams.get('state')).toBeTruthy()
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')

    const cookies = res.headers.getSetCookie().join('\n')
    expect(cookies).toMatch(/authjs\.state=/)
    expect(cookies).toMatch(/authjs\.pkce\.code_verifier=/)
    expect(decodeURIComponent(cookies)).toContain('/programs')
  })

  it('ignores a hostile return path', async () => {
    if (!ready()) return
    const res = await fetch(`${enabledBase}/api/auth/google/start`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.8' },
      body: new URLSearchParams({ next: '//evil.example/pwned' }),
    })
    expect(res.status).toBe(303)
    expect(decodeURIComponent(res.headers.getSetCookie().join('\n'))).not.toContain('evil.example')
  })

  it('a failed provider return lands on log in with a message, not a blank error page', async () => {
    if (!ready()) return
    const res = await fetch(`${enabledBase}/login?error=OAuthCallbackError`)
    expect(await res.text()).toContain('Google sign-in didn’t finish')
  })
})

describe('Google sign-in, disabled', () => {
  it('the start route sends the visitor back to log in with a reason', async () => {
    const res = await fetch(`${BASE()}/api/auth/google/start`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.9' },
      body: new URLSearchParams({ next: '/programs' }),
    })
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    expect(res.headers.get('location')).toContain('error=GoogleUnavailable')
  })
})
