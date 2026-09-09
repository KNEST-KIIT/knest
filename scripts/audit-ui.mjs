/**
 * The UI checks that only a real browser can make.
 *
 * `pnpm typecheck` and `pnpm test` were green throughout every defect this
 * script was written in response to: a doubled spacing unit that made the
 * homepage scroll sideways at tablet width, two undefined colour tokens that
 * rendered a whole section's heading cream on cream, a hero that drifted
 * 128px out of alignment above 1536px, and thirteen navigation links at 18px.
 * None of those are type errors or unit-test failures. They are things you
 * only find by loading the pages and measuring.
 *
 *   pnpm audit:ui                  # against a running dev server
 *   BASE_URL=… pnpm audit:ui       # against any deployment
 *
 * Signed-in routes are covered too when the seeded dev accounts exist. They
 * are skipped with a printed note rather than a failure when they don't, so
 * the script still runs against a deployment that has no seed data.
 *
 * Exits non-zero on a conformance failure, so it can gate a build. Targets
 * between the WCAG minimum and this app's own bar print as advisory notes and
 * do not fail the run.
 *
 * @axe-core/playwright and playwright are already devDependencies; this adds
 * no packages.
 */
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

const PAGES = [
  '/', '/programs', '/startups', '/events', '/ecosystem',
  '/resources', '/about', '/mentors', '/login', '/signup', '/search',
]

/* 390 and 414 are the common phone widths, 834 a portrait tablet, 768 and 1536
   the two breakpoints where a `container` utility changes its max-width — the
   hero's misalignment only existed at 1536 and up, so a sweep that stops at
   1440 would have missed it. */
const WIDTHS = [390, 414, 768, 834, 1024, 1280, 1440, 1536, 1920]

/* Signed-in routes. The dashboard redirects to onboarding until that flow is
   finished, which is correct behaviour, so a redirect here is reported as a
   redirect and not as a broken page. */
const ROLES = [
  {
    label: 'member',
    email: process.env.AUDIT_MEMBER_EMAIL ?? 'student@knest.local',
    pages: [
      '/dashboard',
      '/dashboard/events',
      '/dashboard/applications',
      '/dashboard/level',
      '/dashboard/labs',
      '/onboarding',
    ],
  },
  {
    // A KIIT professor who manages a lab: no staff role, and the one route
    // that exists only for them.
    label: 'lab manager',
    email: process.env.AUDIT_LAB_MANAGER_EMAIL ?? 'prof.mishra.demo@kiit.ac.in',
    pages: ['/dashboard/labs/manage'],
  },
  {
    label: 'staff',
    email: process.env.AUDIT_STAFF_EMAIL ?? 'admin@knest.local',
    pages: [
      '/admin/overview',
      '/admin/applications',
      '/admin/levels',
      '/admin/members',
      '/admin/analytics',
    ],
  },
]
const AUDIT_PASSWORD = process.env.SEED_PASSWORD ?? 'knest-dev-password'

/* WCAG 2.5.8 exempts a link inside a block of text, so a link in a sentence is
   not a finding; a nav item in a list is. */
const INLINE_CONTEXT = 'p, blockquote'

/* Two different thresholds, and conflating them makes the check useless.
   24px is WCAG 2.5.8 Target Size (Minimum) at AA — below it is a conformance
   failure and fails the run. 44px is this app's own bar, the one the button
   sizes and the header controls are built to; between the two is worth
   printing but is a design call, not a defect, so it does not fail. */
const WCAG_TARGET = 24
const HOUSE_TARGET = 44

const findings = []
const record = (kind, detail) => findings.push({ kind, detail })

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
})

/* ---- 1. Nothing may scroll horizontally, at any width ---- */
for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  for (const path of PAGES) {
    const response = await page.goto(BASE + path, { waitUntil: 'networkidle' })
    if (response?.status() !== 200) {
      record('status', `${path} returned ${response?.status()} at ${width}px`)
      continue
    }
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    if (scroll > client) {
      record('overflow', `${path} at ${width}px scrolls to ${scroll}px in a ${client}px viewport`)
    }
  }
  await context.close()
}

/* ---- 2. Interactive target sizes ---- */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const small = await page.evaluate(
      ([inlineContext, house]) => {
        const out = []
        for (const el of document.querySelectorAll('a[href], button')) {
          const box = el.getBoundingClientRect()
          if (!box.width || !box.height || el.offsetParent === null) continue
          if (box.height >= house || el.closest(inlineContext)) continue
          const label = (el.textContent || '').trim() || el.getAttribute('aria-label') || '(no text)'
          if (label === 'Skip to content') continue
          out.push({ h: Math.round(box.height), label: label.slice(0, 40) })
        }
        return out
      },
      [INLINE_CONTEXT, HOUSE_TARGET],
    )
    const seen = new Set()
    for (const { h, label } of small) {
      const line = `${path}  ${h}px — ${label}`
      if (seen.has(line)) continue
      seen.add(line)
      record(h < WCAG_TARGET ? 'target' : 'target-house', line)
    }
  }
  await context.close()
}

/* ---- 3. axe-core, with every reveal settled first ---- */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    // Scroll the whole page so scroll-triggered reveals reach their final
    // colours; axe run at the top would measure them mid-animation.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 110))
      }
    })
    await page.waitForTimeout(800)

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    for (const v of violations) {
      const where = v.nodes[0]?.failureSummary?.split('\n').filter(Boolean).at(-1) ?? ''
      record('axe', `${path}  [${v.impact}] ${v.id} — ${v.help}  (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}) ${where}`.slice(0, 240))
    }
  }
  await context.close()
}

/* ---- 4. Signed-in routes ---- */
const covered = []
{
  /* Log in once per role and reuse the cookies for every check. The login
     route is a 5-token bucket refilling over 15 minutes and keyed by IP, so a
     sweep that signs in per viewport rate-limits itself and then reports its
     own 429s as broken pages. */
  async function sessionFor(email) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    try {
      await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', AUDIT_PASSWORD)
      const settled = page.waitForResponse(
        (r) => r.url().includes('/api/auth/password/login'),
        { timeout: 20000 },
      )
      await page.click('button[type="submit"]')
      const response = await settled
      await page.waitForTimeout(1200)
      const signedIn = response.status() === 200 && !page.url().includes('/login')
      return signedIn ? await context.storageState() : { failed: response.status() }
    } catch {
      return { failed: 'no response' }
    } finally {
      await context.close()
    }
  }

  for (const role of ROLES) {
    const state = await sessionFor(role.email)
    if (state.failed) {
      console.log(
        `note: skipped the ${role.label} routes — could not sign in as ${role.email} (${state.failed}). ` +
          'Seed the dev accounts, or set AUDIT_MEMBER_EMAIL / AUDIT_STAFF_EMAIL / SEED_PASSWORD.',
      )
      continue
    }

    covered.push(role.label)
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: state })
    const page = await context.newPage()
    for (const path of role.pages) {
      const response = await page.goto(BASE + path, { waitUntil: 'networkidle' })
      if (response?.status() !== 200) {
        record('status', `${path} returned ${response?.status()} as ${role.label}`)
        continue
      }
      // A guard sending an unfinished member to onboarding is the product
      // working, not a finding — measure where we landed, not where we asked.
      if (new URL(page.url()).pathname !== path) continue
      await page.waitForTimeout(400)

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      for (const v of violations) {
        const where = v.nodes[0]?.failureSummary?.split('\n').filter(Boolean).at(-1) ?? ''
        record('axe', `${path} (${role.label})  [${v.impact}] ${v.id} — ${v.help}  (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}) ${where}`.slice(0, 240))
      }

      const small = await page.evaluate(
        ([inlineContext, house]) => {
          const out = []
          for (const el of document.querySelectorAll('a[href], button')) {
            const box = el.getBoundingClientRect()
            if (!box.width || !box.height || el.offsetParent === null) continue
            if (box.height >= house || el.closest(inlineContext)) continue
            const label = (el.textContent || '').trim() || el.getAttribute('aria-label') || '(no text)'
            if (label === 'Skip to content') continue
            out.push({ h: Math.round(box.height), label: label.slice(0, 40) })
          }
          return out
        },
        [INLINE_CONTEXT, HOUSE_TARGET],
      )
      const seen = new Set()
      for (const { h, label } of small) {
        const line = `${path} (${role.label})  ${h}px — ${label}`
        if (seen.has(line)) continue
        seen.add(line)
        record(h < WCAG_TARGET ? 'target' : 'target-house', line)
      }
    }

    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, storageState: state })
      const p2 = await ctx.newPage()
      for (const path of role.pages) {
        await p2.goto(BASE + path, { waitUntil: 'networkidle' })
        if (new URL(p2.url()).pathname !== path) continue
        const { scroll, client } = await p2.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }))
        if (scroll > client) {
          record('overflow', `${path} (${role.label}) at ${width}px scrolls to ${scroll}px in a ${client}px viewport`)
        }
      }
      await ctx.close()
    }

    await context.close()
  }
}

await browser.close()

const byKind = { status: [], overflow: [], target: [], axe: [], 'target-house': [] }
for (const f of findings) byKind[f.kind].push(f.detail)

const TITLES = {
  status: 'Pages that did not return 200',
  overflow: 'Horizontal overflow',
  target: `Targets under WCAG 2.5.8's ${WCAG_TARGET}px minimum`,
  axe: 'axe-core violations',
  'target-house': `Targets between ${WCAG_TARGET}px and this app's ${HOUSE_TARGET}px bar — conformant, listed for review`,
}

const FAILING = ['status', 'overflow', 'target', 'axe']
const failures = FAILING.reduce((n, k) => n + byKind[k].length, 0)

for (const kind of [...FAILING, 'target-house']) {
  const list = [...new Set(byKind[kind])]
  if (!list.length) continue
  console.log(`\n${TITLES[kind]} (${list.length}):`)
  for (const d of list) console.log(`  ${d}`)
}

if (failures === 0) {
  console.log(
    `\nUI audit clean — ${PAGES.length} public pages` +
      (covered.length ? ` plus the ${covered.join(' and ')} routes` : ' (signed-in routes skipped)') +
      `, ${WIDTHS.length} widths, axe WCAG 2.0/2.1/2.2 A+AA.` +
      (byKind['target-house'].length ? ' (Notes above are advisory.)' : ''),
  )
  process.exit(0)
}

console.log(`\n${failures} failing finding(s).`)
process.exit(1)
