import type { Browser, Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { rangeLabel } from '../../src/lib/lab-format'
import { istInstant, istParts } from '../../src/server/labs/rules'
import { BASE, closeDb, createUser, db, login, type Session } from '../support/helpers'
import { launchBrowser, newContext, waitForMailText } from '../support/journey'

/**
 * Booking a lab, as the people involved do it, in a real browser against the production build and
 * a real database: a member picks a day and a time and asks; the lab head sees the request, approves
 * it, and the member sees the answer; the member cancels and the time is free again; a second
 * request is declined with a reason the member can read. Each step asserts what is on the screen
 * and what is in the database (rows, audit entries, notices, e-mail).
 */

const stamp = Date.now()
const mail = (n: string) => `${n}-${stamp}@labjourney.test`
const LAB = `Journey Maker Lab ${stamp}`
const LAB_SLUG = `journey-maker-lab-${stamp}`
const PURPOSE = 'Soldering and testing the sensor board for our project'
const DECLINE_REASON = 'The laser cutter is being serviced that afternoon'

const dayOf = (daysAhead: number) => istParts(new Date(Date.now() + daysAhead * 86_400_000)).date
const SLOT_DATE = dayOf(3)
const SLOT_START = istInstant(SLOT_DATE, 10 * 60)
const SLOT_END = istInstant(SLOT_DATE, 11 * 60)
const SECOND_DATE = dayOf(4)

let browser: Browser
let labId = ''
const people: Record<'member' | 'other' | 'head', { id: string; session: Session; page: Page }> = {} as never
let bookingId = ''
let secondBookingId = ''

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db().query(sql, params)).rows[0] as T
const count = async (sql: string, params: unknown[] = []) => (await one<{ c: number }>(sql, params)).c
const slotButton = (page: Page, from: string, to: string) => page.getByRole('button', { name: new RegExp(`^${from}–${to}`) })

/** Opens the lab's booking page, picks the day, and waits until the times have loaded. */
async function openDay(page: Page, date: string) {
  await page.goto(`${BASE()}/dashboard/lab-booking/${LAB_SLUG}`, { waitUntil: 'networkidle' }) // hydrated, so the date change is seen
  await Promise.all([page.waitForResponse((r) => r.url().includes(`/availability?date=${date}`) && r.ok()), page.locator('#date').fill(date)])
  await slotButton(page, '09:00', '10:00').waitFor()
}

async function sendRequest(page: Page, from: string, to: string, purpose: string, headcount: number) {
  await slotButton(page, from, to).click()
  await page.getByText(`${from}–${to} IST`).waitFor() // "Your request: ..."
  await page.getByLabel('What will you do?').fill(purpose)
  await page.getByLabel(/How many people/).fill(String(headcount))
  await Promise.all([page.waitForResponse((r) => r.url().includes(`/api/labs/${LAB_SLUG}/request`) && r.status() === 201), page.getByRole('button', { name: 'Send request' }).click()])
  await page.getByText('Request sent.').waitFor()
}

beforeAll(async () => {
  browser = await launchBrowser()

  const lab = await db().query("insert into app.labs (id, slug, name, department, capacity, description) values (gen_random_uuid()::text, $1, $2, 'Engineering', 4, 'A lab for the lab-booking journey suite.') returning id", [LAB_SLUG, LAB])
  labId = lab.rows[0].id as string
  for (let weekday = 0; weekday < 7; weekday++) {
    await db().query('insert into app.lab_hours (id, lab_id, weekday, opens_minute, closes_minute) values (gen_random_uuid()::text, $1, $2, 540, 1080)', [labId, weekday])
  }

  for (const [tag, name] of [['member', 'Ishaan Maker'], ['other', 'Tara Tinker'], ['head', 'Dr Vikram Head']] as const) {
    const email = mail(tag)
    const id = await createUser({ email, platformRole: 'student' })
    await db().query('update app.users set name = $2, onboarding_completed_at = now(), journey_stage = $3 where id = $1', [id, name, 'idea'])
    const session = (await login(email))!
    const page = await (await newContext(browser, session)).newPage()
    people[tag] = { id, session, page }
  }
  await db().query("insert into app.lab_staff (id, lab_id, user_id, role) values (gen_random_uuid()::text, $1, $2, 'head')", [labId, people.head.id])
})

afterAll(async () => {
  for (const p of Object.values(people)) await p?.page.context().close()
  await browser?.close()
  await closeDb()
})

describe('a member books a lab and the lab head decides', () => {
  it('the member finds the lab and reads how booking works before choosing a time', async () => {
    const { page } = people.member
    await page.goto(`${BASE()}/dashboard/lab-booking`)
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe('Lab booking')
    await page.getByText('You haven’t requested any lab time yet.').waitFor()
    const card = page.getByRole('listitem').filter({ hasText: LAB })
    await card.getByText('Engineering · up to 4 people').waitFor()
    await Promise.all([page.waitForURL((u) => u.pathname === `/dashboard/lab-booking/${LAB_SLUG}`), card.getByRole('link', { name: 'See times and book' }).click()])

    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(LAB)
    await page.getByText('Times are in blocks of 60 minutes, up to 3 in a row.').waitFor()
    await page.getByText('Monday: 09:00 to 18:00').waitFor()
    // nothing can be sent before a time is chosen
    expect(await page.getByRole('button', { name: 'Send request' }).isDisabled()).toBe(true)
  })

  it('picks a day, sees the open times, chooses one and sends the request', async () => {
    const { page } = people.member
    await openDay(page, SLOT_DATE)
    // opening hours 09:00 to 18:00 give nine one-hour blocks
    expect(await page.locator('fieldset').getByRole('button').count()).toBe(9)
    expect(await slotButton(page, '10:00', '11:00').isEnabled()).toBe(true)
    await sendRequest(page, '10:00', '11:00', PURPOSE, 2)

    const row = await one<{ id: string; status: string; starts_at: Date; ends_at: Date; purpose: string; headcount: number; user_id: string; decided_by: string | null }>(
      'select id, status, starts_at, ends_at, purpose, headcount, user_id, decided_by from app.lab_bookings where lab_id = $1',
      [labId],
    )
    bookingId = row.id
    expect(row).toMatchObject({ status: 'requested', purpose: PURPOSE, headcount: 2, user_id: people.member.id, decided_by: null })
    expect(row.starts_at.getTime()).toBe(SLOT_START.getTime()) // India time, whatever the server clock
    expect(row.ends_at.getTime()).toBe(SLOT_END.getTime())

    // the time just asked for is now shown as taken on that same screen
    await slotButton(page, '10:00', '11:00').waitFor()
    expect(await slotButton(page, '10:00', '11:00').isDisabled()).toBe(true)
  })

  it('the member sees the request waiting, in their list of bookings', async () => {
    const { page } = people.member
    await page.goto(`${BASE()}/dashboard/lab-booking`)
    const mine = page.getByRole('listitem').filter({ hasText: PURPOSE })
    await mine.getByText('Waiting for the lab head').waitFor()
    await mine.getByText(rangeLabel(SLOT_START, SLOT_END)).waitFor()
    await mine.getByRole('button', { name: 'Cancel booking' }).waitFor()
  })

  it('another member cannot take the same time; it is struck out for them', async () => {
    const { page } = people.other
    await openDay(page, SLOT_DATE)
    expect(await slotButton(page, '10:00', '11:00').isDisabled()).toBe(true)
    expect(await slotButton(page, '10:00', '11:00').textContent()).toContain('(taken)')
    expect(await slotButton(page, '11:00', '12:00').isEnabled()).toBe(true)
    expect(await count("select count(*)::int c from app.lab_bookings where lab_id = $1 and status <> 'cancelled'", [labId])).toBe(1)
  })

  it('the lab head is told, from the dashboard and by e-mail, and finds the request in the lab console', async () => {
    expect(await count("select count(*)::int c from app.notifications where user_id = $1 and type = 'booking_requested'", [people.head.id])).toBe(1)
    const text = await waitForMailText(mail('head'), /has asked to book/)
    expect(text).toContain(LAB)
    expect(text).toContain(PURPOSE)

    const { page } = people.head
    await page.goto(`${BASE()}/dashboard`)
    await page.getByText(`New booking request for ${LAB}`).waitFor()
    await Promise.all([page.waitForURL((u) => u.pathname === '/dashboard/lab-staff'), page.getByRole('link', { name: 'Your labs: requests, schedule and reports' }).click()])
    const card = page.getByRole('listitem').filter({ hasText: LAB })
    await card.getByText('Lab head').waitFor()
    await Promise.all([page.waitForURL((u) => u.pathname === `/dashboard/lab-staff/${LAB_SLUG}`), card.getByRole('link', { name: 'Open console' }).click()])

    const section = page.getByRole('region', { name: /Requests waiting/ })
    await section.getByText('Requests waiting (1)').waitFor()
    await section.getByText(`Ishaan Maker (${mail('member')})`).waitFor()
    await section.getByText(PURPOSE).waitFor()
    await section.getByText(rangeLabel(SLOT_START, SLOT_END) + ' · 2 people').waitFor()
  })

  it('approves it; the queue empties and the booking moves to approved and coming up', async () => {
    const { page } = people.head
    await Promise.all([page.waitForResponse((r) => r.url().includes(`/api/labs/bookings/${bookingId}/decide`) && r.ok()), page.getByRole('button', { name: 'Approve' }).click()])
    await page.getByText('Requests waiting (0)').waitFor({ timeout: 30_000 })
    await page.getByText('Nothing is waiting for a decision.').waitFor()
    await page.getByText('Approved and coming up (1)').waitFor()
    await page.getByRole('region', { name: /Approved and coming up/ }).getByText(PURPOSE).waitFor()

    const row = await one<{ status: string; decided_by: string | null; decided_at: Date | null }>('select status, decided_by, decided_at from app.lab_bookings where id = $1', [bookingId])
    expect(row.status).toBe('approved')
    expect(row.decided_by).toBe(people.head.id)
    expect(row.decided_at).not.toBeNull()
    const audit = await one<{ actor_user_id: string; before: { status: string }; after: { status: string } }>("select actor_user_id, before, after from app.audit_logs where action = 'lab_booking_approved' and entity_id = $1", [bookingId])
    expect(audit.actor_user_id).toBe(people.head.id)
    expect(audit.before.status).toBe('requested')
    expect(audit.after.status).toBe('approved')
  })

  it('the member sees the answer: status, notice and e-mail', async () => {
    const { page } = people.member
    await page.goto(`${BASE()}/dashboard/lab-booking`)
    const mine = page.getByRole('listitem').filter({ hasText: PURPOSE })
    await mine.getByText('Approved', { exact: true }).waitFor()
    expect(await mine.getByText('Waiting for the lab head').count()).toBe(0)

    expect(await count("select count(*)::int c from app.notifications where user_id = $1 and type = 'booking_decided' and read_at is null", [people.member.id])).toBe(1)
    await page.goto(`${BASE()}/dashboard`)
    await page.getByText(`${LAB}: your booking is approved`).waitFor()
    const text = await waitForMailText(mail('member'), /is approved\./)
    expect(text).toContain(`Your booking of ${LAB} is approved.`)
  })

  it('the member cancels the approved booking; it is marked cancelled, the head is told, and the time is free again', async () => {
    const { page } = people.member
    await page.goto(`${BASE()}/dashboard/lab-booking`)
    const mine = page.getByRole('listitem').filter({ hasText: PURPOSE })
    await Promise.all([page.waitForResponse((r) => r.url().includes(`/api/labs/bookings/${bookingId}/cancel`) && r.ok()), mine.getByRole('button', { name: 'Cancel booking' }).click()])
    await mine.getByText('Cancelled', { exact: true }).waitFor({ timeout: 30_000 })
    expect(await mine.getByRole('button', { name: 'Cancel booking' }).count()).toBe(0)

    expect((await one('select status from app.lab_bookings where id = $1', [bookingId])).status).toBe('cancelled')
    expect(await count("select count(*)::int c from app.notifications where user_id = $1 and type = 'booking_cancelled'", [people.head.id])).toBe(1)
    await waitForMailText(mail('head'), /was cancelled by Ishaan Maker/)

    // the other member can now take the time
    await openDay(people.other.page, SLOT_DATE)
    expect(await slotButton(people.other.page, '10:00', '11:00').isEnabled()).toBe(true)

    // the head's console no longer lists it as coming up, and keeps it in the history
    await people.head.page.goto(`${BASE()}/dashboard/lab-staff/${LAB_SLUG}`)
    await people.head.page.getByText('Approved and coming up (0)').waitFor()
    const history = people.head.page.getByRole('region', { name: 'Recent history' })
    await history.getByText('Cancelled', { exact: true }).waitFor()
  })

  it('a second request is declined with a reason, and the member can read it', async () => {
    const { page } = people.member
    await openDay(page, SECOND_DATE)
    await sendRequest(page, '14:00', '15:00', 'Laser cutting the enclosure', 1)
    secondBookingId = (await one<{ id: string }>("select id from app.lab_bookings where lab_id = $1 and status = 'requested'", [labId])).id

    const head = people.head.page
    await head.goto(`${BASE()}/dashboard/lab-staff/${LAB_SLUG}`)
    await head.getByText('Requests waiting (1)').waitFor()
    await head.getByRole('button', { name: 'Decline…' }).click()
    await head.getByLabel('Reason (the person will read this)').fill(DECLINE_REASON)
    await Promise.all([head.waitForResponse((r) => r.url().includes(`/api/labs/bookings/${secondBookingId}/decide`) && r.ok()), head.getByRole('button', { name: 'Send decision' }).click()])
    await head.getByText('Requests waiting (0)').waitFor({ timeout: 30_000 })

    const row = await one<{ status: string; decision_note: string | null }>('select status, decision_note from app.lab_bookings where id = $1', [secondBookingId])
    expect(row).toMatchObject({ status: 'rejected', decision_note: DECLINE_REASON })
    expect(await count("select count(*)::int c from app.audit_logs where action = 'lab_booking_rejected' and entity_id = $1 and actor_user_id = $2", [secondBookingId, people.head.id])).toBe(1)

    await page.goto(`${BASE()}/dashboard/lab-booking`)
    const mine = page.getByRole('listitem').filter({ hasText: 'Laser cutting the enclosure' })
    await mine.getByText('Not approved', { exact: true }).waitFor()
    await mine.getByText(`Note from the lab: ${DECLINE_REASON}`).waitFor()
    expect(await mine.getByRole('button', { name: 'Cancel booking' }).count()).toBe(0) // nothing left to cancel
    const text = await waitForMailText(mail('member'), /was not approved/)
    expect(text).toContain(DECLINE_REASON)

    // the declined time is open to everyone again
    await openDay(people.other.page, SECOND_DATE)
    expect(await slotButton(people.other.page, '14:00', '15:00').isEnabled()).toBe(true)
  })

  it('the lab head’s console is closed to a member who does not run the lab', async () => {
    const { page } = people.member
    for (const path of [`/dashboard/lab-staff/${LAB_SLUG}`, '/dashboard/lab-staff']) {
      await page.goto(`${BASE()}${path}`)
      await page.getByRole('heading', { level: 1, name: 'This page doesn’t exist.' }).waitFor()
      expect(await page.getByText(PURPOSE).count(), path).toBe(0)
    }
  })
})
