/**
 * Measure real rendered geometry for a set of selectors.
 *
 * Usage: node scripts/measure.mjs <url> [WxH] <selector>...
 *
 * Exists because eyeballing a screenshot is not measurement — a 2x capture
 * downscaled for review makes every element look like a different size than
 * it is, and "that looks too big" is not something to act on before checking.
 */
import { chromium } from 'playwright'

const [, , url, size, ...selectors] = process.argv
const [width, height] = (size ?? '1280x900').split('x').map(Number)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width, height } })
await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(400)

const rows = await page.evaluate((sels) => {
  return sels.map((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { selector: sel, found: false }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      selector: sel,
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      x: +r.x.toFixed(1),
      y: +r.y.toFixed(1),
      font: cs.fontSize,
      pad: cs.padding,
    }
  })
}, selectors)
console.table(rows)
await browser.close()
