# 01. Overview and data model

## What the subsystem is

KNEST has one account system. A person is one row in `app.users`; staff are the same rows with a non-null `staff_role` (`src/db/schema/users.ts:13-18`, `:36-37`). There is no second user table and no separate staff login. The Payload CMS admin does not own users either: `src/payload/auth-strategy.ts` hands Payload the already-authenticated Auth.js user (see file 05).

Sign-in methods:

| Method | Entry point | Session produced |
|---|---|---|
| E-mail and password | `POST /api/auth/password/login` | Database session row minted by our own code (`src/server/auth/session.ts:44-60`) |
| E-mail link (first sign-in after sign-up) | `POST /api/auth/password/verify/confirm` | Same session row, minted by `confirmEmailVerification` (`src/server/auth/actions.ts:135`) |
| Google | `POST /api/auth/google/start`, then Auth.js `/api/auth/callback/google` | Session row minted by the Auth.js Drizzle adapter |

All three end in the same `app.sessions` row and the same cookie name, so `auth()` reads every session the same way.

## Why database sessions, not JWT

`src/server/auth/config.ts:24-26` selects `strategy: 'database'`. The comment states the reason: a session can be revoked server-side the moment a role changes or an account is disabled. A JWT cannot be revoked before expiry. The same reasoning is why there is no Auth.js Credentials provider (`config.ts:28-30`): Auth.js forces JWT sessions when one is configured, so password sign-in bypasses it and inserts the session row directly (`session.ts:7-20`).

Consequence: every authenticated request costs at least one database read for the session plus one for the user row (the `session` callback re-reads the user, `config.ts:49-61`). The system trades per-request database work for immediate revocation.

## Component map

```
Browser
  |  HTTPS
CloudFront (adds x-origin-verify, CloudFront-Viewer-Address)           [infra, not in this volume]
  |
Next.js process
  src/proxy.ts  --> src/server/security/edge-guard.ts   (origin secret, same-origin writes, noindex)
  next.config.ts headers()                              (CSP, nosniff, frame, cache-control)
  route handlers  src/app/api/auth/**
       |-- src/server/security/rate-limit.ts / route-limits.ts   (Postgres token bucket)
       |-- src/server/security/captcha.ts -> turnstile.ts        (Cloudflare siteverify)
       |-- src/server/auth/actions.ts                            (business logic)
              |-- tokens.ts, session.ts, validation.ts, dummy-hash.ts
              |-- src/server/email/send.ts -> outbox.ts -> SES | SMTP | console
  src/server/auth/index.ts  NextAuth(authConfig)  -> auth(), handlers, signIn
       |-- config.ts (adapter wrapped by active-only-adapter.ts, session callback)
  src/server/auth/guards.ts  requireUser, requireStaff, requireAdminArea ...
  src/server/notifications/*  in-app rows + paired e-mail
Postgres  schema `app`
```

## Request path for a mutating call

1. `src/proxy.ts` runs on every path (`matcher: '/:path*'`, `proxy.ts:19`) and refuses the request with a bare 403 `Forbidden` and `cache-control: no-store` when `guardRequest` denies it (`proxy.ts:10-12`).
2. The route handler applies its own rate limit, then the Turnstile check where the route has one, then calls the business function.
3. Business functions never read the cookie themselves except `session.ts`; they call a guard (file 05) or are public by design (the `/api/auth/password/*` routes).

## Tables touched

All in Postgres schema `app` (`appSchema`, `src/db/schema/enums.ts:11`).

### `users` (`src/db/schema/users.ts:19-80`)

| Column | Type | Use in this volume |
|---|---|---|
| `id` | text PK, `crypto.randomUUID()` default | Session owner, `requireSelf` comparison |
| `email` | text, not null, unique | Login identifier. Unique index is case-sensitive; lowercasing is done only by `emailSchema` (see file 04) |
| `email_verified` | timestamptz null | Set by `confirmEmailVerification`. Not required to sign in. Required to submit an application (`src/server/applications/actions.ts:250-254`) and to book a lab (`src/server/labs/service.ts:123-125`) |
| `password_hash` | text null | bcrypt cost 12. Null for Google-only accounts (`users.ts:29`) |
| `platform_role` | enum, default `student` | Copied into the session object |
| `staff_role` | enum null | Non-null means staff; re-read on every session read |
| `is_active` | boolean, default true | Deactivation flag, enforced at password login, in the session adapter, in the Google `signIn` callback and in the Payload strategy |
| `onboarding_completed_at`, `journey_stage` | timestamptz / enum | Copied into the session object as `onboardingComplete`, `journeyStage` |
| `updated_at` | timestamptz | Touched by verification, reset, deactivation, role change |

### `sessions` (`users.ts:112-122`)

`session_token` (PK, the cookie value, stored in clear), `user_id` (FK to users, `ON DELETE CASCADE`, indexed), `expires`. Rows are deleted at log-out, at password reset, at deactivation and at staff-role change. Expired rows are not purged by any code located in this reading (file 13, L-04).

### `verification_tokens` (`users.ts:124-132`)

`identifier` and `token` form the composite primary key; `expires`. Used by `tokens.ts` with identifier `<purpose>:<email>` and `token` holding the SHA-256 digest (file 04).

### `accounts` (`users.ts:84-105`)

Auth.js OAuth links: PK `(provider, provider_account_id)`, `user_id` FK cascade. Written only by the Google flow.

### `rate_limits` (`src/db/schema/security.ts:11-15`, migration `0005_warm_outlaw_kid.sql:1-5`)

`key` text PK, `tokens` double precision, `updated_at`. One row per bucket key. No purge (file 07).

### `email_outbox` (`src/db/schema/email-outbox.ts`, migration `0011_email_outbox.sql`)

Columns: `id`, `to_address`, `subject`, `body`, `status` (`pending|sent|expired|dead`), `attempts`, `next_attempt_at`, `expires_at`, `last_error`, `created_at`, `sent_at`. Index `email_outbox_due_idx (status, next_attempt_at)`.

### `notifications` (`src/db/schema/notifications.ts:13-35`)

`id`, `user_id` (FK cascade), `type` (enum of 8 values: `application_received`, `application_status_changed`, `application_deadline_reminder`, `event_registered`, `booking_requested`, `booking_decided`, `booking_alternative`, `booking_cancelled`; `src/db/schema/enums.ts:97-106`), `title`, `body`, `href`, `application_id` (FK cascade), `read_at`, `created_at`. Indexes on `user_id` and `(user_id, read_at)`.

### `audit_logs` (`notifications.ts:43-59`)

`actor_user_id` (FK `RESTRICT`), `action`, `entity_type`, `entity_id`, `before`, `after` (jsonb), `created_at`. Audit actions written by code in this volume's scope: `account_deactivated`, `account_reactivated`, `staff_role_changed` (`src/server/members/actions.ts:56-63`, `:97-104`) and `email_resent` (`src/server/email/outbox.ts:116-123`).

## Where concurrency and ordering matter

| Place | Mechanism | Why |
|---|---|---|
| Token consume | Single `DELETE ... RETURNING` | Of two requests with one link exactly one gets the row (`tokens.ts:45-59`) |
| Reset | Token delete, password update and session delete in one transaction | A failed write must not burn the only recovery link (`actions.ts:170-181`) |
| Rate limit | One `INSERT ... ON CONFLICT DO UPDATE` | Atomic per key (`rate-limit.ts:59-72`) |
| Outbox claim | `FOR UPDATE SKIP LOCKED` plus a lease in `next_attempt_at` | Two workers never send the same row at once (`outbox.ts:137-151`) |
| Operator resend | Row lock inside a transaction | Two operators pressing Resend send once (`outbox.ts:100-103`) |
| Staff membership changes | `pg_advisory_xact_lock(hashtext('knest:staff-membership'))` | Concurrent cross-demotions cannot remove the last super admin (`members/actions.ts:41`, `:81`) |
