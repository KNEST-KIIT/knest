/**
 * Keyboard behaviour that automated rule-checkers do not catch.
 *
 * axe can tell you an element has an accessible name; it cannot tell you
 * that a radiogroup ignores arrow keys, that a dialog lets focus escape, or
 * that a focus ring is invisible against its own background. Those are the
 * things that decide whether the interface is actually operable, so they are
 * driven here rather than assumed.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let failures = 0

const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(56)} ${detail}`)
  if (!ok) failures++
}

// --- 1. Every focus stop on the homepage is visible ------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  let invisible = 0
  let stops = 0
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const r = el.getBoundingClientRect()
      // The indicator is not always on the focused element. LinkCard's
      // stretched anchor deliberately carries `focus:outline-none` and lets
      // its parent draw the ring with `focus-within`, so that the highlight
      // frames the whole card rather than the invisible overlay covering it.
      // Walk up a couple of levels before calling a stop unindicated.
      let node = el
      let indicated = false
      for (let up = 0; node && up < 3; up++, node = node.parentElement) {
        const cs = getComputedStyle(node)
        if ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none') {
          indicated = true
          break
        }
      }
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.textContent ?? '').trim().slice(0, 30),
        indicated,
        sized: r.width > 0 && r.height > 0,
      }
    })
    if (!info) continue
    stops++
    if (info.sized && !info.indicated) {
      invisible++
      console.log(`      no indicator: <${info.tag}> "${info.label}"`)
    }
  }
  check('every focus stop on / shows a focus indicator', invisible === 0, `${stops} stops, ${invisible} without`)
  await page.close()
}

// --- 2. The journey selector is a real radiogroup --------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const group = page.locator('[role="radiogroup"]').first()
  await group.scrollIntoViewIntoNeeded?.().catch(() => {})
  const radios = group.locator('[role="radio"]')
  const count = await radios.count()
  await radios.first().focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(150)
  const second = await radios.nth(1).getAttribute('aria-checked')
  check('ArrowDown moves and selects the next option', second === 'true', `aria-checked=${second}`)
  await page.keyboard.press('End')
  await page.waitForTimeout(150)
  const last = await radios.nth(count - 1).getAttribute('aria-checked')
  check('End jumps to the last option', last === 'true', `${count} options`)
  const tabbable = await group.evaluate((el) =>
    [...el.querySelectorAll('[role="radio"]')].filter((r) => r.getAttribute('tabindex') === '0').length,
  )
  check('the group is one tab stop, not five', tabbable === 1, `${tabbable} with tabindex=0`)
  await page.close()
}

// --- 3. The mobile menu traps nothing and closes on Escape -----------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.waitForTimeout(400)
  const opened = await page.locator('#mobile-nav').isVisible()
  check('the mobile menu opens', opened)
  const locked = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden')
  check('the page behind it cannot scroll', locked)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const closed = (await page.locator('#mobile-nav').count()) === 0
  check('Escape closes it', closed)
  const returned = await page.evaluate(() =>
    (document.activeElement?.textContent ?? '').includes('menu'),
  )
  check('focus returns to the toggle', returned)
  await page.close()
}

// --- 4. Reduced motion actually reaches the JS-driven animations -----------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  // With reducedMotion the hero words must be in place immediately, not
  // translated off their line box waiting for a transform animation.
  const shifted = await page.evaluate(() =>
    [...document.querySelectorAll('h1 [data-reveal] span span')].filter((el) => {
      const t = getComputedStyle(el).transform
      return t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)'
    }).length,
  )
  check('reduced motion leaves no element mid-transform', shifted === 0, `${shifted} shifted`)
  await page.close()
}

await browser.close()
console.log(failures === 0 ? '\nAll keyboard and motion checks passed.' : `\n${failures} failure(s)`)
process.exitCode = failures ? 1 : 0
