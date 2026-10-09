import { describe, expect, it } from 'vitest'
import { TURNSTILE_VERIFY_URL, turnstileSiteKey, verifyTurnstile } from './turnstile'

const prod = { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'a-secret-key-value' }
const answer = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status })

describe('verifyTurnstile', () => {
  it('accepts a token the service confirms, sending the secret, the token and the visitor address', async () => {
    let seen: { url: string; form: URLSearchParams } | undefined
    const fetcher = (async (url: string, init: RequestInit) => {
      seen = { url, form: new URLSearchParams(String(init.body)) }
      return new Response(JSON.stringify({ success: true }))
    }) as unknown as typeof fetch
    expect(await verifyTurnstile('tok-123', '203.0.113.7', prod, fetcher)).toEqual({ ok: true })
    expect(seen?.url).toBe(TURNSTILE_VERIFY_URL)
    expect(seen?.form.get('secret')).toBe('a-secret-key-value')
    expect(seen?.form.get('response')).toBe('tok-123')
    expect(seen?.form.get('remoteip')).toBe('203.0.113.7')
  })

  it('refuses a token the service rejects', async () => {
    expect(await verifyTurnstile('bad', '1.1.1.1', prod, answer({ success: false }) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'rejected' })
  })

  it('refuses a missing, empty, non-string or oversized token without calling the service', async () => {
    let calls = 0
    const fetcher = (async () => {
      calls++
      return new Response('{"success":true}')
    }) as unknown as typeof fetch
    for (const token of [undefined, null, '', 42, {}, 'x'.repeat(2049)]) {
      expect(await verifyTurnstile(token, '1.1.1.1', prod, fetcher)).toEqual({ ok: false, reason: 'missing' })
    }
    expect(calls).toBe(0)
  })

  it('fails closed when the service errors, is unreachable or answers nonsense', async () => {
    const down = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await verifyTurnstile('t', '1.1.1.1', prod, down)).toEqual({ ok: false, reason: 'unavailable' })
    expect(await verifyTurnstile('t', '1.1.1.1', prod, answer({}, 500) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unavailable' })
    const garbage = (async () => new Response('<html>')) as unknown as typeof fetch
    expect(await verifyTurnstile('t', '1.1.1.1', prod, garbage)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('honours a different verification address (the test suite points it at a stand-in)', async () => {
    let url = ''
    const fetcher = (async (u: string) => {
      url = u
      return new Response('{"success":true}')
    }) as unknown as typeof fetch
    await verifyTurnstile('t', '1.1.1.1', { ...prod, TURNSTILE_VERIFY_URL: 'http://127.0.0.1:9/siteverify' }, fetcher)
    expect(url).toBe('http://127.0.0.1:9/siteverify')
  })

  it('without a secret: refused in production (fail closed), allowed in development', async () => {
    expect(await verifyTurnstile('t', '1.1.1.1', { NODE_ENV: 'production' })).toEqual({ ok: false, reason: 'not-configured' })
    expect(await verifyTurnstile(undefined, '1.1.1.1', { NODE_ENV: 'development' })).toEqual({ ok: true })
  })
})

describe('turnstileSiteKey', () => {
  it('is read from the environment at call time, empty when unset', () => {
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: '0x4AAAA-public' })).toBe('0x4AAAA-public')
    expect(turnstileSiteKey({})).toBe('')
  })
})
