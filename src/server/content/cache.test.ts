import { describe, expect, it } from 'vitest'
import { cachedRead, cachedReadOr, contentCacheEnabled } from './cache'

describe('content cache', () => {
  it('is off outside a Next server, so unit tests and seed scripts read directly', async () => {
    expect(contentCacheEnabled({}, undefined)).toBe(false)
    let calls = 0
    const read = cachedRead('test', async (n: number) => {
      calls += 1
      return n * 2
    })
    expect(await read(2)).toBe(4)
    expect(await read(2)).toBe(4)
    expect(calls).toBe(2)
  })

  it('turns on under a Next server and can be switched off', () => {
    expect(contentCacheEnabled({}, 'nodejs')).toBe(true)
    expect(contentCacheEnabled({ CONTENT_CACHE: 'off' }, 'nodejs')).toBe(false)
  })

  it('turns a failing reader into the fallback for that request only', async () => {
    let fail = true
    const read = cachedReadOr('test-or', async () => {
      if (fail) throw new Error('database down')
      return 'real'
    }, 'fallback')
    expect(await read()).toBe('fallback')
    fail = false
    expect(await read()).toBe('real')
  })
})
