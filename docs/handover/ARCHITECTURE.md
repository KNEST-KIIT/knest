# KNEST architecture

Audience: the engineers and operators who take over the KNEST platform.

After reading this you will know what the system is made of, where data lives, how a request travels, which controls protect it, and which environment variables it reads.

## Status of this document

This document describes the code in the repository and the target AWS design. It was written on 2026-10-09 from the code and from `docs/delivery/*.md`.

Read these four facts first:

- **Nothing is deployed on AWS.** The CloudFormation templates in `infra/cfn/` are written and checked for structure by tests. Their own headers say "written, not deployed, not validated by CloudFormation". See `docs/delivery/AWS-NATIVE-ARCHITECTURE.md`.
- **The public site is a maintenance page.** Per `docs/delivery/TRACKER.md` and `docs/delivery/DECISIONS-2026-10-09.md`, production runs only a maintenance page on Vercel until the release gates pass.
- **"Done" means verified locally.** It means tested on an ephemeral PostgreSQL 16 against the production build. It does not mean verified on AWS. See `docs/delivery/LOCAL-COMPLETENESS.md`.
- **Lab booking is off.** `FEATURE_LAB_BOOKING` must be exactly `true` to turn it on. It stays off until the lab operating policy (HD-16) is answered and signed by people. See `LAB-OPERATIONS-GUIDE.md`.

## 1. The stack

| Layer | Technology | Where to look |
|---|---|---|
| Web framework | Next.js 16.4.0 (App Router), React 19 | `package.json`, `next.config.ts` |
| Language | TypeScript, strict | `tsconfig.json` |
| Styling | Tailwind CSS 4, design tokens as CSS variables | `src/styles/tokens.css`, `tokens/*.json` |
| CMS | Payload 3.90.2, Lexical rich text editor | `src/payload/` |
| Operational database access | Drizzle ORM 0.45, `pg` driver | `src/db/` |
| Database | PostgreSQL 16 | `docker-compose.yml` locally, RDS on AWS |
| Sign-in | Auth.js v5 (beta.32), database sessions, password sign-in, optional Google | `src/server/auth/` |
| Human check | Cloudflare Turnstile (widget and server verification only) | `src/server/security/turnstile.ts` |
| Mail | Amazon SES (`EMAIL_TRANSPORT=ses`), SMTP as an alternative, console log in local development | `src/server/email/send.ts` |
| File storage | Amazon S3 for application documents and CMS media | `src/server/storage/`, `src/payload/payload.config.ts` |
| Package manager | pnpm 10.33.0 | `package.json` |
| Runtime | Node.js 24 in the container image | `Dockerfile` |

The README says Node 22 or newer for local work. The container image uses Node 24.

## 2. Repository map

| Path | What it holds |
|---|---|
| `src/app/(public)` | Public pages: home, programs, events, mentors, startups, resources, blog, about, contact, search, privacy, terms |
| `src/app/(auth)` | Login, signup, verify, reset |
| `src/app/(member)` | Onboarding, apply, member dashboard, lab booking, lab staff console |
| `src/app/(staff)/admin` | The staff console: overview, applications, enquiries, members, labs, audit, analytics |
| `src/app/(payload)` | The Payload admin UI and Payload API, mounted at `/admin` and `/api` |
| `src/app/api` | Route handlers for sign-in, applications, events, labs, enquiries, health |
| `src/server` | All server logic: auth, applications, labs, security, notifications, content reads |
| `src/db/schema` | Drizzle table definitions for the `app` schema |
| `src/db/migrations` | Drizzle SQL migrations 0000 to 0010 |
| `src/migrations` | Payload migrations for the `cms` schema (three files) |
| `src/payload` | Payload config, collections, the homepage global, access rules |
| `src/proxy.ts` | Runs before every route: origin check and indexing header |
| `src/instrumentation.ts` | Production environment check at start-up |
| `infra/cfn` | CloudFormation templates: `app`, `cert`, `ci`, `dns`, `edge`, `waf` |
| `infra/edge/viewer-request.js` | CloudFront Function source |
| `scripts` | Verification, DNS comparison, secret scan, template rendering |
| `tests` | Integration tests and their stubs |
| `docs/delivery` | Delivery records, designs, approvals, evidence |
| `docs/handover` | These handover documents |

## 3. One database, two schemas

KNEST uses one PostgreSQL database with two schemas. Each has one owner. Neither reads the other through a join.

| Schema | Owner | Holds |
|---|---|---|
| `cms` | Payload | Editorial content: programs, cohorts, startups, founders, mentors, partners, events, resources, articles, infrastructure (spaces), testimonials, FAQs, metrics, media, the homepage, and a mirror table `staff` |
| `app` | Drizzle | Operational data (tables below) |

Tables in `app`:

- **People and sessions:** `users`, `accounts`, `sessions`, `verification_tokens`
- **Applications:** `applications`, `application_answers`, `application_documents`
- **Participation:** `event_registrations`, `notifications`
- **Contact:** `enquiries`
- **Platform:** `audit_logs`, `analytics_events`, `rate_limits`
- **Labs:** `labs`, `lab_hours`, `lab_blackouts`, `lab_staff`, `lab_bookings`, `lab_attendance`

Rules that follow from this split:

- **No operational data in the CMS.** Lab bookings used to live in a CMS collection. A Payload migration (`20261009_083013_drop_cms_lab_bookings`) removed it. Lab bookings now live only in `app`.
- **References across schemas are plain ids.** An application stores a program id. There is no foreign key. To protect against orphaned applications, Payload refuses to delete a program that has applications (`src/payload/collections/programs.ts`). Editors must unpublish instead.
- **`cms.staff` is a read-only mirror.** Real accounts live in `app.users`. Payload requires an auth collection, so the sign-in code writes a row into `cms.staff` on each admin request. Payload cannot create, edit or delete staff, and its own email-and-password login is switched off.
- **Public CMS reads go through one layer.** `src/server/content/*` passes `overrideAccess: false` and no user. A draft can never reach the public site through that layer.
- **The application snapshots its questions.** At submit, the questions an applicant saw are copied onto the application (`question_snapshot`, migration 0007). Staff review the frozen questions, not the program's current ones.

### Migrations

Two migration systems run in a fixed order, through one command: `pnpm migrate`.

1. `tsx src/db/migrate.ts` applies Drizzle migrations to `app`. Drizzle's own bookkeeping table is in a separate `drizzle` schema.
2. `payload migrate` applies Payload migrations to `cms`. Payload's automatic schema push is off (`push: false`), so production never changes shape by itself.

Both start from an empty database. Continuous integration builds an empty database this way and fails if a collection changed without a committed Payload migration.

Drizzle migrations have no "down" step. See `RUNBOOK.md` section 6 for what that means for rollback.

## 4. The request path

This is the target path on AWS. It is a design, not a running system.

```
Visitor
  -> Route 53 (DNS)
  -> CloudFront
       TLS with an ACM certificate (us-east-1)
       AWS WAF web ACL
       Viewer-request function: redirects www.kiitnest.com, kiitnest.in and
         www.kiitnest.in to https://kiitnest.com; optional private-first password gate
       Adds the header X-Origin-Verify (value from Secrets Manager)
  -> EC2 t4g host, one Docker container, Node server on port 3000
       src/proxy.ts: origin check, same-origin check for writes, noindex header
       Next.js route or server action, or the Payload admin and API
  -> RDS PostgreSQL 16 (private subnets) for both schemas
  -> S3 (private) for documents and media
  -> SES for mail; Cloudflare Turnstile for the human check (outbound HTTPS)
```

What each step does:

- **CloudFront caches almost nothing.** The default behaviour uses the managed `CachingDisabled` policy and forwards cookies. Only fingerprinted build assets under `/_next/static/` get a long cache time. The application also sends `Cache-Control: private, no-store` on `/api`, `/dashboard`, `/admin`, `/apply`, `/onboarding`, `/login`, `/signup`, `/verify` and `/reset`. An integration test checks this.
- **Public pages are built per request.** The public layout reads the signed-in user on every request. Next.js therefore renders these pages on demand. A published CMS change should appear on the next page load, with no rebuild. This follows from the code. It has not been observed on a deployed site, because none exists.
- **The origin accepts only CloudFront.** Two controls apply. The security group allows port 3000 only from the AWS-managed CloudFront prefix list. The application also refuses any request that lacks the correct `X-Origin-Verify` header. The prefix list is shared by all CloudFront customers, which is why the header is needed.
- **The database is never public.** RDS sits in two private subnets with no route to the internet. Its security group admits port 5432 only from the app host. The parameter group forces TLS (`rds.force_ssl=1`).
- **The host has no SSH.** Access is by SSM Session Manager. The instance role holds no stored keys.
- **The container runs as user 1001**, with no source code or dev dependencies in the image. It has a health check on `/api/health`.

Open decision: origin TLS. CloudFront to the instance needs a certificate the instance can present. `docs/delivery/AWS-PRODUCTION-BUDGET.md` section 4 describes three options. The templates default `OriginProtocol` to `http-only`, which the edge template says is acceptable only for the sandbox test. A rule in `infra/cfn/edge.yaml` (commit `fac5d49`) now refuses a production deployment unless the origin protocol is `https-only`. The container itself serves plain HTTP on port 3000. A TLS-terminating proxy or load balancer in front of it is not yet designed. Until that is decided, the production edge stack cannot be deployed as written.

## 5. Security controls

Each control below is in the code. Where a control depends on AWS, it is marked as design only.

### Access control

| Control | How it works | File |
|---|---|---|
| Guard first | Every server action, route handler and protected page calls a guard as its first statement. A hidden button is never access control. | `src/server/auth/guards.ts` |
| 404, not 403 | A person without the right role gets "not found" for `/admin` areas, so the console does not confirm itself. Route handlers return 401 or 403 JSON instead. | `guards.ts` |
| Coarse staff roles | Seven staff roles map to areas. There is no fine permission matrix. | `src/server/auth/roles.ts` |
| Roles read on every request | The role comes from the database each time. It is never trusted from a cookie. | `src/server/auth/config.ts` |
| CMS write rules | Payload checks the staff role on every write, for the admin UI and for the API. | `src/payload/access.ts` |
| Lab scoping | A lab head sees only their lab. An assistant sees only their lab's duties. A member sees only their own bookings. | `src/server/labs/access.ts` |

### Sessions and passwords

- **Database sessions, not JWTs.** A JWT cannot be revoked. A database session can be deleted. Password sign-in creates the same session row that Auth.js creates for Google sign-in (`src/server/auth/session.ts`).
- **Session life is 30 days.** The cookie is `httpOnly` and `SameSite=Lax`. It is `Secure` when `AUTH_URL` starts with `https://`.
- **Role changes and deactivation delete the person's sessions** in the same transaction. A deactivated account also cannot start a session.
- **Passwords:** at least 12 characters, no composition rules, stored as bcrypt hashes (cost 12).
- **Tokens:** email verification and password reset tokens are random 256-bit values. Only a SHA-256 digest is stored. They are single use. Verification links last 24 hours. Reset links last 1 hour.
- **The last active super admin cannot be removed, demoted or deactivated.** Nobody can change their own role or active state on the Members screen.

### Request filtering

- **Origin check** (`src/server/security/edge-guard.ts`, called from `src/proxy.ts`). When `ORIGIN_VERIFY_SECRET` is set, every request except `/api/health` must carry a matching `X-Origin-Verify` header. A state-changing request (POST, PUT, PATCH, DELETE) that carries an `Origin` header from another site is refused with 403. Allowed origins come from `SITE_URL` and `ALLOWED_ORIGINS`.
- **Browser headers** (`next.config.ts`): a Content Security Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. The policy allows `'unsafe-inline'` for scripts and styles because the Payload admin needs it. The comment in `next.config.ts` explains why. HSTS is set at CloudFront (`infra/cfn/edge.yaml`). That part is design only.
- **Client address.** The rate limiter uses the address from CloudFront's `CloudFront-Viewer-Address` header in production, not the `X-Forwarded-For` header, which a client can forge (`src/server/security/client-ip.ts`). `CLIENT_IP_SOURCE` overrides this for local work and tests. This is a design that is proven only by unit tests. Real proof needs the hosting spike on AWS.
- **Rate limits.** A token bucket stored in `app.rate_limits`, one atomic statement per check, no Redis. The named limits are in `src/server/security/rate-limit.ts`. Examples: login 5 attempts refilling over 15 minutes (per address); sign-up 5 per hour; contact form 3 per hour; lab request 20 per hour. **Only the listed public and member endpoints are limited.** The lab decide, cancel, respond, attendance and manage routes, the lab availability route, and the `/api/admin/*` routes have no rate limit. These need a signed-in person with the right role, but they are not limited.
- **Human check.** Cloudflare Turnstile is verified on the server for sign-up, sign-in, password reset request, application submit, the contact form and the lab booking request. It fails closed: a missing token, a rejection or an unreachable verifier all refuse the request. The one exception is a development machine with no secret set.
- **Edge protection** (design only, `infra/cfn/waf.yaml`): three AWS managed rule groups (common rules, known bad inputs, IP reputation) and two rate-based rules. The template defaults are 100 requests per 5 minutes per address for `/api/auth/*` and 2,000 per 5 minutes for everything.

### Data handling

- **Uploads.** Application documents are limited to 10 MB. Allowed types are PDF, Word (`.doc`, `.docx`) and PowerPoint (`.ppt`, `.pptx`). The server checks the file's actual bytes, not the declared type. Files go to S3 under a random key. Staff download them through an access-checked route. CMS media accepts only JPEG, PNG, WebP and AVIF. SVG and XML are refused because they can carry script.
- **Database TLS.** `DATABASE_SSL=verify` checks the server certificate against the bundle in `DATABASE_SSL_CA_FILE`. There is deliberately no "encrypt but do not verify" mode.
- **Audit trail.** Every privileged action writes a row to `app.audit_logs` in the same transaction as the change. The audit screen is read-only and visible to super admins only. Publishing in the CMS is not yet audited (`docs/delivery/LOCAL-COMPLETENESS.md`, module 43).
- **Atomic state changes.** Status changes are conditional updates. Two reviewers acting at once cannot both win. Event capacity and lab slots are protected by a database lock and an exclusion constraint.
- **Contact form.** A hidden "honeypot" field drops bot messages silently. The message is stored before any notification email is sent.
- **CSV export.** Cells that start with `=`, `+`, `-` or `@` are prefixed with an apostrophe so a spreadsheet does not run them as formulas.

### Start-up and build

- **The server refuses to start with a bad production environment.** `src/instrumentation.ts` runs `checkProductionEnv` and throws, naming each failing variable. It never prints values. A CI step starts a misconfigured container and confirms it does not serve.
- **Seeds refuse production in the unsafe cases.** Outside a local database, `src/db/seed.ts` needs an explicit `SEED_PASSWORD` of at least 12 characters. The demo and dummy seeds refuse production entirely.
- **CI** (`.github/workflows/ci.yml`) runs lint, a secret scan, typecheck, unit tests and a dependency audit. It then builds, migrates an empty database and runs integration tests against the production build. A third job builds the production image, migrates, starts it and verifies it. CI holds no cloud credentials and deploys nothing.
- **Search engines stay out until the site is opened.** Unless `SITE_INDEXING` is exactly `on`, `robots.txt` disallows everything and every response carries `X-Robots-Tag: noindex, nofollow`.

## 6. Authentication model in one paragraph

There is one account system. A person signs in at `/login`. Staff use the same account. A staff role on that account opens `/admin`. The Payload admin has no login form of its own. A custom Payload strategy (`src/payload/auth-strategy.ts`) reads the Auth.js session, re-reads the role from the database, and treats anyone who is not active staff as anonymous. The extra staff screens at `/admin/overview`, `/admin/applications` and so on are separate Next.js pages that share the `/admin` path prefix.

## 7. Feature flag

| Flag | Default | Effect |
|---|---|---|
| `FEATURE_LAB_BOOKING` | off | When not exactly `true`, the lab pages return "not found", the lab API routes return 404, the Labs entry is hidden from the staff console, and `requestBooking` refuses with "Lab booking is not open yet." The flag is checked in each server action as well as on pages. |

The lab database tables exist even when the flag is off. The migration creates them.

## 8. Environment variables (names only)

Never put values in this file, in the repository or in chat. On AWS the secret values come from Secrets Manager and the non-secret values from SSM Parameter Store. The deploy document writes them into a root-only file in memory-backed storage.

### Required in production (checked at start-up)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `off` or `verify`. Use `verify` on AWS. |
| `DATABASE_SSL_CA_FILE` | Path to the certificate authority bundle. Required when `DATABASE_SSL=verify`. |
| `AUTH_SECRET` | Signs Auth.js data. At least 32 characters. |
| `PAYLOAD_SECRET` | Payload secret. At least 32 characters. |
| `SITE_URL` | Public address of the site. Must be `https://` outside localhost. `NEXT_PUBLIC_SITE_URL` is accepted as a fallback. |
| `TURNSTILE_SITE_KEY` | Public key for the human check widget |
| `TURNSTILE_SECRET_KEY` | Secret key for server verification |
| `EMAIL_FROM` | The "from" address for platform mail |
| `EMAIL_TRANSPORT` | `ses` or `smtp`. If it is not `ses`, then `SMTP_HOST` is required. |
| `S3_BUCKET` | Bucket for documents and media |
| `S3_REGION` | Bucket region |

### Optional or conditional

| Name | Purpose |
|---|---|
| `AUTH_URL` | Public address for Auth.js. Decides whether the session cookie is `Secure`. |
| `AUTH_TRUST_HOST` | Set to `true` behind a proxy |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Turn on Google sign-in. Leave unset to disable it. |
| `ORIGIN_VERIFY_SECRET` | Value of the `X-Origin-Verify` header. At least 32 characters. The origin check runs only when this is set. |
| `CLIENT_IP_SOURCE` | `cloudfront` or `x-forwarded-for`. Defaults to `cloudfront` in production. |
| `ALLOWED_ORIGINS` | Extra origins allowed to make state-changing requests |
| `TURNSTILE_VERIFY_URL` | Override the verification address (tests only) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP mail transport |
| `SES_CONFIGURATION_SET` | Optional SES configuration set |
| `AWS_REGION` | Region for SES. Falls back to `S3_REGION`. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Set together or not at all. Leave both unset on AWS so the instance role is used. |
| `S3_ENDPOINT` | S3-compatible endpoint (tests only) |
| `ENQUIRY_NOTIFY_EMAIL` | If set, each contact form message is also emailed to this address |
| `FEATURE_LAB_BOOKING` | Lab booking switch (section 7) |
| `SITE_INDEXING` | Set to `on` to allow search engines. Anything else keeps the site hidden. |
| `LEGAL_DRAFT_PREVIEW` | Set to `true` in a non-production preview to show an outline on `/privacy` and `/terms` |
| `NODE_ENV`, `PORT`, `HOSTNAME` | Standard runtime settings. The image sets `PORT=3000` and `HOSTNAME=0.0.0.0`. |

### Local development, seeding and tests only

| Name | Purpose |
|---|---|
| `SEED_PASSWORD`, `SEED_ADMIN_EMAIL`, `SEED_RESET_EXISTING` | Control the first super admin seed |
| `ALLOW_DEMO_SEED`, `APP_ENV` | Guards for the demo seeds |
| `TEST_DATABASE_URL` | Integration tests. The database name must end in `_test`. |
| `KNEST_VERIFY_BASIC` | Credentials for the verification script when the access gate is on |

`.env.example` lists the local development variables. It also lists `CLOUDFRONT_URL`, which no file under `src/` reads.

## 9. What is verified and what is not

| Area | State |
|---|---|
| Application code and tests | Reported passing locally in `docs/delivery/LOCAL-COMPLETENESS.md`. **UNVERIFIED: the test counts in that file (349 unit, 274 integration).** A static count of test cases by the evaluator gives fewer (about 223 and 175), and nobody has quoted a test run summary with its date and commit. Do not quote counts until one is recorded. |
| Lab booking switched off | **UNVERIFIED by test:** no integration test runs with `FEATURE_LAB_BOOKING` off (the test setup turns it on). The "off means refused" behaviour is read from the code. |
| CloudFormation templates | Written. Structure tested, and a static `cfn-lint` run is reported clean in commit `fac5d49` (no AWS calls). Not validated by CloudFormation itself. Not deployed. |
| DNS plan | Prepared in `docs/delivery/DNS-MIGRATION.md`. Nothing executed. |
| Real S3, SES, Turnstile and Google sign-in | Not proven. Tests use stubs. The hosting spike (S-1) is meant to prove S3. Google sign-in has never been tested while enabled. |
| Accessibility | The automated axe suite passes for the pages and states it scans, at desktop and phone width. It does not scan the open mobile menu, the booking times list, forms showing errors, or `/admin/applications/[id]`. A code review found serious problems (see `ACCESSIBILITY-REVIEW.md` in this folder). No person has tested with a keyboard or screen reader. Treat accessibility as partly done. |
| Restore from backup | Not rehearsed. |

## 10. Related documents

- `docs/delivery/AWS-NATIVE-ARCHITECTURE.md`: the hosting design and decisions
- `docs/delivery/AWS-PRODUCTION-BUDGET.md`: expected monthly cost and the origin options
- `docs/delivery/LAB-BOOKING-DESIGN.md`: the lab module design
- `docs/delivery/LOCAL-COMPLETENESS.md`: module-by-module status
- `docs/delivery/TRACKER.md`: delivery status and gates
- `docs/delivery/DNS-MIGRATION.md`: domain and mail migration
- `RUNBOOK.md`: deploy, migrate, roll back, back up
