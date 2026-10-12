import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, PASSWORD, closeDb, createUser, db } from '../support/helpers'
import { newPage } from '../support/journey'

/**
 * Module 9: the account screens when the network misbehaves, in a real browser against the
 * production build. For each form: a request that never arrives says what happened, keeps what
 * was typed, gives the button back, and succeeds on the next try. A slow request shows progress
 * instead of looking frozen.
 */

let browser: Browser
const stamp = Date.now()
const NO_CONNECTION = /couldn.t confirm that request/i

beforeAll(async () => {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })
})
afterAll(async () => {
  await browser?.close()
  await closeDb()
})

async function abortOnce(page: Page, urlPart: string) {
  let aborted = 0
  const handler = (route: import('playwright').Route) => {
    aborted += 1
    return route.abort('failed')
  }
  await page.route(`**${urlPart}`, handler)
  return {
    count: () => aborted,
    restore: () => page.unroute(`**${urlPart}`, handler),
  }
}

describe('log in', () => {
  const email = `net-login-${stamp}@account.test`

  beforeAll(async () => {
    await createUser({ email, platformRole: 'student' })
    await db().query('update app.users set onboarding_completed_at = now() where email = $1', [email])
  })

  it('a dropped request says so, keeps the email, frees the button, and the retry signs in', async () => {
    const page = await newPage(browser)
    await page.goto(`${BASE()}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel('Email address').fill(email)
    await page.locator('input[name="password"]').fill(PASSWORD)

    const dropped = await abortOnce(page, '/api/auth/password/login')
    await page.getByRole('button', { name: /log in/i }).click()
    const alert = page.locator('form div[role="alert"]')
    await alert.waitFor({ timeout: 15_000 })
    expect(await alert.textContent()).toMatch(NO_CONNECTION)
    expect(dropped.count()).toBe(1)

    // what was typed is still there, and the button is usable again
    expect(await page.getByLabel('Email address').inputValue()).toBe(email)
    expect(await page.locator('input[name="password"]').inputValue()).toBe(PASSWORD)
    const button = page.getByRole('button', { name: /log in/i })
    expect(await button.isEnabled()).toBe(true)
    expect(await button.getAttribute('aria-busy')).toBe('false')

    await dropped.restore()
    await Promise.all([page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 60_000 }), button.click()])
    await page.context().close()
  })

  it('a slow request shows progress and still completes', async () => {
    const page = await newPage(browser)
    await page.goto(`${BASE()}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel('Email address').fill(email)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.route('**/api/auth/password/login', async (route) => {
      await new Promise((r) => setTimeout(r, 3_000))
      await route.continue()
    })
    await page.getByRole('button', { name: /log in/i }).click()
    // while it waits: busy, labelled, not clickable twice
    const busy = page.getByRole('button', { name: /authenticating/i })
    await busy.waitFor({ timeout: 5_000 })
    expect(await busy.getAttribute('aria-busy')).toBe('true')
    expect(await busy.isDisabled()).toBe(true)
    await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 60_000 })
    await page.context().close()
  })
})

describe('sign up', () => {
  it('a dropped request keeps every field, and the retry reaches "Check your email"', async () => {
    const email = `net-signup-${stamp}@account.test`
    const page = await newPage(browser)
    await page.goto(`${BASE()}/signup`, { waitUntil: 'networkidle' })
    await page.getByLabel('Full name').fill('Net Person')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Create password').fill(PASSWORD)

    const dropped = await abortOnce(page, '/api/auth/password/signup')
    await page.getByRole('button', { name: /create account/i }).click()
    const alert = page.locator('form div[role="alert"]')
    await alert.waitFor({ timeout: 15_000 })
    expect(await alert.textContent()).toMatch(NO_CONNECTION)
    expect(await page.getByLabel('Full name').inputValue()).toBe('Net Person')
    expect(await page.getByLabel('Email address').inputValue()).toBe(email)
    expect(await page.getByRole('button', { name: /create account/i }).isEnabled()).toBe(true)
    // nothing reached the server, so nothing was created
    expect((await db().query('select count(*)::int c from app.users where email = $1', [email])).rows[0].c).toBe(0)

    await dropped.restore()
    await Promise.all([
      page.waitForURL((u) => u.pathname === '/verify', { timeout: 60_000 }),
      page.getByRole('button', { name: /create account/i }).click(),
    ])
    await page.context().close()
  })
})

describe('password reset request', () => {
  it('a dropped request is reported, and the retry shows the check-your-email confirmation', async () => {
    const page = await newPage(browser)
    await page.goto(`${BASE()}/reset`, { waitUntil: 'networkidle' })
    await page.getByLabel('Institutional email').fill(`nobody-${stamp}@account.test`)

    const dropped = await abortOnce(page, '/api/auth/password/reset/request')
    await page.getByRole('button', { name: /send recovery link/i }).click()
    const alert = page.locator('p[role="alert"]:not([id])')
    await alert.waitFor({ timeout: 15_000 })
    expect(await alert.textContent()).toMatch(NO_CONNECTION)
    expect(await page.getByLabel('Institutional email').inputValue()).toBe(`nobody-${stamp}@account.test`)

    await dropped.restore()
    await page.getByRole('button', { name: /send recovery link/i }).click()
    await page.getByRole('heading', { level: 1, name: 'Check your email.' }).waitFor({ timeout: 30_000 })
    await page.context().close()
  })
})

describe('resend the verification link', () => {
  it('a dropped request is reported and the button works again', async () => {
    const page = await newPage(browser)
    await page.goto(`${BASE()}/verify?sent=1&email=${encodeURIComponent(`resend-${stamp}@account.test`)}`, { waitUntil: 'networkidle' })

    const dropped = await abortOnce(page, '/api/auth/password/verify/send')
    await page.getByRole('button', { name: 'Send it again' }).click()
    const alert = page.locator('p[role="alert"]:not([id])')
    await alert.waitFor({ timeout: 15_000 })
    expect(await alert.textContent()).toMatch(NO_CONNECTION)
    expect(await page.getByRole('button', { name: 'Send it again' }).isEnabled()).toBe(true)

    await dropped.restore()
    await page.getByRole('button', { name: 'Send it again' }).click()
    await page.getByText('Sent. Check your inbox.').waitFor({ timeout: 30_000 })
    await page.context().close()
  })
})

describe('confirming an email link', () => {
  it('a dropped confirmation is a retryable error, not "that link has expired"', async () => {
    const page = await newPage(browser)
    const dropped = await abortOnce(page, '/api/auth/password/verify/confirm')
    await page.goto(`${BASE()}/verify/confirm?email=${encodeURIComponent(`x-${stamp}@account.test`)}&token=${'a'.repeat(64)}`)
    await page.getByRole('heading', { level: 1, name: /couldn.t confirm your email/i }).waitFor({ timeout: 15_000 })
    expect(dropped.count()).toBeGreaterThanOrEqual(1)
    await dropped.restore()
    await page.getByRole('button', { name: 'Try again.' }).click()
    // the server now answers: this token is not real, so the honest answer is "expired"
    await page.getByRole('heading', { level: 1, name: 'That link has expired.' }).waitFor({ timeout: 15_000 })
    await page.context().close()
  })
})
