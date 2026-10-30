import { createHash, randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { hash } from 'bcryptjs'
import { BASE, captcha, closeDb, db, uniqueIp } from '../support/helpers'

/**
 * Regression coverage for QA-004 (account ownership, credential isolation, and token hygiene).
 * Validates that:
 * 1. An attacker-chosen signup password cannot be promoted without a freshly supplied owner password.
 * 2. Missing/invalid password rejection does NOT consume the single-use verification token.
 * 3. Legitimate activation with the SAME token plus owner password succeeds.
 * 4. Post-activation, the attacker-chosen password and pre-verification sessions fail.
 * 5. Established accounts (or concurrent second tokens) preserve existing credentials and sessions.
 * 6. Unexpected database errors return safe 500 responses without leaking queries or hashes.
 */

const stamp = Date.now()
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

const post = (path: string, body: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify(body),
  })

afterAll(closeDb)

describe('QA-004: account ownership and verification token lifecycle', () => {
  const victimEmail = `victim-owner-${stamp}@ownership.test`
  const attackerPassword = 'AttackerChosenPassword2026!'
  const ownerPassword = 'OwnerFreshSecurePassword2026!'

  let userId: string
  let rawToken: string

  it('1. attacker registers account; login is rejected prior to verification', async () => {
    // Signup through endpoint or direct insertion with unverified status
    const signupRes = await post('/api/auth/password/signup', {
      name: 'Victim Owner',
      email: victimEmail,
      password: attackerPassword,
      ...captcha('signup'),
    })
    expect(signupRes.status).toBe(202)

    // Query user row safely
    const userRes = await db().query('select id, email_verified, password_hash from app.users where email = $1', [victimEmail])
    expect(userRes.rows.length).toBe(1)
    userId = userRes.rows[0].id
    expect(userRes.rows[0].email_verified).toBeNull()

    // Attacker cannot sign in before verification
    const loginRes = await post('/api/auth/password/login', {
      email: victimEmail,
      password: attackerPassword,
      ...captcha('login'),
    })
    expect(loginRes.status).toBe(401)
    const loginJson = await loginRes.json().catch(() => ({}))
    expect(loginJson.error).toMatch(/Verify your email/i)
  })

  it('2. pre-verification session exists before activation', async () => {
    // Mint synthetic pre-verification session for this user to test revocation
    const preSessionToken = `pre-session-${stamp}-${randomBytes(8).toString('hex')}`
    await db().query(
      `insert into app.sessions (session_token, user_id, expires) values ($1, $2, now() + interval '1 day')`,
      [preSessionToken, userId],
    )
    const sessionCount = await db().query('select count(*)::int as n from app.sessions where user_id = $1', [userId])
    expect(sessionCount.rows[0].n).toBeGreaterThan(0)
  })

  it('3. confirmation attempt without fresh owner password is rejected and leaves token unconsumed', async () => {
    // Issue or read the verify-email token for victimEmail
    rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256(rawToken)
    await db().query('delete from app.verification_tokens where identifier = $1', [`verify-email:${victimEmail}`])
    await db().query(
      `insert into app.verification_tokens (identifier, token, expires) values ($1, $2, now() + interval '1 day')`,
      [`verify-email:${victimEmail}`, tokenHash],
    )

    // Attempt to confirm without providing a fresh owner password
    const noPasswordRes = await post('/api/auth/password/verify/confirm', {
      email: victimEmail,
      token: rawToken,
      password: '',
    })
    expect(noPasswordRes.status).toBe(400)
    const noPwJson = await noPasswordRes.json().catch(() => ({}))
    expect(noPwJson.error).toMatch(/Choose a password of at least 12 characters to activate your account/i)

    // Critical QA-004 check: Token MUST NOT be consumed by the failed attempt!
    const tokenCheck = await db().query(
      'select token from app.verification_tokens where identifier = $1',
      [`verify-email:${victimEmail}`],
    )
    expect(tokenCheck.rows.length).toBe(1)
    expect(tokenCheck.rows[0].token).toBe(tokenHash)

    // Also test short/invalid password
    const shortPasswordRes = await post('/api/auth/password/verify/confirm', {
      email: victimEmail,
      token: rawToken,
      password: 'short',
    })
    expect(shortPasswordRes.status).toBe(400)

    // Token must STILL be unconsumed
    const tokenCheck2 = await db().query(
      'select token from app.verification_tokens where identifier = $1',
      [`verify-email:${victimEmail}`],
    )
    expect(tokenCheck2.rows.length).toBe(1)
  })

  it('4. SAME token plus fresh owner password succeeds, consumes token, and revokes pre-sessions', async () => {
    // Owner supplies the same token and their own fresh password
    const confirmRes = await post('/api/auth/password/verify/confirm', {
      email: victimEmail,
      token: rawToken,
      password: ownerPassword,
    })
    expect(confirmRes.status).toBe(200)

    // Token must now be consumed
    const tokenAfter = await db().query(
      'select token from app.verification_tokens where identifier = $1',
      [`verify-email:${victimEmail}`],
    )
    expect(tokenAfter.rows.length).toBe(0)

    // Account is now verified
    const userAfter = await db().query('select email_verified from app.users where id = $1', [userId])
    expect(userAfter.rows[0].email_verified).not.toBeNull()

    // Pre-verification sessions were revoked
    const preSessionsAfter = await db().query(
      `select count(*)::int as n from app.sessions where user_id = $1 and session_token like 'pre-session-%'`,
      [userId],
    )
    expect(preSessionsAfter.rows[0].n).toBe(0)
  })

  it('5. attacker-chosen password fails; owner-chosen password succeeds', async () => {
    // Attacker's original password cannot sign in
    const attackerLogin = await post('/api/auth/password/login', {
      email: victimEmail,
      password: attackerPassword,
      ...captcha('login'),
    })
    expect(attackerLogin.status).toBe(401)
    const attackerJson = await attackerLogin.json().catch(() => ({}))
    expect(attackerJson.error).toMatch(/don’t match|don't match/i)

    // Owner's fresh password signs in successfully
    const ownerLogin = await post('/api/auth/password/login', {
      email: victimEmail,
      password: ownerPassword,
      ...captcha('login'),
    })
    expect(ownerLogin.status).toBe(200)
    const cookie = ownerLogin.headers.getSetCookie().join('; ')
    expect(cookie).toMatch(/session-token/i)
  })

  it('6. replaying the consumed token is rejected', async () => {
    const replayRes = await post('/api/auth/password/verify/confirm', {
      email: victimEmail,
      token: rawToken,
      password: 'AnotherPassword2026!',
    })
    expect(replayRes.status).toBe(400)
    const replayJson = await replayRes.json().catch(() => ({}))
    expect(replayJson.error).toMatch(/expired|invalid/i)
  })

  it('7. second valid token on already verified account does NOT overwrite password or revoke sessions', async () => {
    // Add an established session for the owner
    const ownerSessionToken = `owner-session-${stamp}`
    await db().query(
      `insert into app.sessions (session_token, user_id, expires) values ($1, $2, now() + interval '1 day')`,
      [ownerSessionToken, userId],
    )

    // Issue a second distinct token
    const secondToken = randomBytes(32).toString('hex')
    await db().query(
      `insert into app.verification_tokens (identifier, token, expires) values ($1, $2, now() + interval '1 day')`,
      [`verify-email:${victimEmail}`, sha256(secondToken)],
    )

    // Attempt verification with second token and a different password
    const secondConfirm = await post('/api/auth/password/verify/confirm', {
      email: victimEmail,
      token: secondToken,
      password: 'AttemptedOverwritePassword123!',
    })
    expect(secondConfirm.status).toBe(200)

    // Owner's original password must still work (not overwritten!)
    const ownerLogin = await post('/api/auth/password/login', {
      email: victimEmail,
      password: ownerPassword,
      ...captcha('login'),
    })
    expect(ownerLogin.status).toBe(200)

    // Established owner session must still exist (not wiped!)
    const sessionCheck = await db().query(
      'select session_token from app.sessions where session_token = $1',
      [ownerSessionToken],
    )
    expect(sessionCheck.rows.length).toBe(1)
  })

  it('8. unexpected database failure returns 500 without leaking SQL or credential hashes', async () => {
    const tempEmail = `fail-inject-${stamp}@ownership.test`
    const tempPasswordHash = await hash('TempPassword2026!', 10)
    await db().query(
      `insert into app.users (id, email, name, password_hash, platform_role, is_active)
       values (gen_random_uuid()::text, $1, 'Temp', $2, 'student', true)`,
      [tempEmail, tempPasswordHash],
    )
    const tempToken = randomBytes(32).toString('hex')
    await db().query(
      `insert into app.verification_tokens (identifier, token, expires) values ($1, $2, now() + interval '1 day')`,
      [`verify-email:${tempEmail}`, sha256(tempToken)],
    )

    // Inject trigger to force error inside transaction
    await db().query(
      "create function app.test_activation_failure() returns trigger language plpgsql as $$ begin raise exception 'injected_db_secret_leak_trigger'; end $$",
    )
    await db().query(
      'create trigger test_activation_failure before update on app.users for each row execute function app.test_activation_failure()',
    )

    try {
      const failedRes = await post('/api/auth/password/verify/confirm', {
        email: tempEmail,
        token: tempToken,
        password: 'AValidFreshPassword123!',
      })
      expect(failedRes.status).toBe(500)
      const failedJson = await failedRes.json().catch(() => ({}))
      // Must NOT leak trigger name, SQL text, bound values, or credential hashes
      expect(failedJson.error).not.toMatch(/injected_db_secret_leak_trigger/i)
      expect(failedJson.error).not.toMatch(/select|update|insert|delete|password_hash/i)
      expect(failedJson.error).toBe('We could not complete your account activation. Please try again.')
    } finally {
      await db().query('drop trigger if exists test_activation_failure on app.users')
      await db().query('drop function if exists app.test_activation_failure()')
    }
  })

  it('9. inactive account confirmation is rejected and yields no session', async () => {
    const inactiveEmail = `inactive-${stamp}@ownership.test`
    await db().query(
      `insert into app.users (id, email, name, password_hash, platform_role, is_active)
       values (gen_random_uuid()::text, $1, 'Inactive', 'hash', 'student', false)`,
      [inactiveEmail],
    )
    const token = randomBytes(32).toString('hex')
    await db().query(
      `insert into app.verification_tokens (identifier, token, expires) values ($1, $2, now() + interval '1 day')`,
      [`verify-email:${inactiveEmail}`, sha256(token)],
    )

    const res = await post('/api/auth/password/verify/confirm', {
      email: inactiveEmail,
      token,
      password: 'FreshPassword123!',
    })
    expect(res.status).toBe(400)
    const json = await res.json().catch(() => ({}))
    expect(json.error).toMatch(/expired|request a new one/i)
    const cookie = res.headers.getSetCookie().join('; ')
    expect(cookie).not.toMatch(/session-token/i)
  })

  it('10. non-existent account confirmation is rejected and yields no session', async () => {
    const missingEmail = `missing-${stamp}@ownership.test`
    const token = randomBytes(32).toString('hex')
    const res = await post('/api/auth/password/verify/confirm', {
      email: missingEmail,
      token,
      password: 'FreshPassword123!',
    })
    expect(res.status).toBe(400)
    const cookie = res.headers.getSetCookie().join('; ')
    expect(cookie).not.toMatch(/session-token/i)
  })
})
