import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE_URL = 'http://127.0.0.1:3000'
const PASSWORD = 'Knest-Local-Test-2026!'
const AUDIT_CLIENT_IP = '127.0.0.1'
// Cloudflare's public dummy token. The local production preview pairs it with
// Cloudflare's published always-pass test keys; it is never valid in production.
const LOCAL_TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

interface AuditResult {
  suite: string
  name: string
  status: 'PASS' | 'FAIL'
  details?: string
}

const results: AuditResult[] = []

function record(suite: string, name: string, passed: boolean, details?: string) {
  const r: AuditResult = {
    suite,
    name,
    status: passed ? 'PASS' : 'FAIL',
    details,
  }
  results.push(r)
  const symbol = passed ? '✓' : '✗'
  console.log(`  ${symbol} [${suite}] ${name}${details ? ` (${details})` : ''}`)
}

async function logStateDiagnostic(page: Page, stepName: string) {
  const url = page.url()
  const heading = (await page.textContent('h1, h2').catch(() => null)) ?? 'no heading'
  const textSnippet = (await page.evaluate(() => document.body.innerText.slice(0, 150).replace(/\n+/g, ' ')).catch(() => ''))
  console.warn(`  [DIAGNOSTIC] ${stepName} | URL: ${url} | Heading: "${heading.trim()}" | Body: "${textSnippet}"`)
}

const PERSONA_IPS: Record<string, string> = {
  'student-ready@knest.local': '127.0.1.1',
  'student@knest.local': '127.0.1.2',
  'founder@knest.local': '127.0.1.3',
  'mentor@knest.local': '127.0.1.4',
  'investor@knest.local': '127.0.1.5',
  'reviewer@knest.local': '127.0.1.6',
  'admin@knest.local': '127.0.1.7',
}

// Session cache to reuse authenticated state per persona without rotating IPs or spamming logins
const sessionCache = new Map<string, string>()

async function getOrCreateSessionToken(email: string): Promise<string> {
  const cached = sessionCache.get(email)
  if (cached) return cached

  const clientIp = PERSONA_IPS[email] || AUDIT_CLIENT_IP
  const res = await fetch(`${BASE_URL}/api/auth/password/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify({ email, password: PASSWORD, turnstileToken: LOCAL_TURNSTILE_TOKEN }),
  })
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`)
  const cookie = res.headers.get('set-cookie') || ''
  const match = cookie.match(/authjs\.session-token=([^;]+)/)
  if (!match || !match[1]) throw new Error(`No session token cookie returned for ${email}`)

  sessionCache.set(email, match[1])
  return match[1]
}

async function createAuthenticatedContext(
  browser: Browser,
  email: string,
  viewport = { width: 1280, height: 800 }
): Promise<BrowserContext> {
  const token = await getOrCreateSessionToken(email)
  const clientIp = PERSONA_IPS[email] || AUDIT_CLIENT_IP
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: { 'x-forwarded-for': clientIp },
  })
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: token,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  return context
}

function configurePage(page: Page) {
  page.setDefaultTimeout(90000)
  page.setDefaultNavigationTimeout(90000)
}

async function runAudit() {
  console.log('\n========================================')
  console.log('STARTING LOCAL BROWSER ACCEPTANCE PASS (SYNTHETIC PERSONAS)')
  console.log('========================================\n')

  // ----------------------------------------------------
  // SUITE 0: Real Login Rate Limiting (Throttle Proof)
  // ----------------------------------------------------
  // This probe writes a disposable rate-limit bucket. Keep the ordinary UX
  // acceptance pass read-only with respect to that security state; run the
  // probe explicitly when validating the throttle itself.
  if (process.env.AUDIT_MUTATING_SECURITY_PROBES === 'true') {
    console.log('Suite 0: Local Login Rate Limiter Assertion (explicit mutating probe)')
    const throttleIp = '10.99.188.188'
    let throttled = false
    let attempts = 0
    for (let i = 0; i < 12; i++) {
      attempts++
      const res = await fetch(`${BASE_URL}/api/auth/password/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': throttleIp,
        },
        body: JSON.stringify({ email: 'student@knest.local', password: 'Wrong-Password-123!' }),
      })
      if (res.status === 429) {
        throttled = true
        break
      }
    }
    record('Security-RateLimit', 'Login endpoint returns HTTP 429 under repeated local failure', throttled, `throttled at attempt ${attempts}`)
  } else {
    console.log('Suite 0: Security throttle probe skipped (set AUDIT_MUTATING_SECURITY_PROBES=true to run)')
  }

  const browser = await chromium.launch({ headless: true })

  try {
    // ----------------------------------------------------
    // 1. PUBLIC HOMEPAGE DESKTOP (1280x800)
    // ----------------------------------------------------
    console.log('\nSuite 1: Public Homepage (Desktop 1280x800)')
    const desktopPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { 'x-forwarded-for': AUDIT_CLIENT_IP },
    })
    configurePage(desktopPage)
    await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    const title = await desktopPage.title()
    record('Homepage-Desktop', 'Page loads with correct title', title.includes('KNEST'))

    const overflowDesktop = await desktopPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Homepage-Desktop', 'Zero horizontal scroll overflow (1280px)', overflowDesktop)

    // Check Journey Selector
    const radios = desktopPage.locator('[role="radiogroup"] [role="radio"]')
    const radioCount = await radios.count()
    record('Homepage-Desktop', 'Journey selector displays 5 stages', radioCount === 5, `found ${radioCount}`)

    // Test keyboard navigation (ArrowDown / ArrowUp)
    if (radioCount >= 2) {
      // DOMContentLoaded can precede React hydration in dev mode. Wait until
      // the server-rendered control has its client event props before sending
      // keyboard input, otherwise this assertion only measures test timing.
      await desktopPage.waitForFunction(() => {
        const firstRadio = document.querySelector('[role="radiogroup"] [role="radio"]')
        return Boolean(firstRadio && Object.keys(firstRadio).some((key) => key.startsWith('__reactProps$')))
      })
      await radios.first().scrollIntoViewIfNeeded()
      await radios.first().focus()
      await desktopPage.waitForTimeout(200)
      await desktopPage.keyboard.press('ArrowDown')
      await desktopPage.waitForTimeout(500)
      const secondSelected = await radios.nth(1).getAttribute('aria-checked')
      const firstAfterDown = await radios.first().getAttribute('aria-checked')
      record('Homepage-Desktop', 'Journey selector ArrowDown moves to next radio', secondSelected === 'true', `first=${firstAfterDown}, second=${secondSelected}`)

      await desktopPage.keyboard.press('ArrowUp')
      await desktopPage.waitForTimeout(500)
      const firstSelected = await radios.first().getAttribute('aria-checked')
      record('Homepage-Desktop', 'Journey selector ArrowUp returns to previous radio', firstSelected === 'true', `first=${firstSelected}`)

      await radios.nth(1).click()
      const storedChoiceBeforeReload = await desktopPage.evaluate(() => sessionStorage.getItem('knest_journey_choice'))
      await desktopPage.reload({ waitUntil: 'domcontentloaded' })
      const restoredRadios = desktopPage.locator('[role="radiogroup"] [role="radio"]')
      await restoredRadios.nth(1).waitFor({ state: 'visible' })
      await desktopPage.waitForFunction(
        () => document.querySelectorAll('[role="radiogroup"] [role="radio"]')[1]?.getAttribute('aria-checked') === 'true',
        undefined,
        { timeout: 5000 },
      ).catch(() => undefined)
      const restoredSecond = await restoredRadios.nth(1).getAttribute('aria-checked')
      const storedChoiceAfterReload = await desktopPage.evaluate(() => sessionStorage.getItem('knest_journey_choice'))
      record(
        'Homepage-Desktop',
        'Journey choice survives a reload in the same tab',
        storedChoiceBeforeReload === '1' && storedChoiceAfterReload === '1' && restoredSecond === 'true',
        `storedBefore=${storedChoiceBeforeReload}, storedAfter=${storedChoiceAfterReload}, second=${restoredSecond}`,
      )

      const tabStops = await restoredRadios.evaluateAll((elements) =>
        elements.filter((element) => element.getAttribute('tabindex') === '0').length,
      )
      record('Homepage-Desktop', 'Journey selector exposes exactly one keyboard tab stop', tabStops === 1, `tabStops=${tabStops}`)
    }

    // Check Narrative section (Problem, Person, KNEST independent sections)
    const problemHeading = desktopPage.locator('h2:has-text("HARDEST PART"), h2:has-text("Problem")').first()
    const personHeading = desktopPage.locator('h2:has-text("ENTREPRENEUR"), h2:has-text("Person")').first()
    const knestHeading = desktopPage.locator('h2:has-text("KNEST IS WHERE"), h2:has-text("KNEST")').first()
    record('Homepage-Desktop', 'Problem narrative section rendered independently', (await problemHeading.count()) > 0)
    record('Homepage-Desktop', 'Person narrative section rendered independently', (await personHeading.count()) > 0)
    record('Homepage-Desktop', 'KNEST narrative section rendered independently', (await knestHeading.count()) > 0)

    // Check Curated Ecosystem
    const curatedHeading = desktopPage.locator('text=Ecosystem').first()
    record('Homepage-Desktop', 'Curated ecosystem section rendered', (await curatedHeading.count()) > 0)

    // Check Safe External Links
    const unsafeLinks = await desktopPage.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[target="_blank"]'))
      return anchors.filter((a) => {
        const rel = a.getAttribute('rel') || ''
        return !rel.includes('noopener') || !rel.includes('noreferrer')
      }).length
    })
    record('Homepage-Desktop', 'All target=_blank links have rel="noopener noreferrer"', unsafeLinks === 0, `unsafe=${unsafeLinks}`)

    await desktopPage.close()

    // ----------------------------------------------------
    // 2. PUBLIC HOMEPAGE MOBILE (390x844 Viewport)
    // ----------------------------------------------------
    console.log('\nSuite 2: Public Homepage (Mobile 390x844)')
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { 'x-forwarded-for': AUDIT_CLIENT_IP },
    })
    configurePage(mobilePage)
    await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    const overflowMobile = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Homepage-Mobile-390px', 'Zero horizontal scroll overflow (390px)', overflowMobile)

    const mobileRadios = mobilePage.locator('[role="radiogroup"] [role="radio"]')
    record('Homepage-Mobile-390px', 'Journey selector visible on 390px mobile', (await mobileRadios.count()) === 5)

    await mobilePage.close()

    // ----------------------------------------------------
    // 3. ONBOARDING AUDIT (390px Phone & Desktop)
    // ----------------------------------------------------
    console.log('\nSuite 3: Onboarding Flow (390px Phone & Desktop)')
    const onbContext = await createAuthenticatedContext(browser, 'student-ready@knest.local', { width: 390, height: 844 })
    const onbPage = await onbContext.newPage()
    configurePage(onbPage)
    await onbPage.goto(`${BASE_URL}/onboarding`, { waitUntil: 'domcontentloaded' })

    const onbOverflow = await onbPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Onboarding-Mobile-390px', 'Zero horizontal overflow on /onboarding at 390px', onbOverflow)

    const onbHeading = await onbPage.textContent('h1, h2')
    record('Onboarding-Mobile-390px', 'Onboarding view renders cleanly', Boolean(onbHeading))
    await onbContext.close()

    // ----------------------------------------------------
    // 4. APPLICATION FORM AUDIT (READ-ONLY)
    // ----------------------------------------------------
    console.log('\nSuite 4: Application Form State (390px, read-only)')
    const applyContext = await createAuthenticatedContext(browser, 'student-ready@knest.local', { width: 390, height: 844 })
    const applyPage = await applyContext.newPage()
    configurePage(applyPage)
    await applyPage.goto(`${BASE_URL}/apply/ignite-ideation`, { waitUntil: 'domcontentloaded' })

    const applyOverflow = await applyPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Application-Mobile-390px', 'Zero horizontal overflow on /apply/ignite-ideation at 390px', applyOverflow)

    const startBtn = applyPage.locator('button:has-text("Start application")')
    const existingDraftPresent = (await startBtn.count()) === 0
    if (!existingDraftPresent) {
      await logStateDiagnostic(applyPage, 'Expected preserved synthetic application draft')
    }
    record('Application', 'Preserved synthetic applicant has an existing application (no draft creation)', existingDraftPresent)

    const applicationControl = applyPage.locator('button:has-text("Save & continue"), button:has-text("Continue"), [role="progressbar"], button:has-text("Submit application"), button:has-text("Save and exit")').first()
    const formPresent = (await applicationControl.count()) > 0
    if (!formPresent) {
      await logStateDiagnostic(applyPage, 'Application form presence')
    }
    record('Application', 'Application form renders at /apply/ignite-ideation', formPresent)

    if (formPresent) {
      const editableControls = await applyPage.locator('input, textarea, select, button').count()
      record('Application', 'Application form exposes interactive controls without changing answers', editableControls > 0, `controls=${editableControls}`)
    }
    await applyContext.close()

    // ----------------------------------------------------
    // 5. STUDENT DASHBOARD AUDIT (390px & Desktop)
    // ----------------------------------------------------
    console.log('\nSuite 5: Student Dashboard (390px & Desktop)')
    const studentContext = await createAuthenticatedContext(browser, 'student@knest.local', { width: 390, height: 844 })
    const studentPage = await studentContext.newPage()
    configurePage(studentPage)
    await studentPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })

    const studentOverflow = await studentPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Student-Dashboard-390px', 'Zero horizontal overflow on student dashboard at 390px', studentOverflow)

    const nextStepCard = studentPage.getByText(/Accepted Application|Next milestone|Welcome to/i).first()
    const nextStepPresent = (await nextStepCard.count()) > 0
    if (!nextStepPresent) {
      await logStateDiagnostic(studentPage, 'Student Next Step Card')
    }
    record('Student-Dashboard', 'Accepted application next action card surfaced', nextStepPresent)

    const rawLocalhostLinks = await studentPage.evaluate(() => {
      const text = document.body.innerText
      return /http:\/\/localhost:\d+/i.test(text) || /http:\/\/127\.0\.0\.1:\d+/i.test(text)
    })
    record('Student-Dashboard', 'Notifications list clean of raw localhost/127.0.0.1 URLs', !rawLocalhostLinks)

    await studentPage.setViewportSize({ width: 1280, height: 800 })
    const studentDesktopOverflow = await studentPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Student-Dashboard-Desktop', 'Zero horizontal overflow on desktop student dashboard', studentDesktopOverflow)
    await studentContext.close()

    // ----------------------------------------------------
    // 6. FOUNDER DASHBOARD AUDIT (390px & Desktop)
    // ----------------------------------------------------
    console.log('\nSuite 6: Founder Dashboard & Linked Startup')
    const founderContext = await createAuthenticatedContext(browser, 'founder@knest.local', { width: 390, height: 844 })
    const founderPage = await founderContext.newPage()
    configurePage(founderPage)
    await founderPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })

    const founderOverflow = await founderPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Founder-Dashboard-390px', 'Zero horizontal overflow on founder dashboard at 390px', founderOverflow)

    const founderContent = founderPage.getByText(/Next milestone|Your startup|Browse Programs/i).first()
    const founderContentPresent = (await founderContent.count()) > 0
    if (!founderContentPresent) {
      await logStateDiagnostic(founderPage, 'Founder Venture Content')
    }
    record('Founder-Dashboard', 'Founder dashboard surfaces venture content', founderContentPresent)
    await founderContext.close()

    // ----------------------------------------------------
    // 7. MENTOR & INVESTOR DASHBOARDS (390px & Desktop)
    // ----------------------------------------------------
    console.log('\nSuite 7: Mentor & Investor Dashboards (390px & Desktop)')
    const mentorContext = await createAuthenticatedContext(browser, 'mentor@knest.local', { width: 390, height: 844 })
    const mentorPage = await mentorContext.newPage()
    configurePage(mentorPage)
    await mentorPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
    const mentorOverflow = await mentorPage.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => element.getBoundingClientRect().right > viewportWidth + 1)
        .slice(0, 5)
        .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${String(element.className).trim().replace(/\s+/g, '.')}` : ''}`)
      return {
        fits: document.documentElement.scrollWidth <= viewportWidth,
        details: `scroll=${document.documentElement.scrollWidth}, client=${viewportWidth}, offenders=${offenders.join(' | ') || 'none'}`,
      }
    })
    record('Mentor-Dashboard-390px', 'Zero horizontal overflow on mentor dashboard at 390px', mentorOverflow.fits, mentorOverflow.details)
    await mentorContext.close()

    const investorContext = await createAuthenticatedContext(browser, 'investor@knest.local', { width: 390, height: 844 })
    const investorPage = await investorContext.newPage()
    configurePage(investorPage)
    await investorPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
    const investorOverflow = await investorPage.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth
    })
    record('Investor-Dashboard-390px', 'Zero horizontal overflow on investor dashboard at 390px', investorOverflow)
    await investorContext.close()

    // ----------------------------------------------------
    // 8. REVIEWER & ADMIN CONSOLE (390px & Desktop)
    // ----------------------------------------------------
    console.log('\nSuite 8: Reviewer & Admin Console (390px & Desktop)')
    const reviewerContext = await createAuthenticatedContext(browser, 'reviewer@knest.local', { width: 1280, height: 800 })
    const reviewerPage = await reviewerContext.newPage()
    configurePage(reviewerPage)
    await reviewerPage.goto(`${BASE_URL}/admin/applications`, { waitUntil: 'domcontentloaded' })

    const filterForm = reviewerPage.locator('form')
    record('Reviewer-Console', 'Applications review queue loads filter form', (await filterForm.count()) > 0)

    const statusSelect = reviewerPage.locator('select[name="status"]').first()
    if ((await statusSelect.count()) > 0) {
      await statusSelect.selectOption({ index: 1 })
      const filterSubmit = reviewerPage.locator('button[type="submit"]:has-text("Filter"), button:has-text("Apply")').first()
      if ((await filterSubmit.count()) > 0) {
        await filterSubmit.click()
        await reviewerPage.waitForURL((url) => url.searchParams.has('status'), { timeout: 15000 })
        record('Reviewer-Console', 'Filter dropdown updates URL search parameters', reviewerPage.url().includes('status='))

        const clearLink = reviewerPage.locator('a:has-text("Clear"), button:has-text("Clear")').first()
        if ((await clearLink.count()) > 0) {
          await clearLink.click()
          await reviewerPage.waitForURL((url) => !url.searchParams.has('status'), { timeout: 15000 })
          record('Reviewer-Console', 'Clear filters removes search param and resets form state', !reviewerPage.url().includes('status='))
        }
      }
    }
    await reviewerContext.close()

    // Super Admin at 390px phone
    const adminContext = await createAuthenticatedContext(browser, 'admin@knest.local', { width: 390, height: 844 })
    const adminPage = await adminContext.newPage()
    configurePage(adminPage)

    for (const adminRoute of ['/admin/applications', '/admin/audit', '/admin/members']) {
      await adminPage.goto(`${BASE_URL}${adminRoute}`, { waitUntil: 'domcontentloaded' })
      const noOverflow = await adminPage.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth
      })
      if (!noOverflow) {
        await logStateDiagnostic(adminPage, `Admin horizontal overflow on ${adminRoute}`)
      }
      record('Admin-Mobile-390px', `Zero horizontal overflow on ${adminRoute} at 390px`, noOverflow)
    }

    // Verify touch targets in staff header
    const touchTargetsValid = await adminPage.evaluate(() => {
      const headerInteractive = Array.from(document.querySelectorAll('header a, header button'))
      return headerInteractive.every((el) => {
        const rect = el.getBoundingClientRect()
        return rect.height >= 44
      })
    })
    record('Admin-Mobile-390px', 'Staff navigation interactive targets meet >= 44px touch height standard', touchTargetsValid)

    await adminContext.close()
  } finally {
    await browser.close()
  }

  console.log('\n========================================')
  console.log('AUDIT RUN SUMMARY')
  console.log('========================================')
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`Total assertions: ${total} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    console.error('\nFailures:')
    for (const f of results.filter((r) => r.status === 'FAIL')) {
      console.error(`- [${f.suite}] ${f.name}: ${f.details ?? 'failed'}`)
    }
    process.exit(1)
  } else {
    console.log('\nALL LOCAL BROWSER ACCEPTANCE ASSERTIONS PASSED!')
  }
}

runAudit().catch((err) => {
  console.error('Audit script exception:', err)
  process.exit(1)
})
