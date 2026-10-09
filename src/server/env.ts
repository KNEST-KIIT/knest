import { z } from 'zod'

/**
 * Startup check of the environment a production deployment must have. It reports
 * variable NAMES and the rule that failed, never values, so the message is safe
 * in logs. Run from src/instrumentation.ts; skipped while building and for
 * preview deployments, which do not carry production services.
 */

const secret = z.string().min(32, 'must be at least 32 characters')
const url = z.string().url('must be an absolute URL')

const productionSchema = z.object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
    DATABASE_SSL: z.enum(['off', 'verify'], { error: 'must be set to off or verify (verify on AWS, with DATABASE_SSL_CA_FILE)' }),
    DATABASE_SSL_CA_FILE: z.string().optional(),
    EMAIL_TRANSPORT: z.enum(['ses', 'smtp']).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(10, 'is required: the human check cannot be verified without it'),
    TURNSTILE_SITE_KEY: z.string().min(5, 'is required: the human check cannot be shown without it'),
    TURNSTILE_VERIFY_URL: url.optional(),
    AUTH_SECRET: secret,
    PAYLOAD_SECRET: secret,
    SITE_URL: url.optional(),
    NEXT_PUBLIC_SITE_URL: url.optional(),
    CLIENT_IP_SOURCE: z.enum(['cloudfront', 'x-forwarded-for']).optional(),
    ORIGIN_VERIFY_SECRET: secret.optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().regex(/^\d+$/, 'must be a port number').optional(),
    EMAIL_FROM: z.string().min(3, 'is required'),
    S3_BUCKET: z.string().min(1, 'is required: application documents have nowhere to be stored without it'),
    S3_REGION: z.string().min(1, 'is required'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
})


type Env = Record<string, string | undefined>

/**
 * Rules that involve more than one variable. Run on their own, not as a refinement of the
 * schema, because a schema refinement is skipped whenever any single field is already
 * invalid, which would hide these problems until the first round was fixed.
 */
function crossChecks(env: Env): string[] {
  const problems: string[] = []
  if (env.DATABASE_SSL === 'verify' && !env.DATABASE_SSL_CA_FILE) {
    problems.push('DATABASE_SSL_CA_FILE: is required when DATABASE_SSL=verify')
  }
  if (env.EMAIL_TRANSPORT !== 'ses' && !env.SMTP_HOST) {
    problems.push('SMTP_HOST: is required unless EMAIL_TRANSPORT=ses: verification and notification e-mails cannot be sent without it')
  }
  const site = env.SITE_URL || env.NEXT_PUBLIC_SITE_URL
  if (!site) {
    problems.push('SITE_URL: is required but not set (the public address of the site; NEXT_PUBLIC_SITE_URL is accepted as a fallback)')
  } else {
    let host = ''
    try {
      host = new URL(site).hostname
    } catch {
      // the schema reports a malformed URL
    }
    const local = host === 'localhost' || host === '127.0.0.1'
    if (host && !local && !site.startsWith('https://')) problems.push('SITE_URL: must be https:// outside localhost')
  }
  if (Boolean(env.S3_ACCESS_KEY_ID) !== Boolean(env.S3_SECRET_ACCESS_KEY)) {
    problems.push('S3_SECRET_ACCESS_KEY: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together (or neither, to use the instance role)')
  }
  return problems
}

export type EnvCheck = { ok: true } | { ok: false; problems: string[] }

/** Pure: takes the environment as a parameter so it can be tested. */
export function checkProductionEnv(env: Record<string, string | undefined>): EnvCheck {
  const clean: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) clean[key] = value === '' ? undefined : value
  const result = productionSchema.safeParse(clean)
  const fromSchema = result.success
    ? []
    : result.error.issues.map((issue) => {
        // An unset variable reaches the schema as undefined; say that plainly.
        const message = /received undefined/.test(issue.message) ? 'is required but not set' : issue.message
        return `${issue.path.join('.') || '(environment)'}: ${message}`
      })
  const problems = [...fromSchema, ...crossChecks(clean)]
  return problems.length === 0 ? { ok: true } : { ok: false, problems }
}

/** Whether this process should be checked: a real production server, not a build or a preview. */
export function shouldCheckEnv(env: Record<string, string | undefined>): boolean {
  if (env.NODE_ENV !== 'production') return false
  if (env.NEXT_PHASE === 'phase-production-build') return false
  if (env.VERCEL_ENV === 'preview') return false
  return true
}
