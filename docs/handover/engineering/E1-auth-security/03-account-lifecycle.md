# 03. Account lifecycle: sign-up, log-in, verification, reset, deactivation

Files: `src/server/auth/actions.ts`, the eight route handlers under `src/app/api/auth/password/`, the forms under `src/app/(auth)/`.

## Routes

| Route (all POST, JSON) | File | Limits applied, in order | Captcha | Calls | Success body |
|---|---|---|---|---|---|
| `/api/auth/password/signup` | `signup/route.ts:6-20` | `signup:<ip>` 5 per hour | yes | `signUpWithPassword` | 202 `{ok:true}`, identical for new and existing address |
| `/api/auth/password/login` | `login/route.ts:7-31` | `login:<ip>` 5 per 15 min; then `loginAccount:<sha256(email)>` read-only capacity check; on failure, one token spent from that account bucket | yes (after the IP bucket) | `loginWithPassword` | 200 `{ok:true}` plus session cookie; 401 on failure |
| `/api/auth/password/logout` | `logout/route.ts:4-7` | none | no | `logout` | 200 `{ok:true}` |
| `/api/auth/password/verify/send` | `verify/send/route.ts:5-14` | `verifySend:<ip>` and `verifySend:<ip>:<email>`, 5 per hour each | no | `sendVerificationEmail` | 200 `{ok:true}` |
| `/api/auth/password/verify/confirm` | `verify/confirm/route.ts:5-12` | `tokenConfirm:<ip>` 20 per hour | no | `confirmEmailVerification` | 200 plus session cookie; 400 on bad or expired link |
| `/api/auth/password/reset/request` | `reset/request/route.ts:6-16` | `password-reset:<ip>` 5 per hour | yes | `requestPasswordReset` | 200 `{ok:true}` regardless of account |
| `/api/auth/password/reset/confirm` | `reset/confirm/route.ts:5-12` | `tokenConfirm:<ip>` 20 per hour | no | `resetPassword` | 200; 400 on bad link or weak password |
| `/api/auth/google/start` | see file 02 | `login:<ip>:google` 5 per 15 min | no | Auth.js `signIn` | 303 |
| `/api/auth/[...nextauth]` | `[...nextauth]/route.ts` | none from the app | n/a | Auth.js | Auth.js endpoints |

Rate-limit buckets and their arithmetic are in file 07; the human check in file 08. Cross-site POSTs are refused before any of this by `proxy.ts` (file 06).

`AuthResult = { ok: true } | { ok: false; error: string }` (`actions.ts:17`). Every function returns an `AuthResult`; routes translate `ok: false` to 400 (401 for login).

## Sign-up (`signUpWithPassword`, `actions.ts:59-94`)

Purpose: create an unverified account without revealing whether the address was already registered (KN-22b).

Sequence:

1. Parse with `signupSchema` (`validation.ts:22-26`). On failure return the first Zod issue message (`actions.ts:60-63`). The message is the same for any address, so it leaks nothing about registration.
2. `next = safeNext(input.next)` (`actions.ts:64`). Used only for the verification link.
3. `hash(password, 12)` with bcryptjs (`:66`). This happens before the database lookup so both outcomes cost the same CPU.
4. `INSERT INTO users (email, name, password_hash, platform_role='student') ON CONFLICT (email) DO NOTHING RETURNING id, email` (`:67-76`). The insert is the existence test, so two concurrent sign-ups for one address produce exactly one account and one "exists" branch.
5. Row not returned (address exists): send `accountExistsTemplate(login link, reset link)` through `sendEmail`, catching and logging failure; return `{ok:true}` (`:78-84`). Nothing about the existing account changes.
6. Row returned: `track('signup', undefined, { userId })` (analytics event, `:86`), then `sendVerificationEmail(created.email, next)` with failures caught and logged because the account exists and the person can request the link again from `/verify` (`:87-91`). Return `{ok:true}`.

No session is created on either branch. A session on one branch only would itself reveal which branch ran. The person gets their first session by opening the e-mailed link (`confirmEmailVerification`). `signup-form.tsx:56` then sends the browser to `/verify?sent=1&email=...`, which shows the typed address without claiming an account exists (`verify/page.tsx:17-21`).

Role: always `student`. Staff roles are granted only by `setStaffRole` (`members/actions.ts:76-106`).

Known edge: signing up with an address that already has an unverified account registered by someone else yields "account exists" mail to the real mailbox owner and the squatter's password stays in place. See file 13, D-01.

## Log-in (`loginWithPassword`, `actions.ts:24-42`)

1. Route-level: IP bucket, Turnstile, per-account capacity check (file 07).
2. `credentialsSchema.safeParse(body)`; failure returns "Enter your email and password." (`:25-26`). Password max 200 characters here so an account created under an older, longer limit still signs in (`validation.ts:19`, test `validation.test.ts:18`).
3. `SELECT * FROM users WHERE email = $1`.
4. `compare(password, user?.passwordHash ?? DUMMY_HASH)` always runs (`:34`). `DUMMY_HASH` is a valid cost-12 bcrypt string (file 04). Without it an unknown e-mail returned about 700 ms faster than a known one (`dummy-hash.ts:3-7`).
5. Fail if no user, no `password_hash`, mismatch, or `is_active = false`: one message, "That email and password don't match." (`:36-38`). A deactivated account is indistinguishable from a wrong password.
6. `createDatabaseSession(user.id)` (`:40`).

What is not checked: `email_verified`. An unverified account can sign in with its password. Only specific actions require verification (application submit, lab booking). See D-01.

Failure accounting (route, `login/route.ts:15-29`): the per-account bucket key is `loginAccount:` plus SHA-256 hex of the lower-cased, trimmed e-mail, computed whether or not the account exists, so the 429 behaves the same for unregistered addresses (test `42-account-login-throttle.test.ts:41`). A successful login never spends a token from the account bucket. A request body without a string `email` gets no account key and only the IP limit.

Side effects not present: no audit row, no `last_login` column, no notification of a new sign-in.

## E-mail verification

### Request (`sendVerificationEmail`, `actions.ts:100-117`)

1. `emailSchema` check; failure returns "That doesn't look like an email address." (a 400, so malformed input is distinguishable, valid-but-unknown is not).
2. Lookup. If no user or already verified: return `{ok:true}` with no mail (`:108`). The endpoint is reachable signed-out, so it must not become an account oracle.
3. `issueToken('verify-email', email, 24h)`.
4. Link: `${siteUrl()}/verify/confirm?email=<enc>&token=<hex>[&next=<enc>]` (`:112`).
5. `sendEmail(...)` is awaited and not caught here; the sign-up caller catches it, the `/verify/send` route does not. Because `sendEmail` goes through the durable outbox, it throws only if both the outbox write and the direct send fail (file 09).

### Confirm (`confirmEmailVerification`, `actions.ts:119-137`)

Browser path: the link opens `/verify/confirm` (`verify/confirm/page.tsx`), a page that validates `next` with `safeNext` and renders a client component; the component POSTs `{email, token}` to the confirm route on mount (`verify-confirm.tsx:10-28`). A GET to the link therefore consumes nothing, so link-preview bots and mail scanners that only fetch the URL do not burn the token.

Server sequence in one transaction (`actions.ts:123-131`):

1. `consumeToken('verify-email', email, token, tx)`; false returns `null`.
2. `UPDATE users SET email_verified = now(), updated_at = now() WHERE email = $1 RETURNING id, is_active`.
3. Returns the user id if active, `''` if inactive, `null` if token invalid.

After commit: `null` gives 400 "That link has expired. Request a new one."; a non-empty id mints a session (`:135`). An inactive account gets `{ok:true}` and no session; the page then says "Email confirmed. You're signed in." which is untrue for that case (file 13, D-06).

Client states (`verify-confirm.tsx:20`): HTTP 5xx or a network failure shows a retryable "We couldn't confirm your email" with a Try again button, because the link may still be good; 4xx shows "That link has expired". Covered by `44-account-network-failure.test.ts:160`. In development with React Strict Mode the effect runs twice and the second POST would fail on the consumed token; production builds do not double-invoke effects (reasoned from React behaviour, not tested here).

Continue link: `next` starting with `/onboarding` goes there; any other safe path rides as onboarding's own `next` (`verify-confirm.tsx:32-36`).

## Password reset

### Request (`requestPasswordReset`, `actions.ts:139-156`)

1. Schema check.
2. Lookup. Only when the user exists and has `password_hash` is anything done (`:146`): `issueToken('reset-password', email, 1h)`, link `${siteUrl()}/reset/confirm?email=...&token=...`, `sendEmail` with failure caught and logged.
3. Always `{ok:true}`.

Google-only accounts therefore receive nothing, silently.

### Confirm (`resetPassword`, `actions.ts:158-185`)

1. Validate e-mail and token presence; validate the new password with `passwordSchema` (12 to 200 characters and at most 72 bytes).
2. `hash(newPassword, 12)` outside the transaction (long-running CPU work does not hold a transaction open).
3. Transaction (`:173-181`): `consumeToken('reset-password', ...)`; `UPDATE users SET password_hash, updated_at ... RETURNING id`; `DELETE FROM sessions WHERE user_id = ...`. If any statement throws, all roll back and the token remains valid (test `28-token-hygiene.test.ts:51` injects a trigger failure on `sessions` delete and asserts a 500, an unchanged hash and an intact token).
4. Result: `{ok:true}`, no session created; the form sends the browser to `/login` (`reset-confirm-form.tsx:36`).

All sessions of the account end, including the attacker's if the account had been taken. `email_verified` is not set by a reset even though the person proved control of the mailbox (D-01).

Reset does not check `is_active`; an inactive account can change its password but still cannot sign in.

## Log-out

See file 02. No audit row.

## Deactivation and staff-role change (callers of this subsystem)

Implemented in `src/server/members/actions.ts`, invoked by `POST /api/admin/members/[id]/active` and `.../staff-role`, both behind `limitByUser('staffAction')`.

| Function | Authority | Steps (single transaction) | Audit row |
|---|---|---|---|
| `setMemberActive(userId, isActive)` (`:34-66`) | `requireStaffOrThrow('users')`, which only super_admin passes | advisory lock; re-read actor is still active super_admin; refuse self; refuse deactivating the last active super admin; update `is_active`; on deactivate delete sessions | `account_deactivated` or `account_reactivated`, before `{isActive}`, after `{isActive}` |
| `setStaffRole(userId, role)` (`:76-106`) | same | advisory lock; same actor re-check; refuse self; no-op if unchanged; refuse demoting the last active super admin; update `staff_role`; delete sessions | `staff_role_changed`, before/after `{staffRole}` |

Why the advisory lock and the in-transaction actor re-check: two super admins demoting each other concurrently would each see the other as "another active super admin" and both succeed, leaving none. Both functions take the same lock key (`knest:staff-membership`) and read the counts after acquiring it. Test: `24-last-admin-concurrency.test.ts`.

The deletion in `setStaffRole` is unconditional: it also runs on promotion and on assigning a role to someone who had none. The code comment gives demotion as the reason (`members/actions.ts:71-74`); roles are read from the database per request anyway (file 02), so the deletion is belt and braces and forces the person to sign in again.

## Front-end behaviour that matters to the contract

| Behaviour | File:line |
|---|---|
| Submit disabled until the Turnstile token exists when a site key is configured | `login-form.tsx:19`, `signup-form.tsx:20`, `reset-form.tsx:16` |
| Token is single-use; a failed submit bumps a reset counter to get a new challenge | `turnstile-widget.tsx:37-39`, `:81-83` |
| Post-login redirect uses `safeNext(searchParams.get('next'))`, default `/dashboard`, then `router.refresh()` | `login-form.tsx:34`, `:58-59` |
| Password inputs have `autoComplete` `current-password` / `new-password`, so password managers work | `login-form.tsx:110`, `signup-form.tsx:119`, `reset-confirm-form.tsx:48` |
| Reset form `minLength={12}` mirrors the server rule | `reset-confirm-form.tsx:48` |
| `Cache-Control: private, no-store` on `/login`, `/signup`, `/verify/*`, `/reset/*` | `next.config.ts:44-58` |

## Concurrency and ordering summary

| Scenario | Outcome | Mechanism |
|---|---|---|
| Two sign-ups, same address, same instant | One account; the other gets the exists mail | `ON CONFLICT DO NOTHING` |
| Reset link used twice at once | One 200, one 400; the winner's password is the live one | token `DELETE ... RETURNING` (test `28:93`) |
| Verification link used twice at once | One 200, one 400 | same (test `28:123`) |
| New reset requested while an older link is outstanding | Old link dies (delete then insert) | `issueToken`; not transactional, see D-07 |
| Deactivation while the user is mid-request | Next session read deletes the row and returns signed-out | adapter wrapper |

## Error handling

Routes parse the body with `request.json().catch(() => null)`, so malformed JSON becomes a validation failure rather than a 500 (every route). Unexpected exceptions inside `actions.ts` (database errors) are not caught; they surface as Next's generic 500. The reset route returning 500 on a transactional failure is intended and tested.
