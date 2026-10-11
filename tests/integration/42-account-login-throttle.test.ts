import { afterAll, describe, expect, it } from 'vitest'
import { BASE, CAPTCHA, PASSWORD, closeDb, createUser, uniqueIp } from '../support/helpers'

/**
 * Failed sign-ins are limited per account as well as per address: a guess spread over many
 * addresses still runs out, successful sign-ins never count, and the limit applies the same way to
 * an address nobody registered so the response cannot reveal which e-mails exist.
 */

const stamp = Date.now()

const attempt = (email: string, password: string) =>
  fetch(`${BASE()}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify({ email, password, ...CAPTCHA }),
  })

afterAll(closeDb)

describe('per-account sign-in throttle', () => {
  it('stops guessing from many addresses, and then refuses even the right password', async () => {
    const email = `throttle-${stamp}@account.test`
    await createUser({ email })
    for (let i = 0; i < 10; i++) {
      const res = await attempt(email, `wrong-${i}`)
      expect(res.status).toBe(401)
    }
    expect((await attempt(email, 'wrong-again')).status).toBe(429)
    expect((await attempt(email, PASSWORD)).status).toBe(429)
  })

  it('does not count successful sign-ins', async () => {
    const email = `ok-${stamp}@account.test`
    await createUser({ email })
    for (let i = 0; i < 15; i++) {
      expect((await attempt(email, PASSWORD)).status).toBe(200)
    }
  })

  it('treats an unregistered address the same way', async () => {
    const email = `ghost-${stamp}@account.test`
    for (let i = 0; i < 10; i++) expect((await attempt(email, 'nope')).status).toBe(401)
    expect((await attempt(email, 'nope')).status).toBe(429)
  })
})
