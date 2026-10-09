import { describe, expect, it } from 'vitest'
import { checkProductionEnv, shouldCheckEnv } from './env'

const good = {
  DATABASE_URL: 'postgres://u:p@db.internal:5432/knest',
  AUTH_SECRET: 'a'.repeat(40),
  PAYLOAD_SECRET: 'b'.repeat(40),
  NEXT_PUBLIC_SITE_URL: 'https://knest.example',
  DATABASE_SSL: 'verify',
  DATABASE_SSL_CA_FILE: '/etc/knest/rds-global-bundle.pem',
  EMAIL_TRANSPORT: 'ses',
  EMAIL_FROM: 'KNEST <no-reply@knest.example>',
  TURNSTILE_SECRET_KEY: '0x4AAAAAAA-secret-test-value',
  TURNSTILE_SITE_KEY: '0x4AAAAAAA-site',
  S3_BUCKET: 'knest-documents',
  S3_REGION: 'ap-south-1',
}

describe('checkProductionEnv', () => {
  it('accepts a complete production environment, with the instance role instead of stored keys', () => {
    expect(checkProductionEnv(good)).toEqual({ ok: true })
  })

  it('names every missing or malformed variable and never repeats a value', () => {
    const result = checkProductionEnv({ ...good, AUTH_SECRET: 'short-secret-value', DATABASE_URL: 'mysql://x', S3_BUCKET: '', EMAIL_TRANSPORT: undefined, SMTP_HOST: undefined })
    expect(result.ok).toBe(false)
    if (result.ok) return
    const text = result.problems.join('\n')
    for (const name of ['AUTH_SECRET', 'DATABASE_URL', 'S3_BUCKET', 'SMTP_HOST']) expect(text).toContain(name)
    expect(text).toContain('SMTP_HOST: is required unless EMAIL_TRANSPORT=ses')
    expect(text).toContain('S3_BUCKET: is required')
    expect(text).not.toContain('short-secret-value')
    expect(text).not.toContain('mysql://x')
  })

  it('needs an explicit database TLS choice, and a CA bundle when verifying', () => {
    const { DATABASE_SSL: _a, ...noChoice } = good
    expect(checkProductionEnv(noChoice).ok).toBe(false)
    expect(checkProductionEnv({ ...good, DATABASE_SSL: 'off' }).ok).toBe(true)
    const { DATABASE_SSL_CA_FILE: _b, ...noCa } = good
    expect(checkProductionEnv(noCa).ok).toBe(false)
    expect(checkProductionEnv({ ...good, DATABASE_SSL: 'require' }).ok).toBe(false)
  })

  it('needs a mail path: SES through the instance role, or an SMTP host', () => {
    const { EMAIL_TRANSPORT: _c, ...neither } = good
    const result = checkProductionEnv(neither)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems.join('\n')).toContain('SMTP_HOST')
    expect(checkProductionEnv({ ...neither, SMTP_HOST: 'smtp.example', SMTP_PORT: '587' }).ok).toBe(true)
  })

  it('requires both Turnstile keys: the human check is part of the product', () => {
    const { TURNSTILE_SECRET_KEY: _d, ...noSecret } = good
    const { TURNSTILE_SITE_KEY: _e, ...noSite } = good
    expect(checkProductionEnv(noSecret).ok).toBe(false)
    expect(checkProductionEnv(noSite).ok).toBe(false)
  })

  it('accepts SITE_URL (runtime) or NEXT_PUBLIC_SITE_URL, and needs one of them', () => {
    const { NEXT_PUBLIC_SITE_URL: _omit, ...rest } = good
    expect(checkProductionEnv({ ...rest, SITE_URL: 'https://kiitnest.com' }).ok).toBe(true)
    const none = checkProductionEnv(rest)
    expect(none.ok).toBe(false)
    if (!none.ok) expect(none.problems.join('\n')).toContain('SITE_URL')
  })

  it('checks the origin-verification secret and the client IP source when set', () => {
    expect(checkProductionEnv({ ...good, ORIGIN_VERIFY_SECRET: 'too-short' }).ok).toBe(false)
    expect(checkProductionEnv({ ...good, ORIGIN_VERIFY_SECRET: 'v'.repeat(40), CLIENT_IP_SOURCE: 'cloudfront' }).ok).toBe(true)
    expect(checkProductionEnv({ ...good, CLIENT_IP_SOURCE: 'whatever' }).ok).toBe(false)
  })

  it('requires https outside localhost', () => {
    expect(checkProductionEnv({ ...good, NEXT_PUBLIC_SITE_URL: 'http://knest.example' }).ok).toBe(false)
    expect(checkProductionEnv({ ...good, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100' }).ok).toBe(true)
  })

  it('requires the S3 key pair to be set together or not at all', () => {
    expect(checkProductionEnv({ ...good, S3_ACCESS_KEY_ID: 'id-only' }).ok).toBe(false)
    expect(checkProductionEnv({ ...good, S3_ACCESS_KEY_ID: 'id', S3_SECRET_ACCESS_KEY: 'secret' }).ok).toBe(true)
  })
})

describe('shouldCheckEnv', () => {
  it('checks real production servers only', () => {
    expect(shouldCheckEnv({ NODE_ENV: 'production' })).toBe(true)
    expect(shouldCheckEnv({ NODE_ENV: 'development' })).toBe(false)
    expect(shouldCheckEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toBe(false)
    expect(shouldCheckEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe(false)
  })
})
