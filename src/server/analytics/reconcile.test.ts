import { describe, expect, it } from 'vitest'
import { reconcileFunnel } from './reconcile'

describe('reconcileFunnel', () => {
  it('reports a match', () => {
    const [row] = reconcileFunnel({ signup: 4 }, { signup: 4 })
    expect(row).toMatchObject({ event: 'signup', difference: 0, state: 'match' })
  })

  it('reports events missing when records outnumber events', () => {
    const [row] = reconcileFunnel({ application_submit: 1 }, { application_submit: 3 })
    expect(row).toMatchObject({ difference: -2, state: 'events-missing' })
    expect(row?.note).toContain('2 fewer events')
  })

  it('reports removed records when events outnumber records', () => {
    const [row] = reconcileFunnel({ event_register: 5 }, { event_register: 4 })
    expect(row).toMatchObject({ difference: 1, state: 'records-removed' })
  })

  it('treats an event with no rows as zero and orders by name', () => {
    const rows = reconcileFunnel({}, { b: 1, a: 0 })
    expect(rows.map((r) => [r.event, r.recorded, r.records])).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
    ])
  })
})
