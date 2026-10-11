import { describe, expect, it } from 'vitest'
import { generateStorageKey } from './index'

describe('generateStorageKey', () => {
  it('is dated, random and keeps a short alphanumeric extension', () => {
    const key = generateStorageKey('CV Final.PDF')
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}\.pdf$/)
    expect(generateStorageKey('CV Final.PDF')).not.toBe(key)
  })

  it('drops an extension that is long or carries anything but letters and digits', () => {
    for (const name of ['a.p/df', 'a.pdf\\..\\x', 'a.' + 'x'.repeat(30), 'a.p df', 'noextension', 'a.<svg>']) {
      expect(generateStorageKey(name), name).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}$/)
    }
  })
})
