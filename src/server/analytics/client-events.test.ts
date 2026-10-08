import { describe, expect, it } from 'vitest'
import { CLIENT_EVENTS, parseClientEvent, sanitiseProps } from './client-events'

describe('parseClientEvent (KN-11)', () => {
  it('accepts the journey selector event', () => {
    expect(parseClientEvent({ event: 'journey_selector_choice', props: { path: 'EXPLORE' } })).toEqual({
      event: 'journey_selector_choice',
      props: { path: 'EXPLORE' },
    })
  })

  it.each(['application_accepted', 'application_submit', 'signup', 'landing_view', '', '__proto__', 'x'.repeat(500)])(
    'rejects funnel/server-only or unknown event %j',
    (event) => expect(parseClientEvent({ event })).toBeNull(),
  )

  it.each([null, undefined, 'str', 42, [], { event: 5 }, { event: null }, {}])('rejects malformed body %j', (b) =>
    expect(parseClientEvent(b)).toBeNull(),
  )

  it('lists only the one client-originated event', () => {
    expect([...CLIENT_EVENTS]).toEqual(['journey_selector_choice'])
  })
})

describe('sanitiseProps', () => {
  it('keeps flat scalars, truncates strings, drops objects/arrays/non-finite numbers', () => {
    const out = sanitiseProps({
      a: 'x'.repeat(200),
      n: 3,
      b: true,
      nested: { evil: 1 },
      arr: [1],
      inf: Infinity,
    })
    expect(out.a).toHaveLength(64)
    expect(out).toMatchObject({ n: 3, b: true })
    expect(out).not.toHaveProperty('nested')
    expect(out).not.toHaveProperty('arr')
    expect(out).not.toHaveProperty('inf')
  })

  it('caps the number of keys and key length', () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(sanitiseProps(many))).toHaveLength(5)
    expect(sanitiseProps({ ['k'.repeat(50)]: 1 })).toEqual({})
  })

  it('returns {} for non-objects', () => {
    for (const v of [null, undefined, 'x', 1, []]) expect(sanitiseProps(v)).toEqual({})
  })
})
