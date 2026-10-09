import { z } from 'zod'

/**
 * Startup check of the environment a production deployment must have. It reports
 * variable NAMES and the rule that failed, never values, so the message is safe
 * in logs. Run from src/instrumentation.ts; skipped while building and for
 * preview deployments, which do not carry production services.
 */

const secret = z.string().min(32, 'must be at least 32 characters')
const url = z.string().url('must be an absolute URL')

const productionSchema = z
  .object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
    AUTH_SECRET: secret,
    PAYLOAD_SECRET: secret,
    NEXT_PUBLIC_SITE_URL: url,
    SMTP_HOST: z.string().min(1, 'is required: verification and notification e-mails cannot be sent without it'),
    SMTP_PORT: z.string().regex(/^\d+$/, 'must be a port number').optional(),
    EMAIL_FROM: z.string().min(3, 'is required'),
    S3_BUCKET: z.string().min(1, 'is required: application documents have nowhere to be stored without it'),
    S3_REGION: z.string().min(1, 'is required'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const host = (() => {
      try {
        return new URL(env.NEXT_PUBLIC_SITE_URL).hostname
      } catch {
        return ''
      }
    })()
    const local = host === 'localhost' || host === '127.0.0.1'
    if (host && !local && !env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SITE_URL'], message: 'must be https:// outside localhost' })
    }
    if (Boolean(env.S3_ACCESS_KEY_ID) !== Boolean(env.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_SECRET_ACCESS_KEY'],
        message: 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together (or neither, to use the instance role)',
      })
    }
  })

export type EnvCheck = { ok: true } | { ok: false; problems: string[] }

/** Pure: takes the environment as a parameter so it can be tested. */
export function checkProductionEnv(env: Record<string, string | undefined>): EnvCheck {
  const clean: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) clean[key] = value === '' ? undefined : value
  const result = productionSchema.safeParse(clean)
  if (result.success) return { ok: true }
  return {
    ok: false,
    problems: result.error.issues.map((issue) => {
      // An unset variable reaches the schema as undefined; say that plainly.
      const message = /received undefined/.test(issue.message) ? 'is required but not set' : issue.message
      return `${issue.path.join('.') || '(environment)'}: ${message}`
    }),
  }
}

/** Whether this process should be checked: a real production server, not a build or a preview. */
export function shouldCheckEnv(env: Record<string, string | undefined>): boolean {
  if (env.NODE_ENV !== 'production') return false
  if (env.NEXT_PHASE === 'phase-production-build') return false
  if (env.VERCEL_ENV === 'preview') return false
  return true
}
