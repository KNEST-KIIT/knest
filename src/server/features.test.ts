import { describe, expect, it } from 'vitest'
import { isLabBookingEnabled } from './features'

describe('isLabBookingEnabled', () => {
  it('is off when unset', () => expect(isLabBookingEnabled({})).toBe(false))
  it('is off for anything but the exact string "true"', () => {
    for (const v of ['', 'false', '1', 'TRUE', 'yes', ' true']) {
      expect(isLabBookingEnabled({ FEATURE_LAB_BOOKING: v })).toBe(false)
    }
  })
  it('is on only for "true"', () => expect(isLabBookingEnabled({ FEATURE_LAB_BOOKING: 'true' })).toBe(true))
})
