import { describe, expect, it } from 'vitest'
import { safeNext } from './safe-next'

const BS = String.fromCharCode(92) // backslash, built explicitly so no escaping can mangle it
const TAB = String.fromCharCode(9)
const LF = String.fromCharCode(10)
const CR = String.fromCharCode(13)

describe('safeNext', () => {
  it('accepts same-origin absolute paths, with query and hash', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/apply/ignite?step=2#top')).toBe('/apply/ignite?step=2#top')
    expect(safeNext('/onboarding?stage=idea')).toBe('/onboarding?stage=idea')
  })

  const MALICIOUS = [
    '//evil.com',
    '//evil.com/path',
    '///evil.com',
    `/${BS}evil.com`,
    `/${BS}/evil.com`,
    `${BS}${BS}evil.com`,
    `/ok${BS}..${BS}evil.com`,
    'https://evil.com',
    'http://evil.com/dashboard',
    'javascript:alert(1)',
    'data:text/html,hi',
    'evil.com',
    'dashboard',
    `/${TAB}/evil.com`,
    `/${LF}/evil.com`,
    `/${CR}/evil.com`,
    '/ /evil.com',
    '/\u0000/evil.com',
  ]

  it.each(MALICIOUS.map((m) => [JSON.stringify(m), m]))('rejects %s', (_label, raw) => {
    expect(safeNext(raw)).toBeNull()
  })

  it('never returns anything but a single-slash path', () => {
    for (const raw of [...MALICIOUS, '/%2F%2Fevil.com', '/%5Cevil.com', '/a/../../b']) {
      const out = safeNext(raw)
      if (out !== null) {
        expect(out.startsWith('/')).toBe(true)
        expect(out.startsWith('//')).toBe(false)
        expect(out.includes(BS)).toBe(false)
      }
    }
  })

  it('returns null for empty, nullish and oversized input', () => {
    expect(safeNext('')).toBeNull()
    expect(safeNext(null)).toBeNull()
    expect(safeNext(undefined)).toBeNull()
    expect(safeNext('/' + 'a'.repeat(3000))).toBeNull()
  })
})
