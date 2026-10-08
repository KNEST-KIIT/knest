import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.fn()
const checkRateLimit = vi.fn()
vi.mock('@/server/analytics/track', () => ({ track: (...a: unknown[]) => track(...a) }))
vi.mock('@/server/security/rate-limit', () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
  clientIp: () => '203.0.113.9',
  RATE_LIMITS: { analyticsTrack: { capacity: 60, refillIntervalSeconds: 600 } },
}))

import { POST } from './route'

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/analytics/track', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...headers },
    }),
  )

beforeEach(() => {
  track.mockReset()
  checkRateLimit.mockReset().mockResolvedValue(true)
})

describe('POST /api/analytics/track (KN-11)', () => {
  it('records an allowed event', async () => {
    const res = await post({ event: 'journey_selector_choice', props: { path: 'GROW' } })
    expect(res.status).toBe(200)
    expect(track).toHaveBeenCalledWith('journey_selector_choice', { path: 'GROW' })
  })

  it('refuses to forge a business-outcome event', async () => {
    for (const event of ['application_accepted', 'application_submit', 'signup']) {
      const res = await post({ event })
      expect(res.status).toBe(400)
    }
    expect(track).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    expect((await post('{not json')).status).toBe(400)
    expect(track).not.toHaveBeenCalled()
  })

  it('drops (204) when rate limited, writing nothing', async () => {
    checkRateLimit.mockResolvedValue(false)
    const res = await post({ event: 'journey_selector_choice' })
    expect(res.status).toBe(204)
    expect(track).not.toHaveBeenCalled()
  })

  it('drops (204) rather than failing open when the limiter is unavailable', async () => {
    checkRateLimit.mockRejectedValue(new Error('db down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post({ event: 'journey_selector_choice' })
    expect(res.status).toBe(204)
    expect(track).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('rejects oversized bodies', async () => {
    expect((await post({ event: 'journey_selector_choice' }, { 'content-length': '999999' })).status).toBe(413)
    expect((await post(JSON.stringify({ event: 'journey_selector_choice', pad: 'x'.repeat(5000) }))).status).toBe(413)
    expect(track).not.toHaveBeenCalled()
  })
})
