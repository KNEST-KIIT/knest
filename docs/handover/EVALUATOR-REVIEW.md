# Evaluator review: KNEST platform, committed state

Reviewer: senior technical evaluator (engineering only). Branch `delivery/p1-containment`, reviewed at HEAD `fac5d49` (code and tests identical to `1fc5fcc`; `c97ec65` and `fac5d49` changed docs and `infra/cfn` only). Method: read the committed source, tests, migrations, Dockerfile, CI, CloudFormation and delivery docs through `git show HEAD`; read the other reviewers' reports under `docs/handover/`; used `gh run list` (read-only) for CI facts. **Nothing was built, run or deployed by me**, so every "passes" below is either a test I read or a CI result I looked up, not something I executed.

Not granted and not grantable by an engineer (all OWNER-REQUIRED): AWS identity and spend (S-1 operator policy, teardown roles, production ceiling), privacy and terms text (HD-06), lab operating policy (HD-16), copy approval (HD-04), contract record and variation (HD-21, HD-22), DNS and nameserver cutover, Turnstile account and secret.

---

## 1. Verdict table

| # | Gate | Verdict | One-line reason |
|---|------|---------|-----------------|
| 1 | Security | **CONDITIONAL** | Auth, session revocation, per-lab authorisation, SQL handling and token hygiene are sound and tested. One blocking gap (origin guard can be silently off in production), several majors (below). |
| 2 | Data integrity | **CONDITIONAL** | The lab-booking exclusion constraint and conditional-update patterns are correct and proven under 20-way parallel load. Migrations are forward-only; no pre-migration snapshot; stale requests never expire. |
| 3 | Application, events, lab-booking correctness | **CONDITIONAL** | Matches `LAB-BOOKING-DESIGN.md` in all the places that matter; deviations: approve-in-the-past, no expiry, assistant visibility, flag-off untested. |
| 4 | Test quality | **CONDITIONAL** | Concurrency and authorisation tests are real (real DB, real HTTP, production build, mutation-checked in places). Gaps: flag-off, rate limit on lab routes, same-user parallel limit, weak negative assertions on the lab console, one permanently `it.fails`. |
| 5 | Operability | **FAIL for production / public; CONDITIONAL for a private S-1-style deployment** | Production edge cannot be deployed as templated (no TLS terminator for the mandatory https-only origin); RDS-managed master password rotation will break the running app; no pre-migration snapshot. Env validation, health check, log hygiene, CI image job are good. |
| 6 | Documentation honesty | **CONDITIONAL** | The docs are unusually candid (they say "not deployed", "UNVERIFIED", "not enabled until HD-16"). But several specific claims are stale or overstated (section 9). |

Go / no-go:

- **Restricted first AWS deployment (private-first, synthetic accounts only, maintenance page or Basic-auth gate, lab booking OFF): CONDITIONAL GO.** Preconditions P1 to P6 in section 11. Without them: NO-GO.
- **Public launch: NO-GO today.** Needs the production TLS path, DB credential design, restore drill, the accessibility and UI criticals, the owner approvals, and S-1 evidence for everything currently proven only by unit test.

---

## 2. Blocking defects (fix first, each with a concrete fix)

Sent to the E2E engineer (src) and listed here for the infra owner (the infra reviewer could not be reached; the lead must route I1 to I3).

| ID | Where | Defect | Fix | Blocks |
|----|-------|--------|-----|--------|
| **B1** | `src/server/env.ts:26`, `src/server/security/edge-guard.ts:236`, `src/server/security/client-ip.ts:96` | `ORIGIN_VERIFY_SECRET` is `.optional()` in the production environment check. If it is missing, the origin guard is silently off, but production still defaults to taking the client address from `CloudFront-Viewer-Address`. Anyone who can reach the origin can then forge that header and defeat every per-IP rate limit and login throttle; the "origin accepts only CloudFront" claim becomes untrue without any error. | Require it (min 32 chars) whenever `NODE_ENV=production` and the source is CloudFront (explicit opt-out variable for the S-1 spike only). Add `env.test.ts` cases and a CI image-job case "missing secret refuses to start". | Any deployment |
| **I1** | `infra/cfn/app.yaml` (`ManageMasterUserPassword: true` + deploy document env file) | RDS-managed master secrets rotate automatically (about every 7 days). The deploy document copies the password into the container environment once; `--restart unless-stopped` reuses it. The app loses its database within about a week, silently until an alarm that does not exist (I5). The app also runs as the master user and migrates as the master user. | Two roles: `migrator` (DDL) and `app` (DML only). App password in its own Secrets Manager secret without automatic rotation (or rotation with a restart hook). Read at start. Document it. | Production |
| **I2** | `infra/cfn/app.yaml` deploy document; `src/db/migrate.ts`; Payload migrations | Migrations run before the new container is proven healthy; "rollback" restarts the previous image against a possibly newer schema. Drizzle and Payload migrations are forward-only (enum `ADD VALUE` in 0010 is irreversible; Payload `down()` of `drop_cms_lab_bookings` recreates structure, not data). No snapshot before migrating, no restore drill. | `aws rds create-db-snapshot` and wait, from the deploy role, before `ssm send-command`. State the expand/contract rule in the runbook. Record one restore drill as evidence. | Production |
| **I3** | `infra/cfn/edge.yaml` Rule `ProductionOriginUsesTls`; `app.yaml` | The new Rule (good) forces `https-only` for production, but the container serves plain HTTP on 3000 and no ALB or host certificate exists in the templates. As written, production edge cannot work. `AWS-PRODUCTION-BUDGET.md` section 4 already says this adds about 18 to 25 USD (option C). | Pick ALB + ACM (option C) or implement the host-certificate path; update templates, budget headline and template tests. | Production / public |
| **B2** | `src/server/labs/service.ts:203-213`, `:261-267` | A head can approve a request whose start time has already passed. No code expires stale `requested` or `alternative_proposed` rows although the design says expired bookings release the slot; one such row holds the slot and counts against `max_open_requests` forever. | Require `startsAt > now` on approve and on accepting a proposal; add expiry (scheduled `UPDATE` to `cancelled` with a note, or lazily in the list queries). Test both. | Lab booking enablement (not the first private deployment, since the flag is off) |

---

## 3. Gate 1: Security

**Verified sound (with evidence)**

- Session model: database sessions, 30-day max age, cookie `httpOnly; sameSite=lax; secure` derived from `AUTH_URL` (`src/server/auth/session.ts:150-166`). Deactivation and any role change delete sessions in the same transaction (`src/server/members/actions.ts:48-52, 78-85`), and the adapter refuses inactive users on every session read (`src/server/auth/active-only-adapter.ts`). The session callback returns an explicit object, so the raw session token is never published (`config.ts:232-259`). Real-cookie tests: `tests/integration/25-account-deactivation.test.ts`.
- Credentials: bcrypt cost 12; constant-work login with a dummy hash (`actions.ts:294`); verification and reset tokens are 256-bit, stored as SHA-256, consumed by `DELETE ... RETURNING` (atomic single use), purpose-scoped, and reset revokes all sessions (`tokens.ts`, `actions.ts:433`). Test `28-token-hygiene.test.ts`.
- Lab authorisation is per lab, inside each function, not only in the UI: `actorFor` / `requireManager` / `requireStaffOfLab` (`src/server/labs/access.ts`), used by every mutation in `service.ts` and `manage.ts`. Head of lab A cannot decide, cancel, mark attendance, change hours or staff of lab B; only an administrator appoints or removes a head (`manage.ts:173,195`); report scope is enforced in SQL parameters (`reports.ts:247-256`). Tests `34-lab-booking.test.ts:112,353,416,479`.
- Booker identity: only `listLabBookings` and the roster join `users`, both behind `canStaff`/`canManage` checks at the page; the availability endpoint selects times only (`service.ts:76-80`). The old CMS collection and its REST surface are removed (migration `20261009_083013_drop_cms_lab_bookings`).
- Input handling: zod on all lab request and settings payloads; all SQL is Drizzle-parameterised; the one raw report query interpolates only bound parameters (`reports.ts:256-275`); CSV formula neutralisation (`reports.ts:316-321`, tested at `34:493`).
- CSRF / origin: SameSite=Lax plus an `Origin` allow-list for unsafe methods in the proxy (`edge-guard.ts:241-249`, unit tested), Next's own Server Action origin check, `Cache-Control: private, no-store` on private paths (`next.config.ts:271-285`). A missing `Origin` header is allowed (non-browser clients), which is acceptable given SameSite.
- Turnstile fails closed in production (`turnstile.ts:344`); applied to signup, login, reset request, application submit, contact and lab request.
- Uploads: allow-list of document MIME types, magic-byte sniffing (`file-verify.ts`), 10 MB cap, random storage keys, `attachment` + `nosniff` on download, SVG/HTML/XML refused for CMS media (tests `20`, `27`).
- Secrets: no secret in the repo (CI secret scan, `infra/security/scan-secrets.test.ts`), env validation reports names only (`env.ts`), session error logging never includes the token (`guards.ts:30`).

**Defects and risks**

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| Blocking | B1 above | env.ts:26 | above |
| Major | `'use server'` modules export helpers that trust a caller-supplied `userId` (`applications/actions.ts:20,29,333`, `events/actions.ts:91,98,106`, `notifications/actions.ts:15,23`). Next strips unused actions from client bundles (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, Security section), and no client component imports them today, so this is not exploitable now; it is one import from an IDOR. `FINDINGS.md` KN-22l is correctly still open. | grep of `'use client'` files found no import | Move to non-`'use server'` modules; add a lint test |
| Major | Staff with the `applications` area can read **draft** applications and their documents by id, contradicting the queue comment that drafts are "not for staff to read". | `review.ts:67`, `api/admin/applications/[id]/documents/[questionId]/route.ts:20` (no status filter) | `ne(status,'draft')` in both; test |
| Major | Unvalidated body into `decideBooking`: non-string `note` or `assistantUserId` throws (500) after authorisation. Authenticated heads only, but it is an unhandled error path on a decision endpoint. | `decide/route.ts:8-12`, `service.ts:211,217,231` | zod discriminated union in the route |
| Major | Rate limiting is partial. No limiter on lab decide/cancel/respond/attendance/manage, lab availability, or `/api/admin/*`; login is per-IP only (`login/route.ts:7`), no per-account throttle, so a distributed attacker is limited only by Turnstile. Docs say "every sensitive endpoint". | route-by-route grep | per-user buckets; per-email login bucket (the pattern exists in `verify/send`) |
| Major | Upload route buffers the whole multipart body before checking size; the comment says otherwise. Authenticated and limited to 20 per hour, but a 12 MB-class body per request is cheap memory pressure on a 2 GiB host. Replaced uploads orphan the old S3 object. | `api/applications/[id]/documents/route.ts:10-18`; `applications/actions.ts:203` | Check `Content-Length` first; delete the old object after commit |
| Major | Last-super-admin guard is read-then-write outside the transaction; two admins demoting each other concurrently can leave zero. | `members/actions.ts:20-30, 57` | lock rows inside the transaction |
| Major (UI) | Staff-role `<select>` posts on every `change` up to `super_admin`; a stray arrow key can grant super admin (UI reviewer C1). | `docs/handover/UI-UX-REVIEW.md` C1 | explicit Save + confirm |
| Minor | Turnstile verification ignores the response `hostname`. | `turnstile.ts:358` | check hostname when `SITE_URL` is set |
| Minor | `decideBooking` loads the booking before authenticating, so an anonymous caller can distinguish existing (401) from unknown (404) ids. IDs are unguessable UUIDs. | `service.ts:191` | authenticate first |
| Minor | Sign-up reveals an existing address (different response); sessions stored unhashed (Auth.js default); `next-auth` 5 beta; CSP needs `'unsafe-inline'` for Payload; two documented audit advisories ignored (1 high, 1 moderate, build/dev paths). Known and recorded in `FINDINGS.md`. | FINDINGS KN-03, KN-22b, KN-28 | accepted risks; owner to acknowledge |
| Risk | The whole rate-limit design relies on `CloudFront-Viewer-Address` reaching the app, forwarded by the managed origin request policy `33f36d7e-...`. Unit-tested header selection only; not proven on a real distribution. | `client-ip.test.ts`, `edge.yaml:211-214` | S-1 must record header presence and a direct-to-origin 403 |

**Admin console**: `(staff)/admin/layout.tsx` uses `requireStaff()` and each area uses `requireAdminArea`/`requireStaffOrThrow(area)`; API handlers re-check. Every `/api/admin/*` handler maps `UnauthorizedError` to 401/403. Payload REST is gated by `canWrite(area)` and the Auth.js bridge re-reads role and `isActive` per request (`payload/auth-strategy.ts:44`). I found no route or server action that mutates without an authorisation call.

---

## 4. Gate 2: Data integrity

**Verified**

- `app.lab_bookings` carries `EXCLUDE USING gist (lab_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE status IN ('requested','approved','alternative_proposed')` (`src/db/migrations/0010_lab_booking.sql:119`). Default `[)` bounds, so back-to-back bookings are allowed; the predicate list equals `LIVE_STATUSES` (`rules.ts:164`); the app maps SQLSTATE `23P01` to a 409 (`service.ts:44-47`). The Drizzle snapshot does not know the constraint, so a future `drizzle-kit push` would drop it, but `generate` plus committed SQL is the declared path and the 20-way race test would catch a regression.
- `btree_gist` is a trusted extension on PostgreSQL 13+, so the migrating role needs only database ownership (state this in the runbook). `ALTER TYPE ... ADD VALUE` is not used in the same transaction, so the migration is legal.
- Every state change is a conditional `UPDATE ... WHERE status = <read status>` with audit row and notification in the same transaction; email is sent after commit (`service.ts:236-257, 319-334`). Same pattern for applications (`review.ts:140-168`), `FOR UPDATE` row locks on answers/uploads/submit (`applications/actions.ts:106-114`), per-user `FOR UPDATE` for booking limits (`service.ts:131`).
- Drizzle `app` migrations 0000-0010 and three Payload `cms` migrations; migrate-from-zero and re-run no-op are in the suite (`60-dependencies-and-migrations.test.ts`) and the CI image job migrates an empty database from the built image. Payload drift is checked by running `payload migrate:create --skip-empty`.

**Defects**

- No Drizzle-side drift check (TS schema versus applied SQL); only Payload is checked.
- Forward-only migrations with no snapshot and no restore drill (I2). The Payload migration that drops `cms.lab_bookings` is destructive: safe only because no deployed database holds data.
- Stale requests never expire (B2); proposals are not slot-checked when proposed (only when accepted, where the exclusion constraint answers correctly).
- `lab_bookings.user_id` is `ON DELETE RESTRICT`: account erasure under a privacy request (HD-06) will be blocked until bookings are anonymised. Needs a policy decision.
- Last-super-admin race (M5), replaced-upload orphans.
- Accepting a proposal does not re-validate hours, blackouts or the weekly cap; low risk.

---

## 5. Gate 3: Correctness against the design and contract docs

Matches design: statuses and transitions table (`rules.ts:151`), IST-based slot generation and request validation, policy columns as settings, eligibility (`verified` / `onboarded`), per-person open-request and weekly-hours limits inside one locked transaction, assistant assignment where required, alternative accept and decline, cancel cut-off with head override requiring a reason, manual attendance labelled `manual` with audit rows, reports counted from tables with CSV, Turnstile and rate limit on request, flag off hides pages and routes (`labRoute`, per-page `notFound()`).

Deviations (each is a decision or fix, none is silent):

1. Approve in the past; no expiry (B2).
2. Design flow 3 says an assistant "sees only their own upcoming duties"; the console shows every approved booking in the lab with booker name and e-mail to assistants (`service.ts:379-394`, `lab-staff/[slug]/page.tsx:42`, asserted by test `34:519`). The design's own security rules allow this; the two sections disagree. Needs the lab heads' decision (HD-16).
3. "Feature flag off means every route and action refuses" is listed as a closing test; no integration test runs with the flag off (`global-setup.ts:69` sets it true). Unit coverage of `isLabBookingEnabled` only.
4. Attendance has no time ceiling (a booking can be marked years later) and no distinction between "assigned assistant" and "any assistant of the lab".
5. Contract traceability rows 2, 8, 24-29, 32, 39 are stale relative to the code (baseline document); `LOCAL-COMPLETENESS.md` is the current one.

Applications and events: submit-time re-validation, frozen question snapshot, locked answer/upload/submit, conditional review transitions, event capacity under parallel load, past events refused, confirmation sent once. Test evidence is the mutation-checked `26-concurrency.test.ts` ("with the pre-fix source restored, 6 of the 7 tests fail", per `TRACKER.md`; I did not re-run it).

---

## 6. Gate 4: Test quality

Strong:

- `34-lab-booking.test.ts:183` fires 20 simultaneous requests from 20 different members and asserts exactly one 201, nineteen `409 conflict`, and one live row. `:339` races an approve against a reject and asserts exactly one audit row and one notice. These prove behaviour, not mocks: real PostgreSQL, production build, real cookies.
- Authorisation matrices include outsiders, another lab's head, the booker, an unrelated staff role and anonymous, and check the database row afterwards (`:353-364`).
- No mocks in the integration tier except stub SMTP, S3 and Turnstile servers that implement the protocol.
- CI ran green on `1fc5fcc` (run 37915526485) including the image job; `fac5d49`'s run was still in progress when I looked.

Weak or missing:

- CI history is not what the docs imply: the lab-booking commit `1427180` (run 37914486518) and the infra commit `83143e2` (run 37900955747) **failed** and were fixed by later commits; `EVIDENCE/ci-runs.md` stops at `3ce052c`.
- Flag-off behaviour untested (above); `labRequest` rate limit never exercised because every call uses `uniqueIp()`; per-user limit test is sequential, so the `FOR UPDATE` that makes it race-safe is untested; the "real 404 for everyone else" test asserts only absence of strings because status is 200 (its comment admits it).
- `tests/integration/40-analytics.test.ts:76` is a permanent `it.fails` for KN-22c. Production behaviour (CloudFront-sourced IP) is not covered by any integration test; only `client-ip.test.ts` covers header selection.
- Test counts in `LOCAL-COMPLETENESS.md` ("349 unit and 274 integration") cannot be reproduced by a static count (about 223 and 175 `it()` calls); they may include parameterised cases. Ask for the vitest summary.
- The 35 axe test scans pages in their resting state only; the accessibility reviewer lists 10 Serious issues in interactive states that it cannot see.
- No test of the deploy document, the Dockerfile `migrate` target under a non-superuser role, or restore.
- New, uncommitted journey tests (`36/37/38-journey-*.test.ts`) were not reviewed (not committed).

---

## 7. Gate 5: Operability

Good: production env validation fails closed at start and names only variable names (`env.ts`, `instrumentation.ts`; CI proves a misconfigured container refuses to serve); `/api/health` reports only ok/unavailable and checks the database; Dockerfile is multi-stage, non-root runner (uid 1001), standalone output, health check, no secrets at build, image digests used for deploy, ECR/OIDC pipeline with required reviewers for `production`; RDS is private, encrypted, TLS forced, deletion protection and snapshot policy in production, 7-day backups; S3 private, TLS-only, versioned in production; secrets generated in Secrets Manager; IMDSv2 only; no SSH; SSM only.

Defects (infra detail is in section 2 and below; teammates' cfn-lint work already fixed Turnstile key delivery, app-to-DB egress and parameter constraints in `fac5d49`):

- I1, I2, I3 (blocking for production).
- I4 instance role lacks `s3:DeleteObject` and `s3:ListBucket`; Payload media replace/delete will fail, missing keys return 403.
- I5 alarms cover host status, DB CPU and DB storage only; nothing alarms on user-visible failure (health through CloudFront, 5xx rate, WAF blocks, failed deploy). `AppInstance` has no auto-recovery.
- I6 the private-first Basic-auth gate is an unsalted SHA-256 of `user:password` in public function source; acceptable only with a long random passphrase.
- I7 CloudFront-Viewer-Address and origin-bypass behaviour unproven until S-1.
- Single instance, single AZ: every deploy stops the container (`docker rm -f knest` before start); RPO is the PITR window, RTO is hours. Needs owner acceptance in the budget approval.
- `migrate` image runs as root with source and dev dependencies; never exposed publicly, but drop privileges.
- Logging: application logs go to CloudWatch via `awslogs`; no request logging or correlation id, errors via `console.error`; none of the paths I read log secrets or tokens. Email fallback logs links to the console only when no transport is configured, which production env validation forbids.
- Backups: RDS automated backups and S3 versioning exist as templates; **no restore has ever been performed**.

---

## 8. Other reviewers folded in

- Accessibility (`ACCESSIBILITY-REVIEW.md`): 10 Serious, 14 Moderate, 11 Minor, no Critical. Serious items that matter for gates: booking picker deletes its own success and conflict messages (4.1.3), mobile drawer is not modal and may render empty under `backdrop-filter`, form-control focus indicator weak. Gate 5/WCAG: **CONDITIONAL**, required before public launch; the mobile drawer must be checked in a real browser before even a private pilot on phones.
- UI/UX (`UI-UX-REVIEW.md`, overall below 6/10): Critical C1 (role select auto-submits, security-relevant, listed above), C2 (lab pages have no gutters), C3 (form-control border 1.34:1). These do not block a private first deployment with the lab flag off, except C1 if more than one staff member exists.

---

## 9. Gate 6: Documentation honesty

Credit first: the docs say "not deployed", "UNVERIFIED in any environment", "Nothing here is an approved lab policy", and keep owner-only items separate. Specific unsupported or stale statements (also sent to the docs writer):

1. `LOCAL-COMPLETENESS.md` module 51 test counts not reproducible by static count.
2. Module 40 "Every sensitive endpoint" is false (gaps in section 3).
3. Module 5 "DONE (automated)" versus 10 Serious accessibility findings.
4. Module 8 and the lab-console tests describe "404" where the test only asserts that strings are absent.
5. `FINDINGS.md` is stale both ways: KN-22b/d/g/h/i and KN-08/19/20 understate progress (hashed tokens, origin guard, throttles, lab rebuild, CI running), while KN-22c still reads "open" although production default changed; KN-22l is correctly open.
6. `TRACKER.md` / `EVIDENCE/ci-runs.md` omit the two failed CI runs and anything after `3ce052c`.
7. `AWS-NATIVE-ARCHITECTURE.md` section 2 "This closes KN-22c" is a design statement; it is closed only when S-1 shows the header and the direct-origin 403.
8. `CONTRACT-TRACEABILITY.md` rows contradict current code (it is a baseline, but nothing points to the superseding file).
9. `AWS-PRODUCTION-BUDGET.md` headline (45 to 51 USD) does not carry the now mandatory TLS-terminator cost; the template Rule forces it.
10. `LAB-BOOKING-DESIGN.md`: expiry and flag-off test claims, assistant visibility (section 5).

---

## 10. Residual risks (after the fixes above)

1. Everything AWS is unproven: no CloudFormation stack has ever been created (templates pass `cfn-lint`, per `fac5d49`, not a deploy). Origin TLS, CloudFront header forwarding, SES, RDS TLS verification, S3 permissions, WAF rules, and the deploy document are all untested end to end.
2. Single instance and single AZ.
3. Accepted application risks: `next-auth` beta, two ignored audit advisories, `unsafe-inline` CSP, unhashed session tokens, sign-up enumeration, no per-account login lockout.
4. Privacy: erasure vs `ON DELETE RESTRICT`, retention of uploaded documents and orphans, no data-processing text (HD-06 OWNER-REQUIRED).
5. Lab policy values are recommended defaults, not approved (HD-16 OWNER-REQUIRED); QR/offline/PWA are deliberately not built.
6. Accessibility and UI criticals open; no screen-reader pass by a person.
7. Content honesty depends on empty CMS states until HD-04 copy is approved.

---

## 11. Path to a safe first deployment

Restricted private deployment (synthetic data only, `FEATURE_LAB_BOOKING` unset, gate or maintenance page on, no real student data):

- P1. Fix **B1** (required `ORIGIN_VERIFY_SECRET`) and test it.
- P2. Choose the environment: either use the `s1` environment (http-only origin, disposable, USD 25 ceiling, synthetic data) or fix **I3** and use `production`. Do not run production with `http-only`; the template Rule now prevents it.
- P3. **I1**: separate app and migrator roles and a non-rotating (or restart-hooked) app credential, or consciously accept a one-week life for the S-1 spike only.
- P4. **I2**: snapshot before migrate in the pipeline; do one restore drill and attach the evidence.
- P5. Add the health-through-CloudFront and 5xx alarms (I5) and the S3 delete/list permissions (I4).
- P6. Run S-1 and record: header forwarding reaches the app, direct-origin request without the secret is 403, S3 upload and download, SES send, RDS TLS verify, deploy and rollback by digest.
- P7. OWNER-REQUIRED before any of the above: scoped AWS identity and spend ceiling (S-1 packet), budget alert address, teardown roles, Turnstile account, approval to create resources. Nothing here is approved by this review.

Before public launch, additionally: fix M1-M7 and B2 from section 2/3, close the accessibility Serious items and UI Criticals, enable lab booking only after HD-16 is signed and the flag-off, rate-limit and parallel-limit tests exist, finish the production TLS design (I3), reconcile the documents (section 9), publish privacy and terms (HD-06), and obtain the owner's DNS cutover approval with the rehearsed rollback.

---

## 12. Re-check log

As of this writing the latest commit is `fac5d49`; no fix for B1, B2, I1, I2, I3 or the majors has landed. Verdicts above stand until the E2E engineer and infra owner report commits; each will be re-read from the diff, not from the report.
