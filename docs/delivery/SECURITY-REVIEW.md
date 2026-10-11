# Security review against OWASP ASVS 4.0 level 2

Date: 2026-10-12. Base: `codex/production-v1` at `b5ca498`, plus the fixes on branch
`agent/hardening`. Reviewer: HARDENING agent (code reading, one tool run: `pnpm audit`).

Scope: authentication (V2), session management (V3), access control (V4), input validation (V5),
cryptography and secrets (V6, V9), error handling and logging (V7), data protection (V8), files
(V12), API and CSRF (V13), configuration and headers (V14). Out of scope: the AWS account itself,
penetration testing, real Turnstile, real SES, real S3. This is a code review, not a pen test, and
nothing here is verified against production.

State of a finding: FIXED means fixed on this branch with a test; OPEN means a recommendation with
an owner.

## Summary

| ID | Severity | Area | Finding | State |
|---|---|---|---|---|
| S-01 | Medium | V14 CSP | Script and style policy allow `'unsafe-inline'` | OPEN (design change) |
| S-02 | Low | V13 CSRF | A write with no Origin header was admitted | FIXED |
| S-03 | Low | V7 logging | Mail bodies (reset and verification links) were logged when no transport is set | FIXED |
| S-04 | Low | V7 audit | Staff opening an applicant's document left no trace | FIXED |
| S-05 | Low | V2 passwords | bcrypt silently truncates beyond 72 bytes; the form allowed 200 | FIXED |
| S-06 | Low | V12 files | Object key kept up to 10 characters of the client's extension | FIXED |
| S-07 | Low | V14 headers | No Permissions-Policy or COOP | FIXED |
| S-08 | Medium | V13 availability | Public CMS read API has no per-client rate limit and no `maxDepth` | OPEN (CONTENT) |
| S-09 | Low | V2 | Signup success versus refusal reveals whether an address is registered | OPEN (accepted risk, mitigated) |
| S-10 | Low | V3 | Session token stored in clear in `sessions` | OPEN (Auth.js design) |
| S-11 | Low | V14 infra | Origin-verify secret is visible in the CloudFront distribution config | OPEN (ops) |
| S-12 | Info | V14 headers | HSTS exists only at CloudFront; origin does not send it | OPEN (documented) |
| S-13 | Low | V2 | No second factor for staff and administrators | OPEN (decision) |
| S-14 | Low | V2 | Edge access gate compares hash with non-constant-time `!==` | OPEN (accept) |
| S-15 | Low | V13 | QR attendance: unsigned client clock decides the effective scan time | OPEN (ATTENDANCE, unmerged branch) |

Other branches were read for security-relevant changes where they touch shared code: `agent/content`
(calendar file route: text escaped, folded, slug-derived filename, published events only; search
query logging now drops text that looks personal) and `agent/labs` (department administration
route). No finding from those two. No Critical or High finding. Nothing found that lets an anonymous or student account read another
person's data, change a role, or read an applicant document.

## Findings

### S-01 CSP allows inline script and style (Medium, OPEN)

Evidence: `next.config.ts:19` `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`,
`next.config.ts:22` `style-src 'self' 'unsafe-inline'`. The header comment records why: the policy
is a static `headers()` export with no per-request nonce, and the Payload admin and Next hydration
need inline script.

Impact: the policy does not stop an injected inline script, so it is not a second line of defence
against XSS. The first line is sound: no `dangerouslySetInnerHTML` anywhere in `src`, React escapes
output, and `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors
'none'` are in force and tested (`tests/integration/29-edge-controls.test.ts`).

Fix (design change, not done here): `src/proxy.ts` already runs on every request, so it can mint a
nonce, set `script-src 'nonce-...' 'strict-dynamic'` and pass the nonce to the root layout. Keep
the admin on the current policy at first (`/admin` and `/api`), tighten public pages, measure with
`Content-Security-Policy-Report-Only` for a full cycle (the `V2-FULL-RELEASE-PLAN` module 41 item).
`style-src 'unsafe-inline'` is a smaller risk and can stay. Needs a real browser pass, so it is not
a safe change without one.

### S-02 Cross-site write with no Origin header (Low, FIXED)

Evidence: before, `src/server/security/edge-guard.ts:78` refused a write only when an Origin header
was present and not allowed. A browser that omits Origin was admitted, leaving `SameSite=Lax` as
the only protection.

Fix: `edge-guard.ts:85` also refuses an unsafe-method request that has no Origin and
`Sec-Fetch-Site: cross-site`. Safe methods are never checked, so OAuth callbacks and links from
e-mail (cross-site top-level GET) are unaffected. Tests: `edge-guard.test.ts` and
`tests/integration/29-edge-controls.test.ts`.

KN-22g (CSRF on every state-changing route) assessment: the check runs in `src/proxy.ts` with a
matcher of `/:path*`, so it covers every route handler, every Auth.js route and the Payload
REST API (`/api/*` write methods), not a per-route opt-in. A request with neither header comes
from a non-browser client and still needs a valid session cookie. Server Actions carry Next's own
Origin comparison. Residual: a same-site attacker (a hostile subdomain) is not stopped by the
Origin check; the production domain should not host untrusted subdomains.

### S-03 Mail bodies in logs (Low, FIXED)

Evidence: `src/server/email/send.ts` printed `To`, `Subject` and the full text, including the
one-time reset or verification link, when no transport was configured. In a hosted environment
that is CloudWatch.

Fix: the log branch now throws in `NODE_ENV=production`. `src/server/env.ts:46` already refuses to
boot a hosted production without `SMTP_HOST` or `EMAIL_TRANSPORT=ses`, so this is a second guard.
Development and test behaviour is unchanged (the test mail stub still reads the log).

### S-04 Document access not recorded (Low, FIXED)

Evidence: `src/app/api/admin/applications/[id]/documents/[questionId]/route.ts` returned an
applicant's file after a staff check with no audit row (ASVS 7.1, 8.3).

Fix: an `application_document_viewed` row (actor, application, question, document id) is written
before the file is returned. Test: `tests/integration/27-document-upload.test.ts`. The audit page
lists the new action automatically (the filter is built from distinct actions).

### S-05 Password longer than 72 bytes (Low, FIXED)

Evidence: `src/server/auth/validation.ts` allowed 200 characters; `bcryptjs` reads 72 bytes.
Two different 100-character passwords with the same first 72 bytes were the same password.

Fix: signup and reset (`passwordSchema`) now require 72 bytes or fewer; sign-in
(`credentialsSchema`) still accepts up to 200 so an existing account is never locked out.
Test: `src/server/auth/validation.test.ts`. Cost factor 12 (`actions.ts:71`) is appropriate.

### S-06 Client extension in object key (Low, FIXED)

Evidence: `src/server/storage/index.ts` `generateStorageKey` used `path.extname(name).slice(0,10)`.
The content is sniffed (`file-verify.ts`) and the key is otherwise random, so impact was small, but
a client-chosen string reached the key.

Fix: keep only `^\.[a-z0-9]{1,8}$`, lower-cased, otherwise none. Test:
`src/server/storage/storage-key.test.ts`.

### S-07 Permissions-Policy and COOP (Low, FIXED)

`next.config.ts` now sends `Permissions-Policy: camera=(self), microphone=(), geolocation=(),
payment=(), usb=()` (camera is needed by the lab check-in scanner, agreed with ATTENDANCE) and
`Cross-Origin-Opener-Policy: same-origin`. `worker-src 'self'` and `manifest-src 'self'` were added
for the check-in PWA and `/sw.js` is `no-cache`. Test: header assertions in
`tests/integration/29-edge-controls.test.ts`.

### S-08 Public CMS REST read has no limiter and no `maxDepth` (Medium, OPEN)

Evidence: `src/app/(payload)/api/[...slug]/route.ts` exposes Payload REST. Public collections use
`readPublished` or `readAlways`, which is correct, but `src/payload/payload.config.ts` sets no
`maxDepth` or `defaultMaxTextLength`, and no rate limit applies to `/api/<collection>` reads
(`RATE_LIMITS` covers only our own routes). An anonymous client can request deep relation joins
and large pages repeatedly. CloudFront does not cache dynamic paths (`CachingDisabled`,
`infra/cfn/edge.yaml`) and the WAF is the only limiter.

GraphQL is not exposed: only the REST handlers are mounted. Versions endpoints answer only to a
signed-in user (Payload's `executeAccess` with no `readVersions` function).

Recommendation (owner CONTENT, needs a test with the admin UI): set `maxDepth: 2` in the Payload
config and a `limit` ceiling; add a WAF rate-based rule on `/api/*` GET at the edge (IAC owner).

### S-09 Account enumeration on signup (Low, OPEN, accepted)

Evidence: `src/server/auth/actions.ts:63` returns a refusal for a registered address while a new
one gets a session. Sign-in and reset are uniform (dummy bcrypt, same message, same response).
Signup is limited to 5 per hour per address and needs Turnstile, which bounds scraping. Fully
removing the signal needs verify-first signup, which the product decision (USER_JOURNEYS Journey 1)
rejects. Recommend leaving as is.

Update from `agent/accounts` (reported by that agent, not reviewed in code by this pass, not
merged): signup returns an identical 202 for new and existing addresses and sets no session; the
e-mail verification confirm step issues the session. If that lands, this finding closes and the
squatting scenario below goes away (an unverified address can no longer hold a session).

Related: an unverified signup under someone else's address creates an account the real owner
cannot register. Password reset by the real owner still works and deletes every session of the
account (`actions.ts:169`), so the squatter loses access. Submitting an application requires a
verified address.

### S-10 Session token stored in clear (Low, OPEN)

Evidence: `src/db/schema/users.ts:115` `session_token` is the primary key and is the cookie value
(Auth.js adapter contract). A read-only copy of the database (backup, SQL injection) yields live
sessions for up to 30 days (`auth/config.ts:28`). Tokens in the e-mailed links are hashed
(`tokens.ts`), sessions are not. Mitigation: database snapshots are encrypted and access is
restricted; sessions can all be revoked with one delete. Recommend leaving, and shortening
`maxAge` for staff accounts if the owner wants (a staff session of 8 hours with sliding renewal).

### S-11 Origin-verify secret in the distribution config (Low, OPEN)

Evidence: `infra/cfn/edge.yaml:225` `HeaderValue: {{resolve:secretsmanager:...}}`. CloudFormation
writes the resolved value into the distribution's origin custom headers, readable by any principal
with `cloudfront:GetDistributionConfig`. Anyone with that permission can bypass CloudFront, so
that permission is as sensitive as the secret. Operator action: keep that action off every role
except the infrastructure operator, and document rotation (change the secret, update the stack,
redeploy the app, in that order, with a short overlap if both are accepted).

### S-12 HSTS is edge-only (Info)

`infra/cfn/edge.yaml:175` sets HSTS max-age one year, no subdomains, no preload; the app sends the
rest (`next.config.ts`). The CloudFront policy has only HSTS, so no header is duplicated or
overridden. A request that reaches the origin directly is refused without the secret, so there is
no unprotected path. Preload and `includeSubDomains` are deliberately off until every subdomain
is known to be HTTPS. Header set by the app and not by CloudFront: CSP, nosniff, X-Frame-Options,
Referrer-Policy, Permissions-Policy, COOP, `Cache-Control: private, no-store` on private paths.
Header set by CloudFront and not by the app: HSTS only.

### S-13 No second factor for staff (Low, OPEN, decision)

ASVS 2.8 and 2.2.x at level 2 expect a second factor for privileged accounts. Staff sign in with
the same password as students. Compensations present: Turnstile, per-address and per-account
throttles, instant revocation, an audit trail. Recommend Google sign-in restricted to the
institutional domain for staff, or TOTP; this is a product decision with cost, not a code defect.

### S-14 Gate hash comparison (Low, OPEN, accept)

`infra/cfn/edge.yaml:167` compares a SHA-256 digest of the supplied credentials with `!==`. The
timing signal reveals a prefix of a hash of an unknown preimage, which is not exploitable. The gate
is a temporary pre-launch control. Accept.

### S-15 QR attendance: scan time chosen by the scanner (Low, OPEN, branch `agent/attendance`, not merged)

Read from `origin/agent/attendance` (`src/lib/lab-qr/decide.ts`, `src/server/labs/attendance-qr.ts`),
read-only, no tests run by this review. The protocol is carefully built: domain-separated
signatures, strict payload shapes, device key bound to the submitting session, non-extractable
private keys, revocation handled, a per-person limit and a 404 while the flag is off.

One weakness: `clientNowMs` is unsigned and chosen by the submitter, and `event.at` is signed only
by the same submitter. `effectiveAtMs = event.at - (clientNowMs - serverNowMs)`, so a scanner that
sets `clientNowMs = event.at + small` lands near server time, which skips the clock-skew,
late-sync and future-dated review triggers and lets it pick the time against which the pass step
is checked. Impact is limited because a verified check needs both sides inside `PAIR_WINDOW_MS`
and the staff side is a live pass from a key-bound device; the student side could replay a
photographed old desk code. Fix (owner ATTENDANCE, told directly): sign `clientNowMs` inside the
scan payload and reject `at > clientNowMs + 5 s`; apply skew correction only to events flagged
offline in the signed payload. Mark closed when that lands with a test.

## Areas reviewed with no finding

| ASVS area | Evidence |
|---|---|
| Session cookie flags | `session.ts:54` HttpOnly, SameSite=Lax, Path=/, Secure when `AUTH_URL` is https (production env check requires https and an `AUTH_URL` on the site origin, `env.ts:62`); `__Secure-` prefix name; 30 day expiry; random 256-bit token; logout deletes the row (`session.ts` destroy) |
| Session revocation | Deactivation and role change delete sessions; reset deletes sessions; adapter refuses inactive users (`active-only-adapter.ts`); role read from the database per request (`auth/config.ts` session callback) |
| Session secret exposure | Session callback returns an explicit object, not the adapter session, so `/api/auth/session` never publishes the token (`config.ts` comment and code) |
| Credential recovery | Single-use hashed tokens, purpose bound, 1 hour reset, 24 hour verify, transactional consume (`tokens.ts`, `actions.ts:160`) |
| Login | Constant-time compare with dummy hash, uniform message, inactive accounts same message, Turnstile, per-address (5 per 15 min) and per-account failed-attempt throttles |
| Open redirect | `safeNext` rejects `//`, backslash, control characters and cross-origin results (`lib/safe-next.ts`, unit-tested) |
| Access control | Server-side guards as first statement (`guards.ts`); staff 404 not 403; area permissions in `roles.ts`; Payload write access by area (`payload/access.ts`) and `staff` collection read-only with `unlock: () => false` |
| IDOR | Application and booking routes derive authority from the session; document download requires staff plus non-draft |
| Rate limits | Postgres token bucket, named constants (`rate-limit.ts`), client address from `CloudFront-Viewer-Address` only in production (`client-ip.ts`), origin-verify secret required in hosted production |
| Uploads | Allow-list of types, magic-number sniffing (`file-verify.ts`), 10 MB checked before buffering, random key, `attachment` and `nosniff` on download, CMS media raster-only |
| CSV export | Formula-leading cells neutralised (`labs/reports.ts:115`) |
| Error responses | Route handlers return fixed messages; unexpected errors are rethrown to Next, which returns a generic 500; health endpoint returns `ok` or `unavailable` only; the `error.log` file in the repo root is untracked |
| Config | Production env validated at boot, fail closed, names only (`instrumentation.ts`, `env.ts`); TLS to the database verified in hosted production |
| Dependencies | See `DEPENDENCY-TRIAGE.md`; `pnpm audit --prod --audit-level=moderate` is a CI gate |

## Not verifiable from the code

- That CloudFront, WAF and the origin are wired as `infra/cfn/edge.yaml` describes (needs the
  deployed stack and the header test in `infra/verify`).
- That `CloudFront-Viewer-Address` arrives on every request (the managed origin request policy in
  the template forwards it; confirm on the deployed distribution).
- Real Turnstile, SES and S3 behaviour; the integration suite uses stubs.
- Penetration test (V2-FULL-RELEASE-PLAN module 43 and gate P6).

## Open items for others

| To | Item |
|---|---|
| CONTENT | S-08: `maxDepth` and limit ceiling on the Payload config, with an admin UI check |
| ATTENDANCE | S-15: sign the client clock in the scan payload; bound skew correction to offline events |
| Infrastructure owner | S-08 WAF rate rule on `/api/*`; S-11 restrict `cloudfront:GetDistributionConfig` and write the rotation step |
| Lead and owner | S-01 nonce-based CSP as a measured change; S-13 staff second factor decision |
