# 11. Configuration and boot-time environment check

Files: `src/server/env.ts`, `src/instrumentation.ts`, `.env.example`, `infra/cfn/app.yaml:571-592`. The generated reference of all variables is `docs/handover/REFERENCE-ENVIRONMENT.md`; this file covers the ones in this volume's scope and why they are checked.

## Boot check

`register()` in `src/instrumentation.ts` runs once per server start:

1. Return unless `NEXT_RUNTIME === 'nodejs'`.
2. `shouldCheckEnv(env)` (`env.ts:105-110`): true only when `NODE_ENV === 'production'`, `NEXT_PHASE !== 'phase-production-build'` and `VERCEL_ENV !== 'preview'`. Builds and previews are not checked.
3. `checkProductionEnv(process.env)`; on failure throw `Invalid production environment:` plus one line per problem. Names and rules only, never values (`env.ts:3-8`). The server does not start; this is deliberate fail-closed behaviour.
4. Start the outbox worker and the storage reconcile worker.

`checkProductionEnv` (`env.ts:89-102`) first turns empty strings into undefined, runs the Zod schema, then runs `crossChecks` separately. Cross-checks are not schema refinements because a refinement is skipped when any single field is already invalid, which would hide those problems until the first round was fixed (`env.ts:41-45`). "Received undefined" messages are rewritten to "is required but not set".

## Rules

| Variable | Rule | Source |
|---|---|---|
| `DATABASE_URL` | `postgres://` or `postgresql://` | `env.ts:14` |
| `DATABASE_SSL` | `off` or `verify` (required) | `:15` |
| `DATABASE_SSL_CA_FILE` | required when `DATABASE_SSL=verify` | `:48-50` |
| `AUTH_SECRET`, `PAYLOAD_SECRET` | at least 32 characters | `:10`, `:21-22` |
| `AUTH_URL` | URL; for hosted production required and same origin as `SITE_URL` | `:24`, `:70-74` |
| `SITE_URL` or `NEXT_PUBLIC_SITE_URL` | one required; `https://` unless localhost, 127.0.0.1 or `[::1]` | `:54-65` |
| `ORIGIN_VERIFY_SECRET` | at least 32 characters when set; required for hosted production | `:27`, `:67` |
| `CLIENT_IP_SOURCE` | `cloudfront` or `x-forwarded-for`; must be `cloudfront` for hosted production | `:26`, `:68` |
| `ALLOWED_ORIGINS` | free string (comma list) | `:28` |
| `TURNSTILE_SECRET_KEY` | at least 10 characters | `:18` |
| `TURNSTILE_SITE_KEY` | at least 5 characters | `:19` |
| `TURNSTILE_VERIFY_URL` | URL when set | `:20` |
| `EMAIL_TRANSPORT` | `ses` or `smtp` when set | `:17` |
| `SMTP_HOST` | required unless `EMAIL_TRANSPORT=ses` | `:51-53` |
| `SMTP_PORT` | digits when set | `:30` |
| `EMAIL_FROM` | at least 3 characters (required) | `:31` |
| `S3_BUCKET`, `S3_REGION` | required (outside this volume) | `:32-33` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | both or neither | `:80-82` |

"Hosted production" in the cross-checks means a `SITE_URL` host that is not local. It also requires `DATABASE_SSL=verify`.

Not checked at boot: `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`/`SECRET` (Google is optional), `SES_CONFIGURATION_SET`, `AWS_REGION`, `ENQUIRY_NOTIFY_EMAIL`, `SITE_INDEXING`, `EMAIL_OUTBOX`, `FEATURE_LAB_BOOKING`. `SMTP_USER` and `SMTP_PASSWORD` are not checked either.

## Variables read by the code in this volume

| Variable | Read at | Effect |
|---|---|---|
| `AUTH_URL`, `NEXTAUTH_URL` | `session.ts:39`, `:51` | Cookie name prefix and `Secure` flag; also read by Auth.js |
| `AUTH_SECRET` | Auth.js (not read in repo code) | Auth.js's own cookies and state; the repo's session token does not use it |
| `AUTH_TRUST_HOST` | Auth.js (set in `.env.example:9`, CI and `app.yaml:579`) | Not read in repo code; behaviour not determined from the repo |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | `providers.ts:12` | Both non-blank turns Google on |
| `AUTH_GOOGLE_ISSUER` | `providers.ts:22` | Test-only discovery override |
| `NODE_ENV` | `session.ts:40`, `edge-guard.ts:65`, `client-ip.ts:19`, `turnstile.ts:31`, `send.ts:83`, `next.config.ts:4` | Production hardening switches |
| `SITE_URL`, `NEXT_PUBLIC_SITE_URL` | `site-url.ts:48`, `edge-guard.ts:48`, `:63` | Link origin; allowed write origin; local-site detection |
| `ALLOWED_ORIGINS` | `edge-guard.ts:51` | Extra origins for writes |
| `ORIGIN_VERIFY_SECRET` | `edge-guard.ts:62` | Required header value |
| `CLIENT_IP_SOURCE` | `client-ip.ts:18` | Address source |
| `SITE_INDEXING` | `proxy.ts:15` | `noindex` header unless exactly `on` |
| `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_VERIFY_URL` | `turnstile.ts:20-38` | Human check |
| `EMAIL_TRANSPORT`, `EMAIL_FROM`, `SES_CONFIGURATION_SET`, `AWS_REGION`, `S3_REGION` | `send.ts:51`, `:72-75` | Mail transport |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | `send.ts:38-45` | SMTP, read once at module load |
| `EMAIL_OUTBOX` | `send.ts:65` | `off` bypasses the outbox |
| `ENQUIRY_NOTIFY_EMAIL` | `enquiries/actions.ts:26` | Destination for contact-form notices |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | `next.config.ts:5`, `env.ts:108`, `site-url.ts:50-51` | Vercel deployments; the platform target is AWS per `docs/delivery`, so these are residual |

## Where production values come from

`infra/cfn/app.yaml:571-592` writes `/run/knest/common.env` on the instance at start: `NODE_ENV=production`, `DATABASE_SSL=verify`, `DATABASE_SSL_CA_FILE`, `AUTH_SECRET`, `PAYLOAD_SECRET`, `ORIGIN_VERIFY_SECRET` (from Secrets Manager entries named `knest-<env>/...`), `SITE_URL`, `AUTH_URL=${SITE_URL}`, `AUTH_TRUST_HOST=true`, `CLIENT_IP_SOURCE=cloudfront`, `TURNSTILE_*`, `S3_*`, `EMAIL_TRANSPORT=ses`, `EMAIL_FROM`, `FEATURE_LAB_BOOKING`, `SITE_INDEXING`, optional `ENQUIRY_NOTIFY_EMAIL`. Google credentials are not written there, so Google sign-in is off in that configuration unless added. `ALLOWED_ORIGINS` is not written either.

## Static configuration worth knowing

| Constant | Value | Where |
|---|---|---|
| Session lifetime | 30 days | `config.ts:26`, `session.ts:22` |
| Verification token TTL | 24 h | `actions.ts:20` |
| Reset token TTL | 1 h | `actions.ts:21` |
| bcrypt cost | 12 | `actions.ts:66`, `:172`; `dummy-hash.ts` |
| Password length | 12 to 200 characters, at most 72 bytes | `validation.ts:9-15` |
| Turnstile timeout | 5 s | `turnstile.ts:42` |
| Outbox | 8 attempts, 24 h TTL, 2 min lease, 30 s tick | file 09 |

## Failure modes

| Misconfiguration | Visible effect |
|---|---|
| `AUTH_URL` scheme differs from the real scheme | Login appears to succeed, then user is signed out (cookie name mismatch, file 02) |
| `SITE_URL` host differs from the browser's origin and not in `ALLOWED_ORIGINS` | Every browser POST returns bare 403 |
| `ORIGIN_VERIFY_SECRET` mismatch with CloudFront | Everything except `/api/health` returns 403 |
| `CLIENT_IP_SOURCE=cloudfront` but the header is not forwarded | All visitors share the `unknown` bucket |
| `TURNSTILE_SECRET_KEY` missing in production | Protected routes return 503 `captcha-unavailable`; boot refuses before that |
| No mail transport in production | Boot refuses; if bypassed, sends throw and the outbox retries until dead |
