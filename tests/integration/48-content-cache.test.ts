import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, get, login, uniqueIp, type Session } from '../support/helpers'
import { payloadClient } from '../support/payload'

/**
 * The shared cache of published CMS reads (src/server/content/cache.ts), proved against a real server.
 *
 * The suite normally runs the server with CONTENT_CACHE=off, because its own process edits the CMS from
 * outside the server and would otherwise see stale pages. This file needs the cache on, so it runs only when
 * the suite is started with TEST_CONTENT_CACHE=on:
 *
 *   TEST_CONTENT_CACHE=on npx vitest run --config vitest.integration.config.mts tests/integration/48-content-cache.test.ts
 */

const enabled = process.env.TEST_CONTENT_CACHE === 'on'
const stamp = Date.now()
let staff: Session
let eventId: number

const listing = async () => (await get('/events')).text()

async function patchAsStaff(id: number, data: Record<string, unknown>) {
  return fetch(`${BASE()}/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: staff.cookie, 'x-forwarded-for': uniqueIp(), origin: new URL(BASE()).origin },
    body: JSON.stringify(data),
  })
}

beforeAll(async () => {
  if (!enabled) return
  await createUser({ email: `cache-${stamp}@cache.test`, staffRole: 'super_admin' })
  staff = (await login(`cache-${stamp}@cache.test`))!
  const payload = await payloadClient()
  const created = await payload.create({
    collection: 'events',
    overrideAccess: true,
    data: { title: `Cache first ${stamp}`, summary: 'Cache check', startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(), _status: 'published' } as never,
  })
  eventId = created.id as number

  // Earlier files in the same run have already warmed the cache with the page as it was before this event
  // existed. Saving through the CMS (inside the server) is what expires it, exactly as an editor's save does.
  const warm = await patchAsStaff(eventId, { title: `Cache first ${stamp}` })
  if (warm.status >= 300) throw new Error(`setup save failed: ${warm.status} ${await warm.text()}`)
})
afterAll(closeDb)

describe.skipIf(!enabled)('published content cache', () => {
  it('serves a repeat visit from the cache, and a change made in the CMS shows on the very next visit', async () => {
    expect(await listing()).toContain(`Cache first ${stamp}`)

    // An edit made outside the server (no hook runs in this process) is not seen: the cache is really holding the page's data.
    const payload = await payloadClient()
    await payload.update({ collection: 'events', id: eventId, overrideAccess: true, data: { title: `Cache outside ${stamp}` } as never })
    const stale = await listing()
    expect(stale).toContain(`Cache first ${stamp}`)
    expect(stale).not.toContain(`Cache outside ${stamp}`)

    // An edit through the CMS runs the expiry hook inside the server, so the next visit is current.
    const res = await patchAsStaff(eventId, { title: `Cache after ${stamp}` })
    expect(res.status, await res.clone().text()).toBeLessThan(300)
    const fresh = await listing()
    expect(fresh).toContain(`Cache after ${stamp}`)
    expect(fresh).not.toContain(`Cache first ${stamp}`)
  })
})
