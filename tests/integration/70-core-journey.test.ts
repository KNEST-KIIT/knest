import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, PASSWORD, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Closing evidence for KN-14 (return path through sign-up and onboarding),
 * KN-15 (Google button), KN-31 (submit validation) and the submit half of KN-13,
 * against the production build, a real browser and a real database.
 */

let browser: Browser
const stamp = Date.now()
const SLUG = `journey-program-${stamp}`
const QSLUG = `journey-questions-${stamp}`

beforeAll(async () => {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })
  const payload = await payloadClient()
  const base = {
    tagline: 'Created by the journey suite',
    whoItsFor: richText('Anyone'),
    stage: ['idea'],
    applicationStatus: 'open',
    _status: 'published',
  }
  await payload.create({ collection: 'programs', data: { ...base, title: 'Journey Program', slug: SLUG } as never, overrideAccess: true })
  await payload.create({
    collection: 'programs',
    data: {
      ...base,
      title: 'Journey Questions Program',
      slug: QSLUG,
      applicationQuestions: [
        { label: 'Pick a stage', fieldType: 'select', required: true, options: [{ label: 'Idea', value: 'idea' }, { label: 'MVP', value: 'mvp' }] },
        { label: 'Describe it', fieldType: 'textarea', required: true, maxLength: 500 },
      ],
    } as never,
    overrideAccess: true,
  })
})

afterAll(async () => {
  await browser?.close()
  await closeDb()
})

async function newPage(): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() } })
  return context.newPage()
}

async function step(page: Page, action: () => Promise<unknown>) {
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/onboarding/step')), action()])
}

/** Clicks through the six adaptive steps as a student, stopping on the recommendation screen. */
async function answerOnboarding(page: Page) {
  await page.getByRole('radio', { name: 'Student' }).click()
  await step(page, () => page.getByRole('button', { name: 'Continue' }).click())
  await page.getByRole('checkbox').first().click()
  await step(page, () => page.getByRole('button', { name: 'Continue' }).click())
  await page.getByRole('radio').first().click()
  await step(page, () => page.getByRole('button', { name: 'Continue' }).click())
  await step(page, () => page.getByRole('button', { name: /skip for now/i }).click())
  await step(page, () => page.getByRole('button', { name: 'Continue' }).click())
}

const CTA = /find a program|see programs|see what.s on|get in touch|complete profile/i

async function signUp(page: Page, email: string, next?: string) {
  await page.goto(`${BASE()}/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  await page.getByLabel('Full name').fill('Journey Person')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Create password').fill(PASSWORD)
  await Promise.all([
    page.waitForURL((u) => u.pathname.startsWith('/onboarding'), { timeout: 60_000 }),
    page.getByRole('button', { name: /create account/i }).click(),
  ])
}

describe('KN-14: the application you were heading to survives sign-up and onboarding', () => {
  it('lands on the application, not the dashboard', async () => {
    const page = await newPage()
    await signUp(page, `journey-a-${stamp}@journey.test`, `/apply/${SLUG}`)
    expect(new URL(page.url()).searchParams.get('next')).toBe(`/apply/${SLUG}`)
    await answerOnboarding(page)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60_000 }),
      page.getByRole('button', { name: CTA }).click(),
    ])
    expect(new URL(page.url()).pathname).toBe(`/apply/${SLUG}`)
    await page.context().close()
  })

  it('without a return path, lands on the recommended page rather than always /dashboard', async () => {
    const page = await newPage()
    await signUp(page, `journey-b-${stamp}@journey.test`)
    await answerOnboarding(page)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60_000 }),
      page.getByRole('button', { name: CTA }).click(),
    ])
    expect(new URL(page.url()).pathname).toMatch(/^\/(events|programs)/)
    await page.context().close()
  })

  it('a hostile return path is ignored', async () => {
    const page = await newPage()
    await signUp(page, `journey-c-${stamp}@journey.test`, '//evil.example/pwned')
    await answerOnboarding(page)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60_000 }),
      page.getByRole('button', { name: CTA }).click(),
    ])
    expect(new URL(page.url()).origin).toBe(new URL(BASE()).origin)
    await page.context().close()
  })

  it('if finishing fails, the person sees why and stays put (no silent bounce to step 1)', async () => {
    const page = await newPage()
    await signUp(page, `journey-d-${stamp}@journey.test`, `/apply/${SLUG}`)
    await answerOnboarding(page)
    await page.route('**/api/onboarding/step', (route) => {
      const body = route.request().postDataJSON() as { step?: string }
      if (body.step === 'complete') return route.fulfill({ status: 500, json: { error: 'Simulated failure while finishing.' } })
      return route.continue()
    })
    await page.getByRole('button', { name: CTA }).click()
    // (Next also renders a role=alert route announcer, so target the form's own message.)
    const alert = page.locator('p[role="alert"]')
    await alert.waitFor({ timeout: 15_000 })
    expect(await alert.textContent()).toContain('Simulated failure while finishing.')
    expect(new URL(page.url()).pathname).toBe('/onboarding')
    await page.context().close()
  })
})

describe('KN-15: the Google button appears only when Google is configured', () => {
  it.each(['/login', '/signup'])('%s has no Google button when AUTH_GOOGLE_* is unset', async (path) => {
    const html = await (await get(path)).text()
    expect(html).not.toContain('Continue with Google')
    expect(html).not.toContain('Sign up with Google')
    expect(html).not.toContain('/api/auth/signin/google')
  })
})

describe('KN-31 / KN-13: submitting', () => {
  let student: Session
  const json = (session: Session, body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie, 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify(body),
  })

  beforeAll(async () => {
    await createUser({ email: `submitter-${stamp}@journey.test`, platformRole: 'student' })
    student = (await login(`submitter-${stamp}@journey.test`))!
    expect(student).toBeTruthy()
  })

  it('an answer saved against the old question set is not accepted after the question changes', async () => {
    const payload = await payloadClient()
    const started = await (await fetch(`${BASE()}/api/applications/start`, json(student, { programSlug: QSLUG }))).json()
    const applicationId = started.applicationId as string
    expect(applicationId).toBeTruthy()

    const found = await payload.find({ collection: 'programs', where: { slug: { equals: QSLUG } }, overrideAccess: true, limit: 1 })
    const program = found.docs[0]!
    const [select, text] = program.applicationQuestions!
    const answer = (questionId: string, value: unknown) =>
      fetch(`${BASE()}/api/applications/${applicationId}/answer`, json(student, { questionId, value }))
    expect((await answer(select!.id!, 'mvp')).status).toBe(200)
    expect((await answer(text!.id!, 'A real description')).status).toBe(200)

    // Staff remove the "mvp" option (keeping the question ids, as the CMS does on edit).
    await payload.update({
      collection: 'programs',
      id: program.id,
      overrideAccess: true,
      data: {
        applicationQuestions: [
          { id: select!.id, label: 'Pick a stage', fieldType: 'select', required: true, options: [{ label: 'Idea', value: 'idea' }] },
          { id: text!.id, label: 'Describe it', fieldType: 'textarea', required: true, maxLength: 500 },
        ],
      } as never,
    })

    const refused = await fetch(`${BASE()}/api/applications/${applicationId}/submit`, json(student, {}))
    const body = await refused.json()
    expect(refused.status).toBe(400)
    expect(body.error).toContain('Pick a stage')
    expect((await db().query('select status from app.applications where id = $1', [applicationId])).rows[0].status).toBe('draft')

    expect((await answer(select!.id!, 'idea')).status).toBe(200)
    const ok = await fetch(`${BASE()}/api/applications/${applicationId}/submit`, json(student, {}))
    expect(ok.status).toBe(200)
  })

  it('ten simultaneous submits produce one submission and one confirmation', async () => {
    await createUser({ email: `racer-${stamp}@journey.test`, platformRole: 'student' })
    const racer = (await login(`racer-${stamp}@journey.test`))!
    const started = await (await fetch(`${BASE()}/api/applications/start`, json(racer, { programSlug: SLUG }))).json()
    const id = started.applicationId as string

    const results = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${BASE()}/api/applications/${id}/submit`, json(racer, {}))),
    )
    const statuses = results.map((r) => r.status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s >= 400)).toHaveLength(9)

    const notes = await db().query(
      "select count(*)::int c from app.notifications where application_id = $1 and type = 'application_received'",
      [id],
    )
    expect(notes.rows[0].c).toBe(1)
    expect((await db().query('select status from app.applications where id = $1', [id])).rows[0].status).toBe('submitted')
  })
})
