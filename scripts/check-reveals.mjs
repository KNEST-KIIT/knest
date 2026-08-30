/**
 * Every element the motion primitives animate must end up visible.
 *
 * A scroll reveal starts at opacity 0 and is brought in by JavaScript, so a
 * mistake here does not throw or fail a build — it silently hides content.
 * This walks the page, scrolls it end to end, then asserts that nothing
 * carrying `data-reveal` (or inside one) is still transparent.
 */
import { chromium } from 'playwright'

const url = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let failures = 0

for (const reduced of [false, true]) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 200))
    }
  })
  await page.waitForTimeout(1200)
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('[data-reveal]')]
      .filter((el) => Number(getComputedStyle(el).opacity) < 0.99)
      .map((el) => el.tagName + '.' + String(el.className).slice(0, 60)),
  )
  const total = await page.evaluate(() => document.querySelectorAll('[data-reveal]').length)
  const tag = reduced ? 'reduced-motion' : 'normal'
  if (hidden.length) {
    failures++
    console.error(`FAIL [${tag}] ${hidden.length}/${total} revealed elements still transparent:`)
    for (const h of hidden.slice(0, 8)) console.error('   ' + h)
  } else {
    console.log(`ok   [${tag}] all ${total} revealed elements visible`)
  }
  await page.close()
}
await browser.close()
process.exitCode = failures ? 1 : 0
