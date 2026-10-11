import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { BASE, decodeMailText, PASSWORD, readMail, uniqueIp, type CapturedMail, type Session } from './helpers'
import { stubTurnstileScript } from './turnstile-stub'

/** Shared plumbing for the browser journeys (36, 37, 38): a real Chrome, the stubbed human check, one address per visitor. */

export const launchBrowser = (): Promise<Browser> => chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })

/** A fresh visitor: own cookies, own client address (the rate limiter keys on it), Turnstile answered at once. */
export async function newContext(browser: Browser, session?: Session | null): Promise<BrowserContext> {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() }, reducedMotion: 'reduce' })
  await stubTurnstileScript(context)
  if (session) {
    await context.addCookies(
      session.cookie.split('; ').map((pair) => {
        const i = pair.indexOf('=')
        return { name: pair.slice(0, i), value: pair.slice(i + 1), url: BASE() }
      }),
    )
  }
  return context
}

export async function newPage(browser: Browser, session?: Session | null): Promise<Page> {
  return (await newContext(browser, session)).newPage()
}

/** Types an email and the shared test password into the real sign-in form. */
export async function signInThroughForm(page: Page, email: string, options: { next?: string; password?: string } = {}) {
  await page.goto(`${BASE()}/login${options.next ? `?next=${encodeURIComponent(options.next)}` : ''}`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(options.password ?? PASSWORD)
  await page.getByRole('button', { name: /log in/i }).click()
}

/** Messages the SMTP stub holds for one recipient, newest last. */
export const mailsTo = (to: string): CapturedMail[] => readMail().filter((m) => m.to.some((r) => r.includes(to)))

/** Waits for a message to `to` whose decoded text matches `pattern`, and returns that text. */
export async function waitForMailText(to: string, pattern: RegExp, timeoutMs = 20_000): Promise<string> {
  const until = Date.now() + timeoutMs
  for (;;) {
    for (const mail of mailsTo(to)) {
      const text = decodeMailText(mail.body)
      if (pattern.test(text) || pattern.test(mail.body)) return text
    }
    if (Date.now() > until) throw new Error(`no message to ${to} matching ${pattern} within ${timeoutMs}ms`)
    await new Promise((r) => setTimeout(r, 250))
  }
}

/** The first absolute link in a mail body that points back at this app. */
export function linkIn(text: string): string {
  const start = text.indexOf(BASE())
  if (start === -1) throw new Error('no link to ' + BASE() + ' in: ' + text)
  const rest = text.slice(start)
  const end = rest.search(/[\s"<>]/)
  return end === -1 ? rest : rest.slice(0, end)
}

/** The six adaptive onboarding steps, answered as a student; stops on the recommendation screen. */
export async function answerOnboarding(page: Page) {
  const step = (action: () => Promise<unknown>) => Promise.all([page.waitForResponse((r) => r.url().includes('/api/onboarding/step')), action()])
  await page.getByRole('radio', { name: 'Student' }).click()
  await step(() => page.getByRole('button', { name: 'Continue' }).click())
  await page.getByRole('checkbox').first().click()
  await step(() => page.getByRole('button', { name: 'Continue' }).click())
  await page.getByRole('radio').first().click()
  await step(() => page.getByRole('button', { name: 'Continue' }).click())
  await step(() => page.getByRole('button', { name: /skip for now/i }).click())
  await step(() => page.getByRole('button', { name: 'Continue' }).click())
}

/** The closing button of onboarding, whatever the recommender chose to call it. */
export const ONBOARDING_CTA = /find a program|see programs|see what.s on|get in touch|complete profile/i
