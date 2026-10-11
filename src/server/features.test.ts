import { describe, expect, it } from 'vitest'
import { isLabAttendanceQrEnabled, isLabBookingEnabled } from './features'

describe('isLabAttendanceQrEnabled', () => {
  it('is off when unset', () => expect(isLabAttendanceQrEnabled({})).toBe(false))
  it('is off for anything but the exact string "true"', () => {
    for (const v of ['', 'false', '1', 'TRUE', 'yes', ' true']) {
      expect(isLabAttendanceQrEnabled({ FEATURE_LAB_BOOKING: 'true', FEATURE_LAB_ATTENDANCE_QR: v })).toBe(false)
    }
  })
  it('also requires lab booking', () => {
    expect(isLabAttendanceQrEnabled({ FEATURE_LAB_ATTENDANCE_QR: 'true' })).toBe(false)
    expect(isLabAttendanceQrEnabled({ FEATURE_LAB_BOOKING: 'false', FEATURE_LAB_ATTENDANCE_QR: 'true' })).toBe(false)
  })
  it('is on only when both are "true"', () => {
    expect(isLabAttendanceQrEnabled({ FEATURE_LAB_BOOKING: 'true', FEATURE_LAB_ATTENDANCE_QR: 'true' })).toBe(true)
  })
})

describe('isLabBookingEnabled', () => {
  it('is off when unset', () => expect(isLabBookingEnabled({})).toBe(false))
  it('is off for anything but the exact string "true"', () => {
    for (const v of ['', 'false', '1', 'TRUE', 'yes', ' true']) {
      expect(isLabBookingEnabled({ FEATURE_LAB_BOOKING: v })).toBe(false)
    }
  })
  it('is on only for "true"', () => expect(isLabBookingEnabled({ FEATURE_LAB_BOOKING: 'true' })).toBe(true))
})
