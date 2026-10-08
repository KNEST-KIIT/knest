import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, PASSWORD, closeDb, createUser, db, decodeMailText, readMail, uniqueIp } from '../support/helpers'

/**
 * Closing evidence for KN-22e (open redirect), KN-22a (login timing) and a
 * regression pass over sign-in/sign-up on the upgraded stack (Next 16.4,
 * nodemailer 10). The redirect is exercised in a REAL browser, because the
 * vulnerable code is client-side (router.push).
 */

let browser: Browser

beforeAll(async () => {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })
  await createUser({ email: 'redirect@auth.test', platformRole: 'student' })
})
afterAll(async () => {
  await browser?.close()
  await closeDb()
})

const BS = String.fromCharCode(92)
const ATTACKS = [
  `//evil.example/pwned`,
  `/${BS}evil.example/pwned`,
  `https://evil.example/pwned`,
  `javascript:alert(1)`,
  `/${String.fromCharCode(9)}/evil.example/pwned`,
]

async function signIn(next: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() } })
  const page = await context.newPage()
  const foreign: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).hostname.includes('evil.example')) foreign.push(r.url())
  })
  await page.goto(`${BASE()}/login?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email address').fill('redirect@auth.test')
  await page.locator('input[name="password"]').fill(PASSWORD)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 }),
    page.getByRole('button', { name: /sign in|log in|continue|enter/i }).last().click(),
  ])
  await page.waitForLoadState('domcontentloaded')
  const finalUrl = new URL(page.url())
  await context.close()
  return { finalUrl, foreign }
}

describe('KN-22e: post-login redirect stays on our origin', () => {
  it.each(ATTACKS.map((a) => [JSON.stringify(a), a]))('next=%s', async (_label, attack) => {
    const { finalUrl, foreign } = await signIn(attack as string)
    expect(finalUrl.origin).toBe(new URL(BASE()).origin)
    expect(foreign).toEqual([])
  })

  it('still honours a legitimate same-origin next', async () => {
    const { finalUrl } = await signIn('/programs')
    expect(finalUrl.origin).toBe(new URL(BASE()).origin)
    expect(finalUrl.pathname).toBe('/programs')
  })

  it('sign-up with a hostile next also stays on our origin and sends the verification e-mail over SMTP', async () => {
    const email = `signup-${Date.now()}@auth.test`
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() } })
    const page = await context.newPage()
    const foreign: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).hostname.includes('evil.example')) foreign.push(r.url())
    })
    await page.goto(`${BASE()}/signup?next=${encodeURIComponent('//evil.example/pwned')}`)
    await page.getByLabel('Full name').fill('Test Person')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Create password').fill(PASSWORD)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/signup'), { timeout: 60_000 }),
      page.getByRole('button', { name: /create account/i }).click(),
    ])
    const finalUrl = new URL(page.url())
    await context.close()
    expect(finalUrl.origin).toBe(new URL(BASE()).origin)
    expect(foreign).toEqual([])
    expect(finalUrl.pathname).toMatch(/^\/onboarding/)

    // nodemailer 10 delivered a real message over SMTP, with an absolute link
    await expect
      .poll(() => readMail().find((m) => m.to.includes(email)), { timeout: 20_000 })
      .toBeTruthy()
    const mail = readMail().find((m) => m.to.includes(email))!
    // The link is absolute. Its host is NEXT_PUBLIC_SITE_URL, which Next inlines at BUILD
    // time, so here it is the build machine's value, not this test server's address.
    expect(decodeMailText(mail.body)).toMatch(/https?:\/\/[^\s]+\/verify\/confirm\?email=/)
  })
})

describe('KN-22a: login timing does not reveal which e-mails exist', () => {
  async function timeLogin(email: string): Promise<number> {
    const t0 = performance.now()
    const res = await fetch(`${BASE()}/api/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
      body: JSON.stringify({ email, password: 'wrong-password-entirely' }),
    })
    await res.arrayBuffer()
    expect(res.status).toBeGreaterThanOrEqual(400)
    return performance.now() - t0
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

  it('an unknown e-mail costs about as much as a known one (cost-12 hashes, like production)', async () => {
    await createUser({ email: 'known@timing.test', cost: 12 })
    await timeLogin('known@timing.test') // warm-up
    const known: number[] = []
    const unknown: number[] = []
    for (let i = 0; i < 7; i++) {
      known.push(await timeLogin('known@timing.test'))
      unknown.push(await timeLogin(`nobody-${i}@timing.test`))
    }
    const k = median(known)
    const u = median(unknown)
    // Before the fix an unknown e-mail returned in a few ms against ~hundreds for a known one.
    expect(u, `unknown ${u.toFixed(0)}ms vs known ${k.toFixed(0)}ms`).toBeGreaterThan(k * 0.6)
    expect(u).toBeLessThan(k * 1.7)
  })
})

describe('account state', () => {
  it('a deactivated account cannot sign in', async () => {
    await createUser({ email: 'off@auth.test', isActive: false })
    const res = await fetch(`${BASE()}/api/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
      body: JSON.stringify({ email: 'off@auth.test', password: PASSWORD }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const sessions = await db().query(
      "select count(*)::int c from app.sessions s join app.users u on u.id = s.user_id where u.email = 'off@auth.test'",
    )
    expect(sessions.rows[0].c).toBe(0)
  })
})
