import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, PASSWORD, captcha, closeDb, createUser, db, decodeMailText, readMail, uniqueIp } from '../support/helpers'

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
const providerLog: string[] = []
type Identity = { sub: string; email: string; email_verified: boolean; name: string }
let identity: Identity
const codes = new Map<string, { identity: Identity; challenge: string; redirect: string; nonce: string | null }>()
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), use: 'sig', alg: 'RS256', kid: 'local-google-test' }

function idToken(person: Identity, nonce: string | null) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const content = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ ...person, iss: oidcBase, aud: CLIENT_ID, iat: now, exp: now + 300, ...(nonce ? { nonce } : {}) })}`
  return `${content}.${sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`
}

class CookieJar {
  values = new Map<string, string>()
  constructor(cookie = '') { for (const part of cookie.split('; ').filter(Boolean)) this.put(part) }
  put(part: string) { const at = part.indexOf('='); this.values.set(part.slice(0, at), part.slice(at + 1)) }
  receive(response: Response) { for (const cookie of response.headers.getSetCookie()) this.put(cookie.split(';')[0]!) }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ') }
}

async function begin(jar = new CookieJar(), next = '/events') {
  const response = await fetch(`${enabledBase}/api/auth/google/start`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header(), 'x-forwarded-for': uniqueIp() },
    body: new URLSearchParams({ next }),
  })
  jar.receive(response)
  return { jar, url: response.headers.get('location')! }
}

async function finish(url: string, jar: CookieJar, allowConfigurationFailure = false) {
  const authorization = await fetch(url, { redirect: 'manual' })
  const response = await fetch(authorization.headers.get('location')!, { redirect: 'manual', headers: { cookie: jar.header() } })
  jar.receive(response)
  if (!allowConfigurationFailure && response.headers.get('location')?.includes('error=Configuration')) throw new Error(`OIDC callback configuration failed: ${providerLog.join('').slice(-3500)}`)
  return response
}

async function session(jar: CookieJar) {
  return (await fetch(`${enabledBase}/api/auth/session`, { headers: { cookie: jar.header() } })).json()
}

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

  oidc = http.createServer(async (req, res) => {
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
    const url = new URL(req.url!, oidcBase)
    if (url.pathname === '/siteverify') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const form = new URLSearchParams(Buffer.concat(chunks).toString())
      const token = form.get('response') ?? ''
      const action = token.startsWith('valid-token:') ? token.slice('valid-token:'.length) : ''
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
        success: form.get('secret') === 'integration-turnstile-secret' && action.length > 0,
        action,
        hostname: '127.0.0.1',
      }))
      return
    }
    if (url.pathname === '/authorize') {
      const code = randomUUID()
      codes.set(code, { identity: { ...identity }, challenge: url.searchParams.get('code_challenge')!, redirect: url.searchParams.get('redirect_uri')!, nonce: url.searchParams.get('nonce') })
      const callback = new URL(url.searchParams.get('redirect_uri')!)
      callback.searchParams.set('code', code)
      callback.searchParams.set('state', url.searchParams.get('state')!)
      res.writeHead(303, { location: callback.href }).end()
      return
    }
    if (url.pathname === '/token') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const form = new URLSearchParams(Buffer.concat(chunks).toString())
      const code = form.get('code')!
      const grant = codes.get(code)
      codes.delete(code)
      if (!grant || form.get('redirect_uri') !== grant.redirect || createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url') !== grant.challenge) {
        providerLog.push(JSON.stringify({ grantFound: Boolean(grant), redirectRequested: form.get('redirect_uri'), redirectExpected: grant?.redirect, pkceMatches: Boolean(grant) && createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url') === grant?.challenge }))
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
        access_token: 'local-identity-test', token_type: 'Bearer', expires_in: 300,
        id_token: idToken(grant.identity, grant.nonce), scope: 'openid email profile',
      }))
      return
    }
    if (url.pathname === '/jwks') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }))
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
    TURNSTILE_VERIFY_URL: `${oidcBase}/siteverify`,
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
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', ROOT, '-p', String(port), '-H', '127.0.0.1'], {
    cwd: os.tmpdir(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout?.on('data', chunk => providerLog.push(String(chunk)))
  server.stderr?.on('data', chunk => providerLog.push(String(chunk)))
  await waitFor(`${enabledBase}/login`, 90_000)
}, 150_000)

afterAll(async () => {
  if (server?.pid) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
    } else {
      server.kill('SIGTERM')
    }
  }
  await new Promise<void>((resolve) => (oidc ? oidc.close(() => resolve()) : resolve()))
  await closeDb()
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

  it('starts the exchange: 303 to the provider with PKCE, and remembers a safe return path', async () => {
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
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')

    const cookies = res.headers.getSetCookie().join('\n')
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

  it('completes a verified new identity, marks its email verified and stores no Google tokens', async () => {
    if (!ready()) throw new Error('A production build is required for OAuth callback acceptance')
    identity = { sub: 'google-new-person', email: 'Google.New@knest.test', email_verified: true, name: 'Google Test Person' }
    const flow = await begin()
    const response = await finish(flow.url, flow.jar)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/events')
    const signedIn = await session(flow.jar)
    expect(signedIn.user.email).toBe('google.new@knest.test')
    expect(signedIn.user.staffRole).toBeNull()
    expect(signedIn.user.onboardingComplete).toBe(false)
    expect(JSON.stringify(signedIn)).not.toMatch(/sessionToken|access_token|passwordHash/)
    const record = await db().query('select u.email_verified, a.access_token, a.refresh_token, a.id_token from app.users u join app.accounts a on a.user_id=u.id where u.id=$1', [signedIn.user.id])
    expect(record.rows[0].email_verified).toBeTruthy()
    expect(record.rows[0].access_token).toBeNull()
    expect(record.rows[0].refresh_token).toBeNull()
    expect(record.rows[0].id_token).toBeNull()
    const returning = await begin()
    await finish(returning.url, returning.jar)
    expect((await session(returning.jar)).user.id).toBe(signedIn.user.id)
  })

  it('rejects an unverified email and a callback missing the state/PKCE cookies', async () => {
    if (!ready()) throw new Error('A production build is required')
    identity = { sub: 'google-unverified', email: 'unverified.google@knest.test', email_verified: false, name: 'Unverified' }
    const flow = await begin()
    expect((await finish(flow.url, flow.jar)).headers.get('location')).toContain('error=AccessDenied')
    expect((await session(flow.jar))?.user).toBeUndefined()
    expect((await db().query('select id from app.users where email=$1', [identity.email])).rowCount).toBe(0)
    identity = { ...identity, email_verified: true }
    const lostCookies = await begin()
    const rejected = await finish(lostCookies.url, new CookieJar(), true)
    expect(rejected.headers.get('location')).toContain('error=GoogleSessionExpired')
    expect((await session(lostCookies.jar))?.user).toBeUndefined()
    const recovery = await fetch(rejected.headers.get('location')!)
    expect(await recovery.text()).toContain('Select Continue with Google to start again in this tab')
    const missingPkce = await begin()
    missingPkce.jar.values.delete('authjs.pkce.code_verifier')
    expect((await finish(missingPkce.url, missingPkce.jar)).headers.get('location')).toContain('error=GoogleSessionExpired')
    const tampered = await begin()
    tampered.jar.put('authjs.state=invalid-state-cookie')
    expect((await finish(tampered.url, tampered.jar, true)).headers.get('location')).toContain('error=')
    expect((await session(tampered.jar))?.user).toBeUndefined()
    // A fresh start recovers without changing or weakening either OAuth check.
    const retry = await begin()
    await finish(retry.url, retry.jar)
    expect((await session(retry.jar)).user.email).toBe(identity.email)
  })

  it('lets a Google-first member add a password to the same account using a single-use email link', async () => {
    if (!ready()) throw new Error('A production build is required')
    identity = { sub: 'google-password-setup', email: 'google-password-setup@knest.test', email_verified: true, name: 'Password Setup' }
    const flow = await begin()
    await finish(flow.url, flow.jar)
    const id = (await session(flow.jar)).user.id
    const setup = await fetch(`${enabledBase}/api/auth/password/setup`, {
      method: 'POST', headers: { cookie: flow.jar.header(), 'content-type': 'application/json' }, body: JSON.stringify({ email: 'another-person@knest.test' }),
    })
    expect(setup.status).toBe(200)
    const mail = readMail().filter(m => m.to.includes(identity.email)).at(-1)
    expect(mail).toBeTruthy()
    const link = new URL(decodeMailText(mail!.body).match(/http:\/\/[^\s]+\/reset\/confirm\?[^\s]+/)![0])
    expect(link.searchParams.get('next')).toBe('/dashboard/account')
    const changed = await fetch(`${enabledBase}/api/auth/password/reset/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
      body: JSON.stringify({ email: identity.email, token: link.searchParams.get('token'), password: PASSWORD }),
    })
    expect(changed.status).toBe(200)
    expect((await session(flow.jar))?.user).toBeUndefined()
    const passwordLogin = await fetch(`${enabledBase}/api/auth/password/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
      body: JSON.stringify({ email: identity.email, password: PASSWORD, ...captcha('login') }),
    })
    expect(passwordLogin.status).toBe(200)
    const passwordJar = new CookieJar()
    passwordJar.receive(passwordLogin)
    expect((await session(passwordJar)).user.id).toBe(id)
    const again = await begin()
    await finish(again.url, again.jar)
    expect((await session(again.jar)).user.id).toBe(id)
    expect((await db().query('select id from app.users where email=$1', [identity.email])).rowCount).toBe(1)
    expect((await fetch(`${enabledBase}/api/auth/password/setup`, { method: 'POST' })).status).toBe(401)
  })

  it('does not merge a password account by email; links only after password proof for the same session and email', async () => {
    if (!ready()) throw new Error('A production build is required')
    const email = 'google-existing-reviewer@knest.test'
    const id = await createUser({ email, staffRole: 'reviewer' })
    identity = { sub: 'google-existing-reviewer', email, email_verified: true, name: 'Reviewer' }
    const collision = await begin()
    expect((await finish(collision.url, collision.jar)).headers.get('location')).toContain('error=OAuthAccountNotLinked')
    const passwordSession = randomUUID()
    await db().query("insert into app.sessions (session_token,user_id,expires) values ($1,$2,now()+interval '1 hour')", [passwordSession, id])
    const jar = new CookieJar(`authjs.session-token=${passwordSession}`)
    const unintentional = await begin(jar)
    expect(new URL(unintentional.url).pathname).toBe('/dashboard/account')
    async function link(password: string) {
      const response = await fetch(`${enabledBase}/api/auth/google/link`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: jar.header(), 'x-forwarded-for': uniqueIp() }, body: JSON.stringify({ password }),
      })
      jar.receive(response)
      return response
    }
    expect((await link('incorrect-password')).status).toBe(400)
    const linkResponse = await link(PASSWORD)
    expect(linkResponse.status).toBe(200)
    const linkUrl = (await linkResponse.json()).url
    // A different logged-in browser cannot reuse the fresh proof.
    const stolen = new CookieJar(jar.header().split('; ').filter(x => !x.startsWith('authjs.session-token=')).join('; '))
    const other = await createUser({ email: 'google-other@knest.test' })
    const otherToken = randomUUID()
    await db().query("insert into app.sessions (session_token,user_id,expires) values ($1,$2,now()+interval '1 hour')", [otherToken, other])
    stolen.put(`authjs.session-token=${otherToken}`)
    expect((await finish(linkUrl, stolen)).headers.get('location')).toContain('GoogleLinkRequired')
    expect((await db().query("select user_id from app.accounts where provider='google' and provider_account_id=$1", [identity.sub])).rowCount).toBe(0)
    const freshLink = await link(PASSWORD)
    expect((await finish((await freshLink.json()).url, jar)).headers.get('location')).toContain('google=connected')
    const linked = await db().query("select user_id from app.accounts where provider='google' and provider_account_id=$1", [identity.sub])
    expect(linked.rows[0].user_id).toBe(id)
    const returning = await begin()
    await finish(returning.url, returning.jar)
    expect((await session(returning.jar)).user.staffRole).toBe('reviewer')
    await db().query('update app.users set is_active=false where id=$1', [id])
    const disabled = await begin()
    expect((await finish(disabled.url, disabled.jar)).headers.get('location')).toContain('error=AccessDenied')
    expect((await session(returning.jar))?.user).toBeUndefined()
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
