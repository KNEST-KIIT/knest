import { afterAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, db } from '../support/helpers'

/**
 * Closing evidence for KN-11 (endpoint): forged events never reach
 * app.analytics_events, the one allowed event does, and floods are dropped.
 */

afterAll(closeDb)

const post = (body: unknown, ip: string, extra: Record<string, string> = {}) =>
  fetch(`${BASE()}/api/analytics/track`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const count = async (event?: string) =>
  (
    await db().query(
      event
        ? 'select count(*)::int c from app.analytics_events where event = $1'
        : 'select count(*)::int c from app.analytics_events',
      event ? [event] : [],
    )
  ).rows[0].c as number

describe('POST /api/analytics/track', () => {
  it('rejects forged business-outcome events and writes nothing', async () => {
    const before = await count()
    for (const event of ['application_accepted', 'application_submit', 'signup', 'onboarding_completed', 'x'.repeat(300)]) {
      const res = await post({ event, props: { applicationId: 'forged' } }, '203.0.113.10')
      expect(res.status, event.slice(0, 30)).toBe(400)
    }
    expect(await count()).toBe(before)
    expect(await count('application_accepted')).toBe(0)
  })

  it('rejects malformed and oversized bodies', async () => {
    const before = await count()
    expect((await post('{nope', '203.0.113.11')).status).toBe(400)
    expect((await post({ event: 'journey_selector_choice', pad: 'x'.repeat(5000) }, '203.0.113.11')).status).toBe(413)
    expect(await count()).toBe(before)
  })

  it('records the one allowed event, with props narrowed to bounded scalars', async () => {
    const res = await post(
      { event: 'journey_selector_choice', props: { path: 'EXPLORE', nested: { evil: 1 }, long: 'y'.repeat(500) } },
      '203.0.113.12',
    )
    expect(res.status).toBe(200)
    const row = (
      await db().query("select props from app.analytics_events where event = 'journey_selector_choice' order by created_at desc limit 1")
    ).rows[0]
    expect(row.props.path).toBe('EXPLORE')
    expect(row.props).not.toHaveProperty('nested')
    expect(String(row.props.long).length).toBe(64)
  })

  it('drops a flood from one address: at most 60 are stored, the rest answer 204', async () => {
    const ip = '203.0.113.13'
    const before = await count('journey_selector_choice')
    const statuses: number[] = []
    for (let i = 0; i < 75; i++) {
      statuses.push((await post({ event: 'journey_selector_choice', props: { i } }, ip)).status)
    }
    const stored = (await count('journey_selector_choice')) - before
    expect(stored).toBeLessThanOrEqual(60)
    expect(statuses.filter((s) => s === 204).length).toBeGreaterThanOrEqual(15)
    expect(statuses.filter((s) => s === 200).length).toBe(stored)
  })

  // KN-22c is still open: the limiter keys on the first x-forwarded-for hop, which a
  // caller controls. This documents the gap; it flips to passing when the key is
  // derived from the trusted proxy (S-1 decides which header that is).
  it.fails('KN-22c (OPEN): rotating X-Forwarded-For does not bypass the limit', async () => {
    const before = await count('journey_selector_choice')
    for (let i = 0; i < 90; i++) {
      await post({ event: 'journey_selector_choice' }, `198.18.${Math.floor(i / 250)}.${(i % 250) + 1}`)
    }
    expect((await count('journey_selector_choice')) - before).toBeLessThanOrEqual(60)
  })
})
