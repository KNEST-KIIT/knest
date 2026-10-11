import { afterEach, describe, expect, it } from 'vitest'
import { UnauthorizedError } from '@/server/auth/guards'
import { qrRoute, respondQr } from './qr-http'

const originalBooking = process.env.FEATURE_LAB_BOOKING
const originalQr = process.env.FEATURE_LAB_ATTENDANCE_QR
afterEach(() => {
  for (const [key, value] of [['FEATURE_LAB_BOOKING', originalBooking], ['FEATURE_LAB_ATTENDANCE_QR', originalQr]] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('qrRoute', () => {
  it('answers 404 without running the handler unless both flags are exactly "true"', async () => {
    let ran = false
    const handler = async () => {
      ran = true
      return Response.json({ ok: true }) as never
    }
    const combos: [string | undefined, string | undefined][] = [
      [undefined, undefined],
      ['true', undefined],
      [undefined, 'true'],
      ['true', 'false'],
      ['false', 'true'],
      ['true', 'TRUE'],
      ['true', '1'],
    ]
    for (const [booking, qr] of combos) {
      if (booking === undefined) delete process.env.FEATURE_LAB_BOOKING
      else process.env.FEATURE_LAB_BOOKING = booking
      if (qr === undefined) delete process.env.FEATURE_LAB_ATTENDANCE_QR
      else process.env.FEATURE_LAB_ATTENDANCE_QR = qr
      const res = await qrRoute(handler)
      expect(res.status, `${booking}/${qr}`).toBe(404)
    }
    expect(ran).toBe(false)
  })

  it('runs the handler when both are on and maps a failed permission check to its status', async () => {
    process.env.FEATURE_LAB_BOOKING = 'true'
    process.env.FEATURE_LAB_ATTENDANCE_QR = 'true'
    expect((await qrRoute(async () => Response.json({ ok: true }) as never)).status).toBe(200)
    expect((await qrRoute(async () => { throw new UnauthorizedError(401) })).status).toBe(401)
    expect((await qrRoute(async () => { throw new UnauthorizedError(403) })).status).toBe(403)
  })
})

describe('respondQr', () => {
  it('maps each failure code to a stable status and never caches', async () => {
    const cases = [['closed', 404], ['invalid', 400], ['not-found', 404], ['forbidden', 403], ['conflict', 409], ['limit', 409]] as const
    for (const [code, status] of cases) {
      const res = respondQr({ ok: false, error: 'Words.', code })
      expect(res.status, code).toBe(status)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })
})
