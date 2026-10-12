import { describe, expect, it } from 'vitest'
import { buildIcs, escapeIcsText, foldIcsLine } from './ics'

const base = {
  uid: 'event-7@knest.example',
  title: 'Demo day, spring; round 2',
  summary: 'Line one\nLine two',
  location: 'Campus 11',
  url: 'https://knest.example/events/demo-day',
  startsAt: new Date('2026-11-05T04:30:00.000Z'),
  endsAt: new Date('2026-11-05T07:00:00.000Z'),
  stamp: new Date('2026-10-12T10:00:00.000Z'),
}

describe('escapeIcsText', () => {
  it('escapes separators and newlines', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
  })
})

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds long lines into 75 octet pieces', () => {
    const folded = foldIcsLine('DESCRIPTION:' + 'x'.repeat(200))
    for (const piece of folded.split('\r\n')) {
      expect(new TextEncoder().encode(piece).length).toBeLessThanOrEqual(75)
    }
    expect(folded.split('\r\n').map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe('DESCRIPTION:' + 'x'.repeat(200))
  })
})

describe('buildIcs', () => {
  it('produces a CRLF calendar with UTC times and escaped text', () => {
    const out = buildIcs(base)
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(out).toContain('DTSTART:20261105T043000Z\r\n')
    expect(out).toContain('DTEND:20261105T070000Z\r\n')
    expect(out).toContain('DTSTAMP:20261012T100000Z\r\n')
    expect(out).toContain('SUMMARY:Demo day\\, spring\\; round 2\r\n')
    expect(out).toContain('DESCRIPTION:Line one\\nLine two\r\n')
  })

  it('gives an event without an end a one hour length', () => {
    const out = buildIcs({ ...base, endsAt: null })
    expect(out).toContain('DTEND:20261105T053000Z\r\n')
  })

  it('ignores an end that is not after the start', () => {
    const out = buildIcs({ ...base, endsAt: base.startsAt })
    expect(out).toContain('DTEND:20261105T053000Z\r\n')
  })

  it('omits location and description when absent', () => {
    const out = buildIcs({ ...base, location: null, summary: null })
    expect(out).not.toContain('LOCATION:')
    expect(out).not.toContain('DESCRIPTION:')
  })
})
