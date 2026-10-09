import { afterEach, describe, expect, it } from 'vitest'
import { UnauthorizedError } from '@/server/auth/guards'
import { labRoute, respond } from './http'

const original = process.env.FEATURE_LAB_BOOKING
afterEach(() => {
  if (original === undefined) delete process.env.FEATURE_LAB_BOOKING
  else process.env.FEATURE_LAB_BOOKING = original
})

describe('labRoute', () => {
  it('answers 404 to everything while the feature is off, without running the handler', async () => {
    let ran = false
    for (const value of [undefined, 'false', '', '1', 'TRUE']) {
      if (value === undefined) delete process.env.FEATURE_LAB_BOOKING
      else process.env.FEATURE_LAB_BOOKING = value
      const res = await labRoute(async () => {
        ran = true
        return Response.json({ ok: true }) as never
      })
      expect(res.status, String(value)).toBe(404)
    }
    expect(ran).toBe(false)
  })

  it('runs the handler when the feature is on, and maps a failed permission check to its status', async () => {
    process.env.FEATURE_LAB_BOOKING = 'true'
    expect((await labRoute(async () => Response.json({ ok: true }) as never)).status).toBe(200)
    expect((await labRoute(async () => { throw new UnauthorizedError(401) })).status).toBe(401)
    expect((await labRoute(async () => { throw new UnauthorizedError(403) })).status).toBe(403)
  })
})

describe('respond', () => {
  it('maps each failure code to a stable status and keeps the readable message', async () => {
    const cases = [['closed', 404], ['ineligible', 403], ['invalid', 400], ['limit', 409], ['conflict', 409], ['not-found', 404], ['state', 409], ['forbidden', 403]] as const
    for (const [code, status] of cases) {
      const res = respond({ ok: false, error: 'Words for a person.', code })
      expect(res.status, code).toBe(status)
      expect(await res.json()).toEqual({ error: 'Words for a person.', code })
    }
  })
  it('passes success through with the chosen status', async () => {
    const res = respond({ ok: true, id: 'abc' }, 201)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true, id: 'abc' })
  })
})
