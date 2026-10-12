# Reference: production environment variables

Generated from the startup check in `src/server/env.ts` (names and rules only, never values). A production process refuses to start if a required rule fails.

| Variable | Rule |
|---|---|
| `DATABASE_URL` | required: `z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string')` |
| `DATABASE_SSL` | required: `z.enum(['off', 'verify'], { error: 'must be set to off or verify (verify on AWS, with DATABASE_SSL_CA_FILE)' }` |
| `DATABASE_SSL_CA_FILE` | optional: `z.string().optional()` |
| `EMAIL_TRANSPORT` | optional: `z.enum(['ses', 'smtp']).optional()` |
| `TURNSTILE_SECRET_KEY` | required: `z.string().min(10, 'is required: the human check cannot be verified without it')` |
| `TURNSTILE_SITE_KEY` | required: `z.string().min(5, 'is required: the human check cannot be shown without it')` |
| `TURNSTILE_VERIFY_URL` | optional: `url.optional()` |
| `AUTH_SECRET` | required: `secret` |
| `PAYLOAD_SECRET` | required: `secret` |
| `SITE_URL` | optional: `url.optional()` |
| `AUTH_URL` | optional: `url.optional()` |
| `NEXT_PUBLIC_SITE_URL` | optional: `url.optional()` |
| `CLIENT_IP_SOURCE` | optional: `z.enum(['cloudfront', 'x-forwarded-for']).optional()` |
| `ORIGIN_VERIFY_SECRET` | optional: `secret.optional()` |
| `ALLOWED_ORIGINS` | optional: `z.string().optional()` |
| `SMTP_HOST` | optional: `z.string().optional()` |
| `SMTP_PORT` | optional: `z.string().regex(/^\d+$/, 'must be a port number').optional()` |
| `EMAIL_FROM` | required: `z.string().min(3, 'is required')` |
| `S3_BUCKET` | required: `z.string().min(1, 'is required: application documents have nowhere to be stored without it')` |
| `S3_REGION` | required: `z.string().min(1, 'is required')` |
| `S3_ACCESS_KEY_ID` | optional: `z.string().optional()` |
| `S3_SECRET_ACCESS_KEY` | optional: `z.string().optional()` |
