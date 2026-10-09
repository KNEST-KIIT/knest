import { describe, expect, it } from 'vitest'
import { checkProductionEnv, shouldCheckEnv } from './env'

const good = {
  DATABASE_URL: 'postgres://u:p@db.internal:5432/knest',
  AUTH_SECRET: 'a'.repeat(40),
  PAYLOAD_SECRET: 'b'.repeat(40),
  NEXT_PUBLIC_SITE_URL: 'https://knest.example',
  SMTP_HOST: 'email-smtp.ap-south-1.amazonaws.com',
  SMTP_PORT: '587',
  EMAIL_FROM: 'KNEST <no-reply@knest.example>',
  S3_BUCKET: 'knest-documents',
  S3_REGION: 'ap-south-1',
}

describe('checkProductionEnv', () => {
  it('accepts a complete production environment, with the instance role instead of stored keys', () => {
    expect(checkProductionEnv(good)).toEqual({ ok: true })
  })

  it('names every missing or malformed variable and never repeats a value', () => {
    const result = checkProductionEnv({ ...good, AUTH_SECRET: 'short-secret-value', DATABASE_URL: 'mysql://x', S3_BUCKET: '', SMTP_HOST: undefined })
    expect(result.ok).toBe(false)
    if (result.ok) return
    const text = result.problems.join('\n')
    for (const name of ['AUTH_SECRET', 'DATABASE_URL', 'S3_BUCKET', 'SMTP_HOST']) expect(text).toContain(name)
    expect(text).toContain('SMTP_HOST: is required but not set')
    expect(text).not.toContain('short-secret-value')
    expect(text).not.toContain('mysql://x')
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
