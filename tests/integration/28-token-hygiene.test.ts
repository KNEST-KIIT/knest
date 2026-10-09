import { createHash } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { CAPTCHA, BASE, PASSWORD, closeDb, createUser, db, decodeMailText, login, readMail, uniqueIp } from '../support/helpers'

/**
 * Closing evidence for R-08: the e-mailed token is the only copy (the table holds
 * a digest), a link works exactly once even when used twice at the same instant,
 * and a wrong token does not burn the right one.
 */

const stamp = Date.now()
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

const post = (path: string, body: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify(body),
  })

async function emailedToken(to: string, path: 'reset' | 'verify'): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const mail = readMail().filter((m) => m.to.some((r) => r.includes(to))).at(-1)
    if (mail) {
      const text = decodeMailText(mail.body)
      const start = text.indexOf(`/${path}/confirm?`)
      if (start !== -1) {
        let end = start
        while (end < text.length && text.charAt(end).trim() !== '') end++
        const token = new URL(text.slice(start, end), 'http://placeholder').searchParams.get('token')
        if (token && token.length === 64) return token
      }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  const all = readMail()
  const last = all.filter((m) => m.to.some((r) => r.includes(to))).at(-1)
  throw new Error(
    `no ${path} link was e-mailed to ${to}: ${all.length} messages captured, ${all.filter((m) => m.to.some((r) => r.includes(to))).length} to this address; ` +
      `last text: ${last ? JSON.stringify(decodeMailText(last.body).slice(0, 400)) : '(none)'}`,
  )
}
const storedFor = async (identifier: string) =>
  (await db().query('select token from app.verification_tokens where identifier = $1', [identifier])).rows.map((r) => r.token as string)

afterAll(closeDb)

describe('password-reset links', () => {
  const mail = `reset-${stamp}@tokens.test`

  it('are stored as a digest, never as the emailed value', async () => {
    await createUser({ email: mail, platformRole: 'student' })
    expect((await post('/api/auth/password/reset/request', { email: mail, ...CAPTCHA })).status).toBe(200)
    const token = await emailedToken(mail, 'reset')
    const stored = await storedFor(`reset-password:${mail}`)
    expect(stored).toEqual([sha256(token)])
    expect(stored).not.toContain(token)
  })

  it('a wrong token is refused and leaves the real link usable', async () => {
    const token = await emailedToken(mail, 'reset')
    const wrong = await post('/api/auth/password/reset/confirm', { email: mail, token: 'f'.repeat(64), password: 'A-new-long-password-1' })
    expect(wrong.status).toBe(400)
    expect(await storedFor(`reset-password:${mail}`)).toEqual([sha256(token)])
  })

  it('work exactly once, even when used twice at the same instant', async () => {
    const token = await emailedToken(mail, 'reset')
    const [a, b] = await Promise.all([
      post('/api/auth/password/reset/confirm', { email: mail, token, password: 'First-new-password-11' }),
      post('/api/auth/password/reset/confirm', { email: mail, token, password: 'Second-new-password-22' }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    const winner = a.status === 200 ? 'First-new-password-11' : 'Second-new-password-22'
    const loser = a.status === 200 ? 'Second-new-password-22' : 'First-new-password-11'
    expect(await login(mail, winner)).not.toBeNull()
    expect(await login(mail, loser)).toBeNull()
    expect(await login(mail, PASSWORD)).toBeNull()
    expect(await storedFor(`reset-password:${mail}`)).toEqual([])
    // and a later replay is refused too
    expect((await post('/api/auth/password/reset/confirm', { email: mail, token, password: 'Third-new-password-33' })).status).toBe(400)
  })

  it('a verification token cannot be used to reset a password', async () => {
    const other = `cross-${stamp}@tokens.test`
    await createUser({ email: other, platformRole: 'student' })
    await db().query('update app.users set email_verified = null where email = $1', [other])
    expect((await post('/api/auth/password/verify/send', { email: other })).status).toBe(200)
    const token = await emailedToken(other, 'verify')
    const misuse = await post('/api/auth/password/reset/confirm', { email: other, token, password: 'Should-not-work-44' })
    expect(misuse.status).toBe(400)
    expect(await login(other, 'Should-not-work-44')).toBeNull()
  })
})

describe('e-mail verification links', () => {
  it('are stored as a digest and verify exactly once', async () => {
    const mail = `verify-${stamp}@tokens.test`
    await createUser({ email: mail, platformRole: 'student' })
    await db().query('update app.users set email_verified = null where email = $1', [mail])
    expect((await post('/api/auth/password/verify/send', { email: mail })).status).toBe(200)
    const token = await emailedToken(mail, 'verify')
    expect(await storedFor(`verify-email:${mail}`)).toEqual([sha256(token)])

    const [a, b] = await Promise.all([
      post('/api/auth/password/verify/confirm', { email: mail, token }),
      post('/api/auth/password/verify/confirm', { email: mail, token }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    expect((await db().query('select email_verified from app.users where email = $1', [mail])).rows[0].email_verified).not.toBeNull()
  })
})
