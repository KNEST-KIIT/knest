import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, db, decodeMailText, get, login, readMail, uniqueIp, type Session } from '../support/helpers'
import { payloadClient } from '../support/payload'

/** Registering for an event confirms it in the app and by e-mail, exactly once. */

const stamp = Date.now()
const DAY = 24 * 60 * 60 * 1000
let me: Session
let eventId: number
let eventSlug: string
const mail = `registrant-${stamp}@events.test`

const post = (path: string, who: Session) =>
  fetch(`${BASE()}${path}`, { method: 'POST', headers: { 'x-forwarded-for': uniqueIp(), cookie: who.cookie } })
const mailsTo = (to: string) => readMail().filter((m) => m.to.some((r) => r.includes(to)))

beforeAll(async () => {
  await createUser({ email: mail, platformRole: 'student' })
  // the dashboard is for people who finished onboarding
  await db().query('update app.users set onboarding_completed_at = now() where email = $1', [mail])
  me = (await login(mail))!
  const payload = await payloadClient()
  const doc = await payload.create({
    collection: 'events',
    data: {
      title: `Confirmation Workshop ${stamp}`,
      summary: 'Created by the event notification suite',
      // 20:30 UTC is 02:00 the next day in India: the e-mail must say IST, not the server clock
      startsAt: new Date(Math.floor((Date.now() + 5 * DAY) / DAY) * DAY + 20.5 * 60 * 60 * 1000).toISOString(),
      location: 'Campus 6, Room 204',
      _status: 'published',
    } as never,
    overrideAccess: true,
  })
  eventId = doc.id as number
  eventSlug = (doc as { slug: string }).slug
})
afterAll(closeDb)

describe('event registration confirmation', () => {
  it('sends one in-app notice and one e-mail with an absolute link, the place and the time in IST', async () => {
    const res = await post(`/api/events/${eventId}/register`, me)
    expect(res.status).toBe(200)

    const rows = (await db().query("select type, title, body, href from app.notifications n join app.users u on u.id = n.user_id where u.email = $1 and n.type = 'event_registered'", [mail])).rows
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toContain(`Confirmation Workshop ${stamp}`)
    expect(rows[0].body).toContain('IST')
    expect(rows[0].body).toContain('Campus 6, Room 204')
    expect(rows[0].href).toBe(`/events/${eventSlug}`)

    await expect.poll(() => mailsTo(mail).length, { timeout: 20_000 }).toBe(1)
    const text = decodeMailText(mailsTo(mail)[0]!.body)
    expect(text).toContain(`Confirmation Workshop ${stamp}`)
    expect(text).toContain('Campus 6, Room 204')
    expect(text).toContain('IST')
    expect(text).toMatch(new RegExp(`https?://[^\\s]+/events/${eventSlug}`))
  })

  it('does not repeat itself when the same person registers again, in two tabs at once', async () => {
    await Promise.all([post(`/api/events/${eventId}/register`, me), post(`/api/events/${eventId}/register`, me), post(`/api/events/${eventId}/register`, me)])
    await new Promise((r) => setTimeout(r, 1500))
    expect((await db().query("select count(*)::int c from app.notifications n join app.users u on u.id = n.user_id where u.email = $1 and n.type = 'event_registered'", [mail])).rows[0].c).toBe(1)
    expect(mailsTo(mail)).toHaveLength(1)
    expect((await db().query('select count(*)::int c from app.event_registrations where event_id = $1', [eventId])).rows[0].c).toBe(1)
  })

  it('shows the confirmation on the member’s dashboard', async () => {
    const html = await (await get('/dashboard', me)).text()
    expect(html).toContain(`Confirmation Workshop ${stamp}`)
  })

  it('cancelling sends nothing further and a full or refused registration sends nothing at all', async () => {
    const before = mailsTo(mail).length
    expect((await post(`/api/events/${eventId}/unregister`, me)).status).toBe(200)
    const payload = await payloadClient()
    const closed = await payload.create({
      collection: 'events',
      data: { title: `Already Over ${stamp}`, summary: 'Past event', startsAt: new Date(Date.now() - 3 * DAY).toISOString(), endsAt: new Date(Date.now() - 2 * DAY).toISOString(), _status: 'published' } as never,
      overrideAccess: true,
    })
    expect((await post(`/api/events/${closed.id}/register`, me)).status).toBe(400)
    await new Promise((r) => setTimeout(r, 1000))
    expect(mailsTo(mail)).toHaveLength(before)
    expect((await db().query("select count(*)::int c from app.notifications n join app.users u on u.id = n.user_id where u.email = $1 and n.title like '%Already Over%'", [mail])).rows[0].c).toBe(0)
  })
})
