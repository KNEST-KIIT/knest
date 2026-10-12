# 13. Configuration reference for E2 modules

Everything below was found by reading the E2 source. Variables used only by other volumes (auth, mail transport, labs) are listed where an E2 module depends on them. The authoritative environment reference is `docs/handover/REFERENCE-ENVIRONMENT.md`; this file does not replace it.

## 1. Environment variables

| Variable | Read in | Effect on E2 modules | Default / failure |
|---|---|---|---|
| `S3_BUCKET` | `storage/index.ts:20`, `reconcile-worker.ts:13`, `payload.config.ts:90-92`, `env.ts:32` | Turns on S3 for application documents and CMS media; enables the reconcile worker | Unset in production fails boot validation; unset in development uses `uploads/` on local disk |
| `S3_REGION` | `s3-config.ts:17`, `env.ts:33` | S3 client region | Required in production |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `s3-config.ts:13-14`, `env.ts:80-82` | Explicit credentials; both or neither | Neither: SDK default chain (instance role) |
| `S3_ENDPOINT` | `s3-config.ts:15,19` | S3-compatible endpoint, path-style | Unset: AWS |
| `STORAGE_RECONCILE` | `reconcile-worker.ts:13,15` | `off` disables the worker; `apply` allows deletion; anything else is a dry run | Dry run |
| `ENQUIRY_NOTIFY_EMAIL` | `enquiries/actions.ts:26` | Address that receives a copy of each enquiry | Unset: no staff e-mail |
| `NODE_ENV` | `storage/index.ts:46`, `turnstile.ts:31` | Production refuses local disk and missing Turnstile secret | |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_VERIFY_URL` | `turnstile.ts:20-38` | CAPTCHA on application submit and contact form | Secret unset: production fails closed (503 `captcha-unavailable`), development passes |
| `ORIGIN_VERIFY_SECRET`, `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `ALLOWED_ORIGINS` | `edge-guard.ts:16-23,58-91` | Origin verification and same-origin write check applied to every route here | Production without the secret refuses all non-local traffic except health |
| `SITE_INDEXING` | `proxy.ts:15` | `on` removes noindex | Anything else: noindex |
| `EMAIL_OUTBOX`, `EMAIL_TRANSPORT`, `SMTP_*`, `SES_CONFIGURATION_SET`, `EMAIL_FROM` | `email/send.ts` | How notification and enquiry mail is sent | See e-mail volume |
| `PAYLOAD_SECRET`, `DATABASE_URL` | `payload.config.ts`, db client | CMS and database | Outside this volume |

## 2. Constants in code that behave like configuration

| Constant | Value | Where |
|---|---|---|
| `MAX_UPLOAD_BYTES` | 10 MiB | `applications/validation.ts:48` |
| `ALLOWED_UPLOAD_MIME_TYPES` | PDF, DOC, DOCX, PPT, PPTX | `validation.ts:40-46` |
| `REVIEW_PAGE_SIZE` | 25 | `applications/review-constants.ts:2` |
| `MAX_DECISION_NOTE` | 2000 chars | `review.ts:19` |
| `GRACE_MS` | 48 h | `storage/reconcile.ts:20` |
| `MAX_REMOVALS` | 200 per run | `reconcile.ts:21` |
| Reconcile schedule | first run 5 min after start, then 24 h | `reconcile-worker.ts:19-20` |
| `EVENT_LOCK_NAMESPACE` | 7101 | `events/actions.ts:79` |
| Staff membership lock | `hashtext('knest:staff-membership')` | `members/actions.ts:41,81` |
| `ENQUIRIES_PAGE_SIZE` | 25 | `enquiries/actions.ts:37` |
| `MEMBERS_PAGE_SIZE` | 25 | `members/queries.ts:7` |
| `AUDIT_PAGE_SIZE` | 50 | `audit/queries.ts:6` |
| `MAX_BODY_BYTES` (analytics) | 2048 | `analytics/client-events.ts:16` |
| Analytics prop limits | 5 keys, 32-char keys, 64-char strings | `client-events.ts:13-15` |
| Visit cookie | `knest_sid`, 180 days | `analytics/track.ts:6,25-32` |
| Search | 20 per collection, 5 collections | `content/search.ts` |
| List caps | 100 (programs, events, mentors, startups, resources), 50 (cohorts, mentor programs) | `content/*.ts` |
| Request body buffer | 12 MB | `next.config.ts:67` |
| `RATE_LIMITS` | see file 12 | `security/rate-limit.ts:13-45` |

## 3. Data-driven configuration (CMS)

| What | Where editors change it | Effect |
|---|---|---|
| Whether a program takes applications | `programs.applicationStatus`, `applicationDeadline` | `closedReason` (file 01) |
| The application form | `programs.applicationQuestions` | Questions, types, options, required, length |
| Event capacity and external registration | `events.capacity`, `registrationUrl` | File 06 |
| Homepage copy and section order | `homepage` global | `enabledSections`, copy fallback (file 11) |
| Mentor, startup, resource, partner visibility | `_status` and collection fields | Public lists |

Operational note: closing a program by setting `applicationStatus` to anything other than `open`, or by passing the deadline, blocks start, save, upload and submit simultaneously; existing drafts are kept but cannot be submitted.

## 4. Database objects these modules own

Tables `app.applications`, `application_answers`, `application_documents`, `event_registrations`, `enquiries`, `analytics_events`, `audit_logs`, and use of `users`, `sessions`, `notifications`, `rate_limits`, `email_outbox`. Migrations under `src/db/migrations/`; the audit table arrived in `0002_wonderful_ender_wiggin.sql`. The runtime database role has `SELECT, INSERT, UPDATE, DELETE` on every `app` and `cms` table and no DDL (`src/db/runtime-role.test.ts:12-18`).
