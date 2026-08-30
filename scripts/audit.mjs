/**
 * The mechanical half of the quality pass: axe violations, horizontal
 * overflow, and touch-target size, across every route and breakpoint.
 *
 *   node scripts/audit.mjs [--routes=/a,/b] [--widths=360,768,1280]
 *
 * Horizontal overflow is checked because it is the responsive failure that
 * is both the most common and the easiest to miss from a screenshot: a page
 * that scrolls sideways by 8px looks fine in a capture and feels broken in
 * the hand. Anything wider than the viewport is reported with the element
 * that caused it, so the fix is not a search.
 */
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const ROUTES = arg('routes', '/,/programs,/startups,/events,/resources,/mentors,/ecosystem,/about,/invest,/search,/login,/signup').split(',')
const WIDTHS = arg('widths', '360,768,1280').split(',').map(Number)
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let problems = 0

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  for (const route of ROUTES) {
    const page = await ctx.newPage()
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(300)

      // --- horizontal overflow ------------------------------------------
      const overflow = await page.evaluate((w) => {
        const doc = document.documentElement
        if (doc.scrollWidth <= w + 1) return null
        // Name the widest offender rather than just the fact of it.
        const worst = [...document.querySelectorAll('body *')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.right > w + 1)
          .sort((a, b) => b.r.right - a.r.right)[0]
        return {
          scrollWidth: doc.scrollWidth,
          culprit: worst
            ? `${worst.el.tagName.toLowerCase()}.${String(worst.el.className).slice(0, 70)} (right: ${Math.round(worst.r.right)})`
            : 'unknown',
        }
      }, width)
      if (overflow) {
        problems++
        console.log(`OVERFLOW  ${width}px ${route}  scrollWidth=${overflow.scrollWidth}\n            ${overflow.culprit}`)
      }

      // --- touch targets (mobile only) ----------------------------------
      if (width <= 414) {
        const small = await page.evaluate(() =>
          [...document.querySelectorAll('a, button, select, input[type="checkbox"], input[type="radio"]')]
            .filter((el) => {
              const r = el.getBoundingClientRect()
              if (r.width === 0 || r.height === 0) return false
              // Inline links inside a paragraph are text, not targets.
              if (el.tagName === 'A' && el.closest('p, li')) return false
              // A visually-hidden control (the skip link) is 1x1 until it is
              // focused, at which point it is full size. Measuring it in its
              // hidden state measures the wrong thing.
              const cs = getComputedStyle(el)
              if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return false
              return r.height < 44 || r.width < 24
            })
            .map((el) => {
              const r = el.getBoundingClientRect()
              return `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`
            })
            .slice(0, 5),
        )
        if (small.length) {
          problems++
          console.log(`TARGET    ${width}px ${route}`)
          for (const s of small) console.log(`            ${s}`)
        }
      }

      // --- axe (one width is enough for rule violations) -----------------
      if (width === 1280) {
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
        for (const v of violations) {
          problems++
          console.log(`AXE       ${route}  [${v.impact}] ${v.id}: ${v.help}`)
          for (const n of v.nodes.slice(0, 2)) console.log(`            ${n.target.join(' ')}`)
        }
      }
    } catch (e) {
      problems++
      console.log(`ERROR     ${width}px ${route}  ${String(e).slice(0, 120)}`)
    }
    await page.close()
  }
  await ctx.close()
}
await browser.close()
console.log(problems === 0 ? '\nclean' : `\n${problems} problem(s)`)
process.exitCode = problems ? 1 : 0
