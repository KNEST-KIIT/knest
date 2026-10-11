import type { Browser, Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, db, PASSWORD } from '../support/helpers'
import { answerOnboarding, launchBrowser, linkIn, mailsTo, newPage, ONBOARDING_CTA, signInThroughForm, waitForMailText } from '../support/journey'
import { payloadClient, richText } from '../support/payload'

/**
 * A student's whole first visit, in a real browser against the production build and a real
 * database: sign up, finish onboarding, sign out and back in, confirm the e-mail address, find a
 * program, start and submit an application, register for an event, and read the notices that
 * produced. Every step asserts what the person sees AND what the database now holds.
 *
 * The steps share one person and run in order; a failure early on makes the later ones moot.
 */

const stamp = Date.now()
const EMAIL = `student-${stamp}@student.test`
const NAME = 'Asha Journeyer'
const PROGRAM = `Student Journey Program ${stamp}`
const PROGRAM_SLUG = `student-journey-${stamp}`
const EVENT = `Student Journey Workshop ${stamp}`
const ANSWER = 'A kiosk that lets hostel mess staff plan meals from yesterday waste.'
const DAY = 24 * 60 * 60 * 1000

let browser: Browser
let page: Page
let userId = ''
let applicationId = ''
let eventId = 0
let eventSlug = ''

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db().query(sql, params)).rows[0] as T
const path = () => new URL(page.url()).pathname

beforeAll(async () => {
  browser = await launchBrowser()
  const payload = await payloadClient()
  await payload.create({
    collection: 'programs',
    data: {
      title: PROGRAM,
      slug: PROGRAM_SLUG,
      tagline: 'Created by the student journey suite',
      whoItsFor: richText('Students with an idea they want to test.'),
      stage: ['idea'],
      applicationStatus: 'open',
      applicationQuestions: [
        { label: 'Where is your idea today?', fieldType: 'select', required: true, options: [{ label: 'Just an idea', value: 'idea' }, { label: 'A working prototype', value: 'prototype' }] },
        { label: 'Describe your idea', fieldType: 'textarea', required: true, maxLength: 500 },
      ],
      _status: 'published',
    } as never,
    overrideAccess: true,
  })
  const event = await payload.create({
    collection: 'events',
    data: { title: EVENT, summary: 'Created by the student journey suite', startsAt: new Date(Date.now() + 6 * DAY).toISOString(), location: 'Campus 6, Room 101', _status: 'published' } as never,
    overrideAccess: true,
  })
  eventId = event.id as number
  eventSlug = (event as { slug: string }).slug
  page = await newPage(browser)
})

afterAll(async () => {
  await page?.context().close()
  await browser?.close()
  await closeDb()
})

describe('a student first visit', () => {
  it('signs up and is taken to onboarding, with an unverified account and a verification e-mail on its way', async () => {
    await page.goto(`${BASE()}/signup`, { waitUntil: 'networkidle' })
    await page.getByLabel('Full name').fill(NAME)
    await page.getByLabel('Email address').fill(EMAIL)
    await page.getByLabel('Create password').fill(PASSWORD)
    await Promise.all([page.waitForURL((u) => u.pathname === '/onboarding', { timeout: 60_000 }), page.getByRole('button', { name: /create account/i }).click()])

    expect(await page.getByRole('heading', { level: 1 }).textContent()).toContain('Who are you?')
    const user = await one<{ id: string; name: string; platform_role: string; email_verified: Date | null; onboarding_completed_at: Date | null; password_hash: string }>(
      'select id, name, platform_role, email_verified, onboarding_completed_at, password_hash from app.users where email = $1',
      [EMAIL],
    )
    userId = user.id
    expect(user).toMatchObject({ name: NAME, platform_role: 'student', email_verified: null, onboarding_completed_at: null })
    expect(user.password_hash).toMatch(/^\$2[aby]\$/) // stored hashed, never as typed
    expect((await one('select count(*)::int c from app.sessions where user_id = $1', [userId])).c).toBe(1)

    const text = await waitForMailText(EMAIL, /verify\/confirm/i)
    expect(text).toContain('/verify/confirm?email=')
  })

  it('finishes onboarding and lands on a page that fits the answers', async () => {
    await answerOnboarding(page)
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60_000 }), page.getByRole('button', { name: ONBOARDING_CTA }).click()])
    expect(path()).toMatch(/^\/(events|programs)/)

    const user = await one<{ platform_role: string; journey_stage: string | null; onboarding_completed_at: Date | null }>('select platform_role, journey_stage, onboarding_completed_at from app.users where id = $1', [userId])
    expect(user.platform_role).toBe('student')
    expect(user.journey_stage).not.toBeNull()
    expect(user.onboarding_completed_at).not.toBeNull()

    await page.goto(`${BASE()}/dashboard`)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toContain('Welcome back, Asha.')
    await page.getByText('Your next step').waitFor()
  })

  it('signs out, is shut out of the dashboard, then signs back in (a wrong password first)', async () => {
    await Promise.all([page.waitForURL((u) => u.pathname === '/', { timeout: 30_000 }), page.getByRole('button', { name: 'Log out' }).click()])
    expect((await one('select count(*)::int c from app.sessions where user_id = $1', [userId])).c).toBe(0)
    await page.getByRole('link', { name: 'Log in' }).first().waitFor()

    await page.goto(`${BASE()}/dashboard`)
    expect(path()).toBe('/login')
    expect(new URL(page.url()).searchParams.get('next')).toBe('/dashboard')

    await signInThroughForm(page, EMAIL, { password: 'not-the-right-password-1', next: '/dashboard' })
    // (Next also renders an empty role=alert route announcer, so name the message.)
    await page.getByRole('alert').filter({ hasText: 'match' }).waitFor({ timeout: 15_000 })
    expect(path()).toBe('/login')
    expect((await one('select count(*)::int c from app.sessions where user_id = $1', [userId])).c).toBe(0)

    await page.getByLabel('Password').fill(PASSWORD)
    await Promise.all([page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 60_000 }), page.getByRole('button', { name: /log in/i }).click()])
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toContain('Welcome back, Asha.')
    expect((await one('select count(*)::int c from app.sessions where user_id = $1', [userId])).c).toBe(1)
  })

  it('finds the program from the programs list and reads about it', async () => {
    await page.goto(`${BASE()}/programs`)
    await page.getByRole('link', { name: `View ${PROGRAM}` }).click()
    await page.waitForURL((u) => u.pathname === `/programs/${PROGRAM_SLUG}`)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(PROGRAM)
    await page.getByText('Students with an idea they want to test.').waitFor()
  })

  it('starts the application only when asked to, and nothing exists before that', async () => {
    expect((await one('select count(*)::int c from app.applications where user_id = $1', [userId])).c).toBe(0)
    await page.getByRole('link', { name: `Apply to ${PROGRAM}` }).first().click()
    await page.waitForURL((u) => u.pathname === `/apply/${PROGRAM_SLUG}`)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toContain(`Apply to ${PROGRAM}`)
    expect((await one('select count(*)::int c from app.applications where user_id = $1', [userId])).c).toBe(0) // viewing creates nothing

    await page.getByRole('button', { name: 'Start application' }).click()
    await page.getByRole('heading', { level: 1, name: 'Where is your idea today?' }).waitFor({ timeout: 30_000 })
    const draft = await one<{ id: string; status: string; submitted_at: Date | null }>('select id, status, submitted_at from app.applications where user_id = $1', [userId])
    applicationId = draft.id
    expect(draft).toMatchObject({ status: 'draft', submitted_at: null })
  })

  it('answers each question, saving as it goes, and reviews the answers before sending', async () => {
    await page.getByRole('radio', { name: 'A working prototype' }).click()
    await Promise.all([page.waitForResponse((r) => r.url().includes('/answer') && r.ok()), page.getByRole('button', { name: 'Save & continue' }).click()])
    await page.getByRole('heading', { level: 1, name: 'Describe your idea' }).waitFor()
    await page.getByText('Saved automatically').waitFor()

    await page.getByLabel('Your answer').fill(ANSWER)
    await Promise.all([page.waitForResponse((r) => r.url().includes('/answer') && r.ok()), page.getByRole('button', { name: 'Save & continue' }).click()])
    await page.getByRole('heading', { level: 1, name: 'Have a last look.' }).waitFor()
    await page.getByText('A working prototype', { exact: true }).waitFor() // the label, not the stored value
    await page.getByText(ANSWER).waitFor()

    const answers = (await db().query('select value from app.application_answers where application_id = $1', [applicationId])).rows.map((r) => r.value)
    expect(answers).toHaveLength(2)
    expect(answers).toContain('prototype')
    expect(answers).toContain(ANSWER)
    expect((await one('select status from app.applications where id = $1', [applicationId])).status).toBe('draft')
  })

  it('is stopped at submit until the e-mail address is confirmed, and the draft is kept', async () => {
    await Promise.all([page.waitForURL((u) => u.pathname === '/verify', { timeout: 30_000 }), page.getByRole('button', { name: 'Submit application' }).click()])
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toContain('Check your email')
    await page.getByText(EMAIL).waitFor()
    expect((await one('select status from app.applications where id = $1', [applicationId])).status).toBe('draft')
    expect((await one("select count(*)::int c from app.notifications where application_id = $1 and type = 'application_received'", [applicationId])).c).toBe(0)
  })

  it('confirms the address from the e-mailed link, once', async () => {
    const link = linkIn(await waitForMailText(EMAIL, /verify\/confirm/))
    await page.goto(link)
    await page.getByRole('heading', { level: 1, name: 'Email confirmed.' }).waitFor({ timeout: 30_000 })
    expect((await one<{ email_verified: Date | null }>('select email_verified from app.users where id = $1', [userId])).email_verified).not.toBeNull()

    // the link is single-use
    await page.goto(link)
    await page.getByRole('heading', { level: 1, name: 'That link has expired.' }).waitFor({ timeout: 30_000 })
  })

  it('comes back to the saved draft, sees the answers still there, and submits', async () => {
    await page.goto(`${BASE()}/apply/${PROGRAM_SLUG}`)
    await page.getByRole('heading', { level: 1, name: 'Where is your idea today?' }).waitFor()
    expect(await page.getByRole('radio', { name: 'A working prototype' }).getAttribute('aria-checked')).toBe('true')
    await page.getByRole('button', { name: 'Save & continue' }).click()
    await page.getByLabel('Your answer').waitFor()
    expect(await page.getByLabel('Your answer').inputValue()).toBe(ANSWER)
    await page.getByRole('button', { name: 'Save & continue' }).click()
    await page.getByRole('heading', { level: 1, name: 'Have a last look.' }).waitFor()

    const submit = page.getByRole('button', { name: 'Submit application' })
    await Promise.all([page.waitForResponse((r) => r.url().includes('/submit') && r.ok()), submit.click()])
    await page.getByRole('heading', { level: 1, name: 'Your application is in.' }).waitFor()

    const row = await one<{ status: string; submitted_at: Date | null; question_snapshot: unknown[] | null }>('select status, submitted_at, question_snapshot from app.applications where id = $1', [applicationId])
    expect(row.status).toBe('submitted')
    expect(row.submitted_at).not.toBeNull()
    expect(row.question_snapshot).toHaveLength(2) // frozen as the applicant saw them
    expect((await one("select count(*)::int c from app.audit_logs where action = 'application_submitted' and entity_id = $1 and actor_user_id = $2", [applicationId, userId])).c).toBe(1)
    expect((await one("select count(*)::int c from app.notifications where application_id = $1 and type = 'application_received' and read_at is null", [applicationId])).c).toBe(1)
    await waitForMailText(EMAIL, /Your application is in and our team will read it/)
  })

  it('tracks the submitted application on the dashboard and can no longer edit it', async () => {
    await page.getByRole('button', { name: 'Track your application' }).click()
    await page.waitForURL((u) => u.pathname === '/dashboard/applications')
    await page.getByRole('heading', { level: 2, name: PROGRAM }).waitFor()
    await page.getByText('Submitted', { exact: false }).first().waitFor()
    expect(await page.getByRole('link', { name: 'Continue' }).count()).toBe(0)

    await page.goto(`${BASE()}/apply/${PROGRAM_SLUG}`)
    await page.waitForURL((u) => u.pathname === '/dashboard/applications') // a sent application is read-only
  })

  it('registers for an event from the events list and sees it among their events', async () => {
    await page.goto(`${BASE()}/events`)
    await page.getByRole('link', { name: `View ${EVENT}` }).click()
    await page.waitForURL((u) => u.pathname === `/events/${eventSlug}`)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(EVENT)

    expect((await one('select count(*)::int c from app.event_registrations where user_id = $1', [userId])).c).toBe(0)
    await Promise.all([page.waitForResponse((r) => r.url().includes(`/api/events/${eventId}/register`) && r.ok()), page.getByRole('button', { name: 'Register', exact: true }).click()])
    await page.getByRole('button', { name: 'Cancel registration' }).waitFor()
    expect((await one('select count(*)::int c from app.event_registrations where user_id = $1 and event_id = $2', [userId, eventId])).c).toBe(1)

    await page.goto(`${BASE()}/dashboard/events`)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toContain('Your events')
    await page.getByText(EVENT).waitFor()
    const confirmation = await waitForMailText(EMAIL, new RegExp(`registered for ${EVENT}`))
    expect(confirmation).toContain('Campus 6, Room 101')
    expect(mailsTo(EMAIL).length).toBeGreaterThanOrEqual(3) // verify, application received, event
  })

  it('shows both notices on the dashboard, counts them in the header, and marks them read', async () => {
    await page.goto(`${BASE()}/dashboard`)
    await page.getByRole('heading', { level: 2, name: 'Notifications' }).waitFor()
    await page.getByText(`We've got your application to ${PROGRAM}`).waitFor()
    await page.getByText(`You’re registered: ${EVENT}`).waitFor()
    await page.getByText('2 unread', { exact: true }).waitFor()
    await page.getByRole('link', { name: 'Dashboard — 2 unread notifications' }).first().waitFor()

    await Promise.all([page.waitForResponse((r) => /\/api\/notifications\/.+\/read/.test(r.url()) && r.ok()), page.getByRole('button', { name: 'Mark read' }).first().click()])
    await page.getByText('1 unread').waitFor()
    expect((await one('select count(*)::int c from app.notifications where user_id = $1 and read_at is not null', [userId])).c).toBe(1)

    await Promise.all([page.waitForResponse((r) => /\/api\/notifications\/.+\/read/.test(r.url()) && r.ok()), page.getByRole('button', { name: 'Mark read' }).click()])
    await page.getByRole('button', { name: 'Mark read' }).waitFor({ state: 'detached' })
    expect((await one('select count(*)::int c from app.notifications where user_id = $1 and read_at is null', [userId])).c).toBe(0)

    // a notice leads to what it is about
    await Promise.all([page.waitForURL((u) => u.pathname === '/dashboard/applications'), page.getByRole('link', { name: `We've got your application to ${PROGRAM}` }).click()])
  })

  it('cancelling the registration frees the place and the event page says so', async () => {
    await page.goto(`${BASE()}/events/${eventSlug}`)
    await Promise.all([page.waitForResponse((r) => r.url().includes(`/api/events/${eventId}/unregister`) && r.ok()), page.getByRole('button', { name: 'Cancel registration' }).click()])
    await page.getByRole('button', { name: 'Register', exact: true }).waitFor()
    expect((await one('select count(*)::int c from app.event_registrations where user_id = $1', [userId])).c).toBe(0)
    await page.goto(`${BASE()}/dashboard/events`)
    await page.getByRole('heading', { level: 2, name: 'Nothing here yet' }).waitFor()
  })
})
