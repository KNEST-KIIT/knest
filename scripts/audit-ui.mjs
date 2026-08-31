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
    `\nUI audit clean — ${PAGES.length} pages, ${WIDTHS.length} widths, axe WCAG 2.0/2.1/2.2 A+AA.` +
      (byKind['target-house'].length ? ' (Notes above are advisory.)' : ''),
  )
  process.exit(0)
}

console.log(`\n${failures} failing finding(s).`)
process.exit(1)
