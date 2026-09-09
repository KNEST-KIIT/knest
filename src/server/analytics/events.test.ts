import { describe, expect, it } from 'vitest'
import { CLIENT_EVENTS, isClientEvent, sanitiseProps } from './events'

describe('isClientEvent', () => {
  it('accepts exactly what is on the list', () => {
    for (const event of CLIENT_EVENTS) expect(isClientEvent(event)).toBe(true)
  })

  it('rejects anything else, including real server-side event names', () => {
    // These are written from inside server actions and must not be forgeable
    // from a browser — an invented `application_accepted` row would corrupt
    // the funnel the staff analytics page reports on.
    for (const event of ['application_accepted', 'level_granted', 'lab_booking_decided']) {
      expect(isClientEvent(event)).toBe(false)
    }
    expect(isClientEvent('')).toBe(false)
    expect(isClientEvent(null)).toBe(false)
    expect(isClientEvent(42)).toBe(false)
    expect(isClientEvent({ toString: () => 'journey_selector_choice' })).toBe(false)
  })
})

describe('sanitiseProps', () => {
  it('keeps flat scalars', () => {
    expect(sanitiseProps({ path: '/onboarding', index: 2, first: true })).toEqual({
      path: '/onboarding',
      index: 2,
      first: true,
    })
  })

  it('drops nested shapes rather than storing them', () => {
    expect(sanitiseProps({ nested: { a: 1 }, list: [1, 2], ok: 'yes' })).toEqual({ ok: 'yes' })
  })

  it('caps the number of keys and the length of a value', () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(sanitiseProps(many)!)).toHaveLength(10)
    expect(sanitiseProps({ long: 'x'.repeat(500) })!.long).toHaveLength(200)
  })

  it('is undefined for anything that is not a plain object', () => {
    expect(sanitiseProps(null)).toBeUndefined()
    expect(sanitiseProps([1, 2])).toBeUndefined()
    expect(sanitiseProps('a string')).toBeUndefined()
    expect(sanitiseProps({})).toBeUndefined()
    expect(sanitiseProps({ nothing: { usable: true } })).toBeUndefined()
  })
})
