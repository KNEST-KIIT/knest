/**
 * Screenshot harness for the visual QA loop.
 *
 * Usage:
 *   node scripts/shoot.mjs <url> <out.png> [widthxheight] [--full] [--reduce-motion]
 *                          [--scroll=<px|selector>]
 *
 * Defaults to a 1280x900 desktop viewport at 2x. Waits for fonts to settle
 * and for Motion's entrance animations to finish before capturing, so a
 * shot is never of a half-animated page — the single most common way an
 * automated screenshot pass produces misleading output.
 */
import { chromium } from 'playwright'

const [, , url, out, size = '1280x900', ...flags] = process.argv
if (!url || !out) {
  console.error('usage: node scripts/shoot.mjs <url> <out.png> [WxH] [--full] [--reduce-motion]')
  process.exit(1)
}

const [width, height] = size.split('x').map(Number)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 2,
  reducedMotion: flags.includes('--reduce-motion') ? 'reduce' : 'no-preference',
})

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
// Scroll the page once so `whileInView` reveals below the fold have fired,
// then return to the top — otherwise a full-page shot captures them mid-entrance.
if (flags.includes('--full')) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
}
// --scroll takes either a pixel offset or a selector to bring into view, so
// a tall page can be reviewed a screen at a time instead of as one
// unreadably long strip.
const scroll = flags.find((f) => f.startsWith('--scroll='))?.slice('--scroll='.length)
if (scroll) {
  if (/^\d+$/.test(scroll)) {
    await page.evaluate((y) => window.scrollTo(0, y), Number(scroll))
  } else {
    await page.locator(scroll).first().scrollIntoViewIfNeeded()
  }
  await page.waitForTimeout(700)
}

await page.waitForTimeout(900)
await page.screenshot({ path: out, fullPage: flags.includes('--full') })
await browser.close()

if (errors.length) {
  console.error(`\n${errors.length} console error(s):`)
  for (const e of errors.slice(0, 10)) console.error('  ' + e)
  process.exitCode = 1
} else {
  console.log('ok ' + out)
}
