import { describe, expect, it } from 'vitest'
import { localTurnstileTestToken } from './local-turnstile-test'

describe('local Turnstile testing boundary', () => {
  it.each(['127.0.0.1', 'localhost', '[::1]', 'student.localhost'])('permits the public dummy pair on %s', (hostname) => {
    expect(localTurnstileTestToken('1x00000000000000000000AA', hostname)).toBe('XXXX.DUMMY.TOKEN.XXXX')
  })
  it.each(['kiitnest.com', 'localhost.example.com', '127.0.0.1.example.com', 'evil-localhost'])('never supplies a test token on %s', (hostname) => {
    expect(localTurnstileTestToken('1x00000000000000000000AA', hostname)).toBeNull()
  })
  it.each(['', 'production-site-key', '2x00000000000000000000AB'])('never substitutes for another site key: %s', (key) => {
    expect(localTurnstileTestToken(key, '127.0.0.1')).toBeNull()
  })
})
