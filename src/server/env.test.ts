import { describe, expect, it } from 'vitest'
import { checkProductionEnv, shouldCheckEnv } from './env'

const good = {
  DATABASE_URL: 'postgres://u:p@db.internal:5432/knest',
  AUTH_SECRET: 'a'.repeat(40),
  PAYLOAD_SECRET: 'b'.repeat(40),
  NEXT_PUBLIC_SITE_URL: 'https://knest.example',
  AUTH_URL: 'https://knest.example',
  ORIGIN_VERIFY_SECRET: 'v'.repeat(40),
  CLIENT_IP_SOURCE: 'cloudfront',
  DATABASE_SSL: 'verify',
  DATABASE_SSL_CA_FILE: '/etc/knest/rds-global-bundle.pem',
  EMAIL_TRANSPORT: 'ses',
  EMAIL_FROM: 'KNEST <no-reply@knest.example>',
  TURNSTILE_SECRET_KEY: '0x4AAAAAAA-secret-test-value',
  TURNSTILE_SITE_KEY: '0x4AAAAAAA-site',
  S3_BUCKET: 'knest-media',
  S3_REGION: 'ap-south-1',
  QUARANTINE_BUCKET: 'knest-quarantine',
  DOCUMENTS_BUCKET: 'knest-documents',
  DOCUMENTS_KMS_KEY_ARN: 'arn:aws:kms:ap-south-1:123456789012:key/11111111-2222-3333-4444-555555555555',
  MALWARE_SCAN_QUEUE_URL: 'https://sqs.ap-south-1.amazonaws.com/123456789012/knest-production-scan-results',
}

describe('document screening configuration', () => {
  const problemsOf = (env: Record<string, string | undefined>) => {
    const result = checkProductionEnv(env)
    return result.ok ? [] : result.problems
  }

  it.each(['QUARANTINE_BUCKET', 'DOCUMENTS_BUCKET', 'DOCUMENTS_KMS_KEY_ARN', 'MALWARE_SCAN_QUEUE_URL'])(
    'refuses to start without %s: there is no way to run uploads unscreened',
    (name) => {
      const problems = problemsOf({ ...good, [name]: undefined })
      expect(problems.some((p) => p.startsWith(`${name}:`))).toBe(true)
    },
  )

  it('keeps quarantine, clean documents and CMS media in three different buckets', () => {
    expect(problemsOf({ ...good, DOCUMENTS_BUCKET: good.QUARANTINE_BUCKET }).join('\n')).toContain('must differ from QUARANTINE_BUCKET')
    expect(problemsOf({ ...good, S3_BUCKET: good.DOCUMENTS_BUCKET }).join('\n')).toContain('S3_BUCKET: the CMS media bucket must differ')
    expect(problemsOf({ ...good, S3_BUCKET: good.QUARANTINE_BUCKET }).join('\n')).toContain('S3_BUCKET: the CMS media bucket must differ')
  })

  it('requires a KMS key ARN, a bucket-shaped name and an absolute queue URL', () => {
    expect(problemsOf({ ...good, DOCUMENTS_KMS_KEY_ARN: 'not-an-arn' }).join('\n')).toContain('DOCUMENTS_KMS_KEY_ARN: must be a KMS key or alias ARN')
    expect(problemsOf({ ...good, QUARANTINE_BUCKET: 'UPPER_case' }).join('\n')).toContain('QUARANTINE_BUCKET: is not a valid bucket name')
    expect(problemsOf({ ...good, MALWARE_SCAN_QUEUE_URL: 'queue-name' }).join('\n')).toContain('MALWARE_SCAN_QUEUE_URL')
  })

  it('rejects the retired HTTP scanner variable so nobody believes one is in use', () => {
    expect(problemsOf({ ...good, MALWARE_SCANNER_URL: 'http://127.0.0.1:3310/scan' }).join('\n')).toContain('MALWARE_SCANNER_URL: is no longer supported')
  })

  it('forbids stand-in endpoints and an http queue for hosted production, but not on localhost', () => {
    expect(problemsOf({ ...good, S3_ENDPOINT: 'http://127.0.0.1:9000' }).join('\n')).toContain('S3_ENDPOINT: must not be set for hosted production')
    expect(problemsOf({ ...good, SQS_ENDPOINT: 'http://127.0.0.1:9324' }).join('\n')).toContain('SQS_ENDPOINT: must not be set for hosted production')
    expect(problemsOf({ ...good, MALWARE_SCAN_QUEUE_URL: 'http://sqs.example/queue' }).join('\n')).toContain('MALWARE_SCAN_QUEUE_URL: must be https:// for hosted production')
    const local = { ...good, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100', AUTH_URL: undefined, ORIGIN_VERIFY_SECRET: undefined, CLIENT_IP_SOURCE: undefined, DATABASE_SSL: 'off' as const, DATABASE_SSL_CA_FILE: undefined }
    // DATABASE_SSL=off is refused by the schema everywhere; that is unrelated to screening, so only look for screening problems.
    const screening = problemsOf({ ...local, S3_ENDPOINT: 'http://127.0.0.1:9000', SQS_ENDPOINT: 'http://127.0.0.1:9324', MALWARE_SCAN_QUEUE_URL: 'http://127.0.0.1:9324/queue' }).filter((p) => /S3_ENDPOINT|SQS_ENDPOINT|MALWARE_SCAN|QUARANTINE|DOCUMENTS/.test(p))
    expect(screening).toEqual([])
  })
})

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
    expect(checkProductionEnv({ ...good, DATABASE_SSL: 'off' }).ok).toBe(false)
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
    expect(checkProductionEnv({ ...rest, SITE_URL: 'https://kiitnest.com', AUTH_URL: 'https://kiitnest.com' }).ok).toBe(true)
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

  it('requires matching auth origin and CloudFront verification in hosted production', () => {
    expect(checkProductionEnv({ ...good, AUTH_URL: 'http://knest.example' }).ok).toBe(false)
    expect(checkProductionEnv({ ...good, ORIGIN_VERIFY_SECRET: undefined }).ok).toBe(false)
    expect(checkProductionEnv({ ...good, CLIENT_IP_SOURCE: 'x-forwarded-for' }).ok).toBe(false)
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
