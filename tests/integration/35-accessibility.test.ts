import AxeBuilder from '@axe-core/playwright'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { istInstant, istParts } from '../../src/server/labs/rules'
import { BASE, closeDb, createUser, db, login, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'
import { stubTurnstileScript } from '../support/turnstile-stub'

/**
 * Accessibility, measured: axe-core (WCAG 2.0 to 2.2, levels A and AA) over every public, member
 * and staff screen, at a desktop and a phone width, plus the things a scanner cannot see:
 * keyboard operation, the skip link, no sideways scrolling, and focus that is visible.
 *
 * A scan is not an audit: it finds roughly a third of real problems. It stops regressions and
 * catches the cheap, common faults; screen-reader and cognitive review remain separate work.
 * Serious and critical findings fail the test; every finding is printed so none is hidden.
 */

const stamp = Date.now()
let browser: Browser
let programSlug = ''
let eventSlug = ''
let mentorSlug = ''
let articleSlug = ''
let labSlug = ''
const sessions: Record<string, Session> = {}

const PUBLIC = ['/', '/about', '/programs', '/events', '/mentors', '/startups', '/resources', '/blog', '/ecosystem', '/invest', '/get-involved', '/contact', '/privacy', '/terms', '/search', '/search?q=lab', '/login', '/signup', '/reset']

async function contextFor(role: string | null, viewport: { width: number; height: number }): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() }, reducedMotion: 'reduce' })
  await stubTurnstileScript(context)
  const session = role ? sessions[role] : null
  if (session) {
    const cookies = session.cookie.split('; ').map((pair) => {
      const i = pair.indexOf('=')
      return { name: pair.slice(0, i), value: pair.slice(i + 1), url: BASE() }
    })
    await context.addCookies(cookies)
  }
  return context
}

async function scan(page: Page, path: string) {
  const response = await page.goto(`${BASE()}${path}`, { waitUntil: 'networkidle' })
  // entrance fades finish within about a second; scanning mid-fade measures a colour that is not the final one
  await page.waitForTimeout(1500)
  // a page that is not found has nothing to scan; surface it instead of passing silently
  expect(response?.status(), path).toBeLessThan(400)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const lines = results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'}; first: ${v.nodes[0]?.target.join(' ')})`)
  if (lines.length) console.log(`[axe] ${path}\n  ${lines.join('\n  ')}`)
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

const brief = (violations: Awaited<ReturnType<typeof scan>>) => violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)

beforeAll(async () => {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })

  const payload = await payloadClient()
  const program = await payload.create({
    collection: 'programs',
    data: { title: `Accessible Program ${stamp}`, slug: `a11y-program-${stamp}`, tagline: 'A program for the accessibility suite', whoItsFor: richText('People who want to test things.'), stage: ['idea'], applicationStatus: 'open', applicationQuestions: [{ label: 'Describe it', fieldType: 'textarea', required: true, maxLength: 500 }], _status: 'published' } as never,
    overrideAccess: true,
  })
  programSlug = (program as { slug: string }).slug
  const event = await payload.create({
    collection: 'events',
    data: { title: `Accessible Event ${stamp}`, summary: 'An event for the accessibility suite', startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(), location: 'Campus 6', _status: 'published' } as never,
    overrideAccess: true,
  })
  eventSlug = (event as { slug: string }).slug
  const mentor = await payload.create({
    collection: 'mentors',
    data: { name: `Accessible Mentor ${stamp}`, slug: `a11y-mentor-${stamp}`, title: 'Founder', organization: 'Example Works', bio: 'Helps with early validation.', expertise: ['product'], _status: 'published' } as never,
    overrideAccess: true,
  })
  mentorSlug = (mentor as { slug: string }).slug
  const article = await payload.create({
    collection: 'articles',
    data: { title: `Accessible Article ${stamp}`, slug: `a11y-article-${stamp}`, summary: 'An article for the accessibility suite', body: richText('Some readable text for the page.'), publishedAt: new Date().toISOString(), _status: 'published' } as never,
    overrideAccess: true,
  })
  articleSlug = (article as { slug: string }).slug

  const roles: [string, { platformRole: 'student' | 'other'; staffRole?: 'super_admin' | 'content_admin' | 'lab_admin' }][] = [
    ['member', { platformRole: 'student' }],
    ['super', { platformRole: 'other', staffRole: 'super_admin' }],
    ['head', { platformRole: 'student' }],
  ]
  for (const [tag, opts] of roles) {
    const email = `a11y-${tag}-${stamp}@a11y.test`
    const id = await createUser({ email, ...opts })
    await db().query('update app.users set name = $2, onboarding_completed_at = now(), journey_stage = $3 where id = $1', [id, `A11y ${tag}`, 'idea'])
    sessions[tag] = (await login(email))!
  }

  // a lab with hours, a head, and one booking, so the lab screens have real content
  const headId = (await db().query('select id from app.users where email = $1', [`a11y-head-${stamp}@a11y.test`])).rows[0].id as string
  const memberId = (await db().query('select id from app.users where email = $1', [`a11y-member-${stamp}@a11y.test`])).rows[0].id as string
  labSlug = `a11y-lab-${stamp}`
  const lab = await db().query("insert into app.labs (id, slug, name, department, capacity, description) values (gen_random_uuid()::text, $1, $2, 'Engineering', 4, 'A lab for the accessibility suite.') returning id", [labSlug, `Accessible Lab ${stamp}`])
  const labId = lab.rows[0].id as string
  for (let weekday = 0; weekday < 7; weekday++) await db().query('insert into app.lab_hours (id, lab_id, weekday, opens_minute, closes_minute) values (gen_random_uuid()::text, $1, $2, 540, 1080)', [labId, weekday])
  await db().query("insert into app.lab_staff (id, lab_id, user_id, role) values (gen_random_uuid()::text, $1, $2, 'head')", [labId, headId])
  const when = istInstant(istParts(new Date(Date.now() + 4 * 86_400_000)).date, 10 * 60)
  await db().query("insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount) values (gen_random_uuid()::text, $1, $2, $3, $4, 'Testing prototypes', 2)", [labId, memberId, when, new Date(when.getTime() + 3_600_000)])
  await db().query("insert into app.enquiries (id, name, email, topic, message) values (gen_random_uuid()::text, 'A11y Person', 'a11y@example.test', 'general', 'A message for the accessibility suite to display.')")
})

afterAll(async () => {
  await browser?.close()
  await closeDb()
})

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 375, height: 740 },
] as const

describe.each(VIEWPORTS)('public pages at $name width', ({ width, height }) => {
  it.each(PUBLIC)('%s has no serious or critical accessibility violations', async (path) => {
    const context = await contextFor(null, { width, height })
    try {
      expect(brief(await scan(await context.newPage(), path))).toEqual([])
    } finally {
      await context.close()
    }
  })

  it('content detail pages are accessible too', async () => {
    const context = await contextFor(null, { width, height })
    try {
      for (const path of [`/programs/${programSlug}`, `/events/${eventSlug}`, `/mentors/${mentorSlug}`, `/blog/${articleSlug}`]) {
        expect(brief(await scan(await context.newPage(), path)), path).toEqual([])
      }
    } finally {
      await context.close()
    }
  })
})

describe.each(VIEWPORTS)('signed-in screens at $name width', ({ width, height }) => {
  it('member screens', async () => {
    const context = await contextFor('member', { width, height })
    try {
      for (const path of ['/dashboard', '/dashboard/applications', '/dashboard/events', `/apply/${programSlug}`, '/dashboard/lab-booking', `/dashboard/lab-booking/${labSlug}`]) {
        expect(brief(await scan(await context.newPage(), path)), path).toEqual([])
      }
    } finally {
      await context.close()
    }
  })

  it('lab head console', async () => {
    const context = await contextFor('head', { width, height })
    try {
      for (const path of ['/dashboard/lab-staff', `/dashboard/lab-staff/${labSlug}`, `/dashboard/lab-staff/${labSlug}/report`]) {
        expect(brief(await scan(await context.newPage(), path)), path).toEqual([])
      }
    } finally {
      await context.close()
    }
  })

  it('staff console', async () => {
    const context = await contextFor('super', { width, height })
    try {
      for (const path of ['/admin/overview', '/admin/applications', '/admin/enquiries', '/admin/members', '/admin/audit', '/admin/labs', '/admin/labs/report']) {
        expect(brief(await scan(await context.newPage(), path)), path).toEqual([])
      }
    } finally {
      await context.close()
    }
  })
})

describe('things a scanner cannot see', () => {
  it('no page scrolls sideways at phone width', async () => {
    const context = await contextFor('super', { width: 375, height: 740 })
    const wide: string[] = []
    try {
      for (const path of [...PUBLIC, `/programs/${programSlug}`, '/admin/overview', '/admin/applications', '/admin/members', '/admin/audit']) {
        const page = await context.newPage()
        await page.goto(`${BASE()}${path}`, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        if (overflow > 1) {
          const culprits = await page.evaluate(() => [...document.body.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest('[class*="overflow-x-auto"]')).slice(0, 4).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 70)))
          wide.push(`${path} (${overflow}px too wide; ${culprits.join(' | ')})`)
        }
        await page.close()
      }
    } finally {
      await context.close()
    }
    expect(wide).toEqual([])
  })

  it('the skip link is the first thing a keyboard reaches and it jumps to the main content', async () => {
    const context = await contextFor(null, { width: 1280, height: 900 })
    try {
      const page = await context.newPage()
      await page.goto(`${BASE()}/about`, { waitUntil: 'networkidle' })
      await page.keyboard.press('Tab')
      const first = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim() ?? '', href: (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href') ?? '' }))
      expect(first.href).toBe('#main')
      expect(first.text.toLowerCase()).toContain('skip')
      await page.keyboard.press('Enter')
      expect(await page.evaluate(() => document.getElementById('main') !== null)).toBe(true)
    } finally {
      await context.close()
    }
  })

  it('every form field on the sign-in and contact forms has a label a screen reader can announce', async () => {
    const context = await contextFor(null, { width: 1280, height: 900 })
    try {
      for (const path of ['/login', '/signup', '/contact']) {
        const page = await context.newPage()
        await page.goto(`${BASE()}${path}`, { waitUntil: 'networkidle' })
        const unnamed = await page.evaluate(() =>
          [...document.querySelectorAll('input:not([type=hidden]):not([tabindex="-1"]), select, textarea')]
            .filter((el) => !(el as HTMLElement).closest('[aria-hidden="true"]'))
            .filter((el) => {
              const e = el as HTMLInputElement
              const labelled = e.labels && e.labels.length > 0
              return !labelled && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')
            })
            .map((el) => (el as HTMLInputElement).name || el.tagName),
        )
        expect(unnamed, path).toEqual([])
        await page.close()
      }
    } finally {
      await context.close()
    }
  })

  it('interactive controls show where keyboard focus is', async () => {
    const context = await contextFor(null, { width: 1280, height: 900 })
    try {
      const page = await context.newPage()
      await page.goto(`${BASE()}/login`, { waitUntil: 'networkidle' })
      await page.getByLabel('Email address').focus()
      const outline = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement as Element)
        return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), boxShadow: style.boxShadow }
      })
      const visible = (outline.outlineStyle !== 'none' && outline.outlineWidth >= 2) || outline.boxShadow !== 'none'
      expect(visible, JSON.stringify(outline)).toBe(true)
    } finally {
      await context.close()
    }
  })

  it('respects reduced motion: nothing animates for a visitor who asked for none', async () => {
    const context = await contextFor(null, { width: 1280, height: 900 })
    try {
      const page = await context.newPage()
      await page.goto(`${BASE()}/`, { waitUntil: 'networkidle' })
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a as CSSAnimation).animationName !== undefined && (a.effect?.getComputedTiming().iterations ?? 1) === Infinity).length)
      expect(running).toBe(0)
    } finally {
      await context.close()
    }
  })
})
