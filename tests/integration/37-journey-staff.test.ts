import type { Browser, Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, CAPTCHA, closeDb, createUser, db, login, uniqueIp, type Session } from '../support/helpers'
import { launchBrowser, newContext, newPage, signInThroughForm, waitForMailText } from '../support/journey'
import { payloadClient, richText } from '../support/payload'

/**
 * The staff side, in a real browser against the production build and a real database: an
 * administrator signs in, finds a submitted application, moves it through review to a decision,
 * and the decision reaches the applicant; the audit trail shows who did what; a visitor's contact
 * message is read, answered from the staff screen and closed. A narrower role is shown only what
 * it may use.
 *
 * The application itself is submitted through the API as the applicant would (the student journey
 * covers that screen by screen); here it is the staff screens that are under test.
 */

const stamp = Date.now()
const mail = (n: string) => `${n}-${stamp}@staff.test`
const PROGRAM = `Staff Journey Program ${stamp}`
const PROGRAM_SLUG = `staff-journey-${stamp}`
const ADMIN_NAME = 'Priya Administrator'
const ANSWER_ACCEPTED = 'We have signed three pilot cafes for the first term.'
const ANSWER_DECLINED = 'An idea we have not started on yet.'
const NOTE = 'Strong traction for this stage; panel interview went well.'
const ENQUIRY_MESSAGE = `Please tell me when the next cohort opens, reference ${stamp}.`

let browser: Browser
let adminPage: Page
let applicantA: { id: string; session: Session; applicationId: string }
let applicantB: { id: string; session: Session; applicationId: string }
let adminId = ''
let questionId = ''

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db().query(sql, params)).rows[0] as T
const count = async (sql: string, params: unknown[] = []) => (await one<{ c: number }>(sql, params)).c

async function applicant(tag: string, name: string, answer: string) {
  const email = mail(tag)
  const id = await createUser({ email, platformRole: 'student' })
  await db().query('update app.users set name = $2, onboarding_completed_at = now(), journey_stage = $3 where id = $1', [id, name, 'idea'])
  const session = (await login(email))!
  const headers = { 'content-type': 'application/json', cookie: session.cookie, 'x-forwarded-for': uniqueIp() }
  const started = await (await fetch(`${BASE()}/api/applications/start`, { method: 'POST', headers, body: JSON.stringify({ programSlug: PROGRAM_SLUG }) })).json()
  const applicationId = started.applicationId as string
  expect((await fetch(`${BASE()}/api/applications/${applicationId}/answer`, { method: 'POST', headers, body: JSON.stringify({ questionId, value: answer }) })).status).toBe(200)
  expect((await fetch(`${BASE()}/api/applications/${applicationId}/submit`, { method: 'POST', headers, body: JSON.stringify(CAPTCHA) })).status).toBe(200)
  return { id, session, applicationId }
}

/** Moves the application one step on the review screen, the way a reviewer does. */
async function moveTo(page: Page, applicationId: string, label: string, status: string, note?: string) {
  await page.getByRole('combobox').selectOption({ label: `Move to: ${label}` })
  if (note) await page.getByPlaceholder('Optional note (not shown to the applicant)').fill(note)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/admin/applications/${applicationId}/status`) && r.ok()),
    page.getByRole('button', { name: 'Update status' }).click(),
  ])
  await page.locator('strong', { hasText: new RegExp(`^${status.replaceAll('_', ' ')}$`) }).waitFor({ timeout: 30_000 })
}

beforeAll(async () => {
  browser = await launchBrowser()
  const payload = await payloadClient()
  const program = await payload.create({
    collection: 'programs',
    data: {
      title: PROGRAM,
      slug: PROGRAM_SLUG,
      tagline: 'Created by the staff journey suite',
      whoItsFor: richText('Anyone with a venture to review.'),
      stage: ['idea'],
      applicationStatus: 'open',
      applicationQuestions: [{ label: 'What have you done so far?', fieldType: 'textarea', required: true, maxLength: 500 }],
      _status: 'published',
    } as never,
    overrideAccess: true,
  })
  questionId = (program as { applicationQuestions: { id: string }[] }).applicationQuestions[0]!.id

  adminId = await createUser({ email: mail('admin'), platformRole: 'other', staffRole: 'super_admin' })
  await db().query('update app.users set name = $2 where id = $1', [adminId, ADMIN_NAME])
  await createUser({ email: mail('reviewer'), platformRole: 'other', staffRole: 'reviewer' })

  applicantA = await applicant('meera', 'Meera Applicant', ANSWER_ACCEPTED)
  applicantB = await applicant('rohan', 'Rohan Applicant', ANSWER_DECLINED)
  adminPage = await newPage(browser)
})

afterAll(async () => {
  await adminPage?.context().close()
  await browser?.close()
  await closeDb()
})

describe('an administrator reviews applications', () => {
  it('is shown nothing of the staff area until signed in', async () => {
    const visitor = await newPage(browser)
    const response = await visitor.goto(`${BASE()}/admin/applications`)
    expect(response?.status()).toBe(404)
    await visitor.context().close()
  })

  it('signs in through the login form and lands on the overview they were heading to', async () => {
    await signInThroughForm(adminPage, mail('admin'), { next: '/admin/overview' })
    await adminPage.waitForURL((u) => u.pathname === '/admin/overview', { timeout: 60_000 })
    expect(await adminPage.getByRole('heading', { level: 1 }).textContent()).toBe('Overview')
    const nav = adminPage.getByRole('navigation', { name: 'Admin' })
    for (const item of ['Applications', 'Enquiries', 'Members', 'Labs', 'Audit trail', 'Analytics']) await nav.getByRole('link', { name: item }).waitFor()
    expect(await count('select count(*)::int c from app.sessions where user_id = $1', [adminId])).toBe(1)
  })

  it('finds an applicant by name in the review queue, and drafts are not listed', async () => {
    await adminPage.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Applications' }).click()
    await adminPage.waitForURL((u) => u.pathname === '/admin/applications')
    await adminPage.getByRole('searchbox', { name: 'Search by applicant name or email' }).fill('Meera Applicant')
    await Promise.all([adminPage.waitForURL((u) => u.searchParams.get('q') === 'Meera Applicant'), adminPage.getByRole('button', { name: 'Filter' }).click()])
    const link = adminPage.getByRole('link', { name: 'Meera Applicant' }).first()
    await link.waitFor()
    expect(await adminPage.getByRole('link', { name: 'Rohan Applicant' }).count()).toBe(0)
    await adminPage.getByRole('cell', { name: PROGRAM }).first().waitFor()
    await Promise.all([adminPage.waitForURL((u) => u.pathname === `/admin/applications/${applicantA.applicationId}`), link.click()])
  })

  it('reads exactly what the applicant wrote, against the question they were asked', async () => {
    expect(await adminPage.getByRole('heading', { level: 1 }).textContent()).toBe('Meera Applicant')
    await adminPage.getByText(mail('meera')).first().waitFor()
    await adminPage.getByText('What have you done so far?').waitFor()
    await adminPage.getByText(ANSWER_ACCEPTED).waitFor()
    await adminPage.locator('strong', { hasText: /^submitted$/ }).waitFor()
  })

  it('moves it through review to an acceptance, each step recorded and each step offering only legal next moves', async () => {
    const options = async () => (await adminPage.getByRole('combobox').locator('option:not([disabled])').allTextContents()).map((t) => t.replace('Move to: ', ''))
    expect(await options()).toEqual(['Under review', 'Not this time']) // a submitted application cannot be accepted outright

    await moveTo(adminPage, applicantA.applicationId, 'Under review', 'under_review')
    expect(await options()).toEqual(['Shortlisted', 'Not this time'])
    await moveTo(adminPage, applicantA.applicationId, 'Shortlisted', 'shortlisted')
    await moveTo(adminPage, applicantA.applicationId, 'Interview', 'interview')
    expect(await options()).toEqual(['Accepted', 'Not this time', 'Waitlisted'])
    await moveTo(adminPage, applicantA.applicationId, 'Accepted', 'accepted', NOTE)
    await adminPage.getByText('This application is in a final state.').waitFor()

    const row = await one<{ status: string; decision_at: Date | null; decision_note: string | null }>('select status, decision_at, decision_note from app.applications where id = $1', [applicantA.applicationId])
    expect(row.status).toBe('accepted')
    expect(row.decision_at).not.toBeNull()
    expect(row.decision_note).toBe(NOTE)

    const trail = (await db().query("select before, after, actor_user_id from app.audit_logs where action = 'application_status_changed' and entity_id = $1 order by created_at", [applicantA.applicationId])).rows
    expect(trail.map((t) => t.after.status)).toEqual(['under_review', 'shortlisted', 'interview', 'accepted'])
    expect(trail.map((t) => t.before.status)).toEqual(['submitted', 'under_review', 'shortlisted', 'interview'])
    expect(new Set(trail.map((t) => t.actor_user_id))).toEqual(new Set([adminId]))
    expect(trail[3]!.after.note).toBe(NOTE)
  })

  it('declines a second application, with the decision recorded', async () => {
    await adminPage.goto(`${BASE()}/admin/applications/${applicantB.applicationId}`)
    await adminPage.getByText(ANSWER_DECLINED).waitFor()
    await moveTo(adminPage, applicantB.applicationId, 'Not this time', 'rejected')
    await adminPage.getByText('This application is in a final state.').waitFor()
    expect((await one('select status from app.applications where id = $1', [applicantB.applicationId])).status).toBe('rejected')
  })

  it('the queue can be narrowed to a status, and shows the new status in words', async () => {
    await adminPage.goto(`${BASE()}/admin/applications?status=accepted&q=${encodeURIComponent(mail('meera'))}`)
    await adminPage.getByRole('link', { name: 'Meera Applicant' }).first().waitFor()
    await adminPage.goto(`${BASE()}/admin/applications?status=rejected&q=${encodeURIComponent(mail('rohan'))}`)
    await adminPage.getByRole('link', { name: 'Rohan Applicant' }).first().waitFor()
    await adminPage.getByRole('cell', { name: 'Not this time', exact: true }).waitFor()
    await adminPage.goto(`${BASE()}/admin/applications?status=accepted&q=${encodeURIComponent(mail('rohan'))}`)
    expect(await adminPage.getByRole('link', { name: 'Rohan Applicant' }).count()).toBe(0)
  })

  it('the applicant is told: in the app, by e-mail, and on the application page', async () => {
    expect(await count("select count(*)::int c from app.notifications where user_id = $1 and type = 'application_status_changed'", [applicantA.id])).toBe(4)
    await waitForMailText(mail('meera'), /You're in\. Welcome to/)

    const context = await newContext(browser, applicantA.session)
    const page = await context.newPage()
    await page.goto(`${BASE()}/dashboard/applications`)
    await page.getByRole('heading', { level: 2, name: PROGRAM }).waitFor()
    await page.getByText('Accepted', { exact: true }).waitFor()
    await page.getByText('Welcome to the program.').waitFor()
    await page.goto(`${BASE()}/dashboard`)
    await page.getByText(`You're in. Welcome to ${PROGRAM}.`).first().waitFor()
    // the internal note stays internal
    expect(await page.content()).not.toContain(NOTE)
    await context.close()

    const declined = await newContext(browser, applicantB.session)
    const declinedPage = await declined.newPage()
    await declinedPage.goto(`${BASE()}/dashboard/applications`)
    await declinedPage.getByText('Not this time', { exact: true }).waitFor()
    expect(await declinedPage.getByText('Rejected').count()).toBe(0)
    await declined.close()
  })

  it('sees every one of those actions in the audit trail, with who did it and what changed', async () => {
    await adminPage.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Audit trail' }).click()
    await adminPage.waitForURL((u) => u.pathname === '/admin/audit')
    expect(await adminPage.getByRole('heading', { level: 1 }).textContent()).toBe('Audit trail')

    await adminPage.getByRole('combobox', { name: 'Action' }).selectOption('application_status_changed')
    await Promise.all([adminPage.waitForURL((u) => u.searchParams.get('action') === 'application_status_changed'), adminPage.getByRole('button', { name: 'Filter' }).click()])

    const short = applicantA.applicationId.slice(0, 8)
    const rows = adminPage.getByRole('listitem').filter({ hasText: short })
    expect(await rows.count()).toBe(4)
    const accepted = rows.filter({ hasText: 'status: accepted' })
    expect(await accepted.count()).toBe(1)
    const text = (await accepted.textContent()) ?? ''
    expect(text).toContain('application status changed on application')
    expect(text).toContain(`${ADMIN_NAME} (${mail('admin')})`)
    expect(text).toContain('status: interview') // before
    expect(text).toContain(NOTE.slice(0, 40)) // after, with the note
    // the declined one is there too, under its own id
    expect(await adminPage.getByRole('listitem').filter({ hasText: applicantB.applicationId.slice(0, 8) }).filter({ hasText: 'status: rejected' }).count()).toBe(1)
    // the applicants' own submissions are on record as theirs
    expect(await count("select count(*)::int c from app.audit_logs where action = 'application_submitted' and entity_id = any($1)", [[applicantA.applicationId, applicantB.applicationId]])).toBe(2)
  })

  it('the overview lists the latest staff actions', async () => {
    await adminPage.goto(`${BASE()}/admin/overview`)
    const latest = adminPage.getByRole('region', { name: 'Latest staff actions' })
    await latest.getByText(`by ${mail('admin')}`).first().waitFor()
  })
})

describe('an administrator answers a visitor’s enquiry', () => {
  let enquiryId = ''

  it('a visitor sends a message from the contact page and is told it arrived', async () => {
    const visitor = await newPage(browser)
    await visitor.goto(`${BASE()}/contact`, { waitUntil: 'networkidle' })
    await visitor.getByLabel('Your name').fill('Kavya Visitor')
    await visitor.getByLabel('Email address').fill(mail('visitor'))
    await visitor.getByLabel('What is this about?').selectOption('program')
    await visitor.getByLabel('Your message').fill(ENQUIRY_MESSAGE)
    await Promise.all([visitor.waitForResponse((r) => r.url().endsWith('/api/enquiries') && r.status() === 201), visitor.getByRole('button', { name: 'Send message' }).click()])
    await visitor.getByRole('heading', { name: /we.ve got your message/i }).waitFor()
    await visitor.context().close()

    const stored = await one<{ id: string; name: string; topic: string; status: string; user_id: string | null; handled_at: Date | null }>('select id, name, topic, status, user_id, handled_at from app.enquiries where email = $1', [mail('visitor')])
    enquiryId = stored.id
    expect(stored).toMatchObject({ name: 'Kavya Visitor', topic: 'program', status: 'new', user_id: null, handled_at: null })
  })

  it('the message waits in the staff inbox, with a way to write back to the sender', async () => {
    await adminPage.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Enquiries' }).click()
    await adminPage.waitForURL((u) => u.pathname === '/admin/enquiries')
    await adminPage.getByRole('link', { name: 'New', exact: true }).click()
    await adminPage.waitForURL((u) => u.searchParams.get('status') === 'new')

    const item = adminPage.getByRole('listitem').filter({ hasText: ENQUIRY_MESSAGE })
    expect(await item.count()).toBe(1)
    await item.getByText('Kavya Visitor').waitFor()
    await item.getByText('A program or application').waitFor()
    // Replies go out from the team’s own mail: the screen gives the address as a ready-made link.
    expect(await item.getByRole('link', { name: mail('visitor') }).getAttribute('href')).toBe(`mailto:${mail('visitor')}`)
    await item.getByRole('button', { name: 'Mark handled' }).waitFor()
  })

  it('marks it handled once answered; it leaves the new list, stays in the handled list, and is on the audit trail', async () => {
    const item = adminPage.getByRole('listitem').filter({ hasText: ENQUIRY_MESSAGE })
    await Promise.all([adminPage.waitForResponse((r) => r.url().includes(`/api/admin/enquiries/${enquiryId}/handled`) && r.ok()), item.getByRole('button', { name: 'Mark handled' }).click()])
    await item.waitFor({ state: 'detached', timeout: 30_000 }) // it has left the list of new messages

    const stored = await one<{ status: string; handled_at: Date | null; handled_by: string | null }>('select status, handled_at, handled_by from app.enquiries where id = $1', [enquiryId])
    expect(stored.status).toBe('handled')
    expect(stored.handled_at).not.toBeNull()
    expect(stored.handled_by).toBe(adminId)
    expect(await count("select count(*)::int c from app.audit_logs where action = 'enquiry_handled' and entity_id = $1 and actor_user_id = $2", [enquiryId, adminId])).toBe(1)

    await adminPage.goto(`${BASE()}/admin/enquiries?status=new`)
    expect(await adminPage.getByText(ENQUIRY_MESSAGE).count()).toBe(0)
    await adminPage.goto(`${BASE()}/admin/enquiries?status=handled`)
    const handled = adminPage.getByRole('listitem').filter({ hasText: ENQUIRY_MESSAGE })
    await handled.getByText(/^Handled/).waitFor()
    expect(await handled.getByRole('button', { name: 'Mark handled' }).count()).toBe(0)

    await adminPage.goto(`${BASE()}/admin/audit?action=enquiry_handled`)
    expect(await adminPage.getByRole('listitem').filter({ hasText: enquiryId.slice(0, 8) }).filter({ hasText: 'status: handled' }).count()).toBe(1)
  })
})

describe('a narrower role is shown only what it can use', () => {
  it('a reviewer sees the applications queue but no enquiries, members or audit trail, and can sign out', async () => {
    const page = await newPage(browser)
    await signInThroughForm(page, mail('reviewer'), { next: '/admin/overview' })
    await page.waitForURL((u) => u.pathname === '/admin/overview', { timeout: 60_000 })
    const nav = page.getByRole('navigation', { name: 'Admin' })
    await nav.getByRole('link', { name: 'Applications' }).waitFor()
    for (const hidden of ['Enquiries', 'Members', 'Audit trail', 'Analytics']) expect(await nav.getByRole('link', { name: hidden }).count(), hidden).toBe(0)

    for (const path of ['/admin/audit', '/admin/enquiries', '/admin/members']) {
      expect((await page.goto(`${BASE()}${path}`))?.status(), path).toBe(404)
    }
    // the reviewer can still open the queue
    expect((await page.goto(`${BASE()}/admin/applications`))?.status()).toBe(200)

    await Promise.all([page.waitForURL((u) => u.pathname === '/'), page.getByRole('button', { name: 'Log out' }).click()])
    expect((await page.goto(`${BASE()}/admin/applications`))?.status()).toBe(404)
    await page.context().close()
  })
})
