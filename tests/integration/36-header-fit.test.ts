import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, login, uniqueIp, type Session } from '../support/helpers'

let browser: Browser
let session: Session
const WIDTHS = [768, 1023, 1024, 1100, 1279, 1280, 1366, 1440, 1535, 1536, 1920]

beforeAll(async () => {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })
  const email = `header-fit-${Date.now()}@example.test`
  await createUser({ email })
  const signedIn = await login(email)
  expect(signedIn).not.toBeNull()
  session = signedIn!
})

afterAll(async () => {
  await browser?.close()
  await closeDb()
})

describe.each([false, true])('public header fit (signed in: %s)', (signedIn) => {
  it.each(WIDTHS)('keeps every control reachable without overflow or overlap at %ipx', async (width) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() } })
    try {
      if (signedIn) {
        await context.addCookies(session.cookie.split('; ').map((pair) => {
          const i = pair.indexOf('=')
          return { name: pair.slice(0, i), value: pair.slice(i + 1), url: BASE() }
        }))
      }
      const page = await context.newPage()
      const response = await page.goto(`${BASE()}/privacy`, { waitUntil: 'networkidle' })
      expect(response?.status()).toBe(200)
      await page.evaluate(() => document.fonts.ready)
      const header = page.getByRole('banner')
      const menu = header.locator('button[aria-controls="mobile-nav"]')
      if (width < 1280) {
        const menuBox = (await menu.boundingBox())!
        expect(menuBox.width).toBeGreaterThanOrEqual(44)
        expect(menuBox.height).toBeGreaterThanOrEqual(44)
        await menu.click()
        await expect.poll(() => menu.getAttribute('aria-expanded')).toBe('true')
      } else {
        expect(await menu.isVisible()).toBe(false)
      }
      const nav = header.getByRole('navigation', { name: 'Main', exact: true }).filter({ visible: true })
      expect(await nav.getByRole('link').allTextContents()).toEqual(['Programs', 'Startups', 'Ecosystem', 'Events', 'Resources', 'About'])
      expect(await header.getByRole('link', { name: signedIn ? 'Dashboard' : 'Start building', exact: true }).filter({ visible: true }).isVisible()).toBe(true)
      if (width < 1280) {
        // The drawer scrolls its links above pinned account
        // controls. Verify every destination can be brought into that viewport.
        const navBounds = (await nav.boundingBox())!
        for (const link of await nav.getByRole('link').all()) {
          await link.scrollIntoViewIfNeeded()
          const bounds = (await link.boundingBox())!
          expect(bounds.y).toBeGreaterThanOrEqual(navBounds.y - 1)
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(navBounds.y + navBounds.height + 1)
        }
        await page.keyboard.press('Escape')
        await expect.poll(() => page.locator('#mobile-nav').count()).toBe(0)
      }
      const geometry = await header.evaluate((node) => {
        const controls = [...node.querySelectorAll('a, button')]
          .map((element) => ({ label: element.textContent?.trim() || element.getAttribute('aria-label'), rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        const outside = controls.filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1).map(({ label }) => label)
        const overlaps = controls.flatMap((first, i) => controls.slice(i + 1).filter((second) =>
          Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left) > 1 &&
          Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top) > 1,
        ).map((second) => `${first.label} / ${second.label}`))
        return { outside, overlaps, overflow: document.documentElement.scrollWidth - innerWidth }
      })
      expect(geometry).toEqual({ outside: [], overlaps: [], overflow: 0 })
    } finally {
      await context.close()
    }
  })
})
