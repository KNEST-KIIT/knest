# 13. Findings, limitations and stale documentation

Two lists. "D" items are defects or contradictions noticed while reading the code for this volume; each has a file and line and a suggested direction, and none has been fixed (documentation-only task). "L" items are limitations that are by design or by omission. Open items carried from `docs/delivery/SECURITY-REVIEW.md` are in the last section. Severity is the author's judgement from reading, not a tested exploit.

## Defects

| ID | Severity | Where | Finding | Suggested direction |
|---|---|---|---|---|
| D-01 | Medium | `src/server/auth/actions.ts:36`, `:66-76`, `:176-178` | Password sign-in does not require `email_verified`, and a reset does not set it. Sign-up creates the account with the typed password before any proof of mailbox control. Someone can register `victim@x` with a password they know; the victim then receives a genuine "confirm your email" mail (or an "account exists" mail), and if they confirm they get a session in an account whose password the registrant knows and can use at any time. Only password reset by the victim ends that, and only if the victim thinks to do it. SECURITY-REVIEW S-09 says that with the sign-up change "an unverified address can no longer hold a session"; that is true only of the sign-up response, not of `/api/auth/password/login` | Refuse password login while `email_verified IS NULL` (send the verification link instead), or clear `password_hash` when verification completes for an account that never signed in, or have verification force a password set |
| D-02 | Medium | `src/server/auth/actions.ts:114`, `:150`; `src/server/email/outbox.ts:20` | Reset mail is queued with the 24 hour default TTL but the reset link lives 1 hour. A reset message retried after the first hour, or resent by an operator from `/admin/mail`, contains a dead link. `sendEmail` accepts `{ ttlMs }`; nothing passes it | Pass `ttlMs: RESET_TTL_MS` (and `VERIFY_TTL_MS`) from `actions.ts` so the message expires with its link |
| D-03a | Low | `outbox.ts:39-43` | The `UPDATE ... status='sent'` is inside the same `try` as the send. If the send succeeds and the update fails, the catch records a failure and the message is sent again | Separate the send from the bookkeeping; treat a failed status update as sent |
| D-03b | Low | `outbox.ts:22`, `:148` | Lease is 2 minutes and no send timeout is set in `send.ts`; a send slower than the lease can be claimed twice | Add a send timeout below the lease, or a longer lease |
| D-04 | Low | `actions.ts:139-156`, `:100-117` | Reset request and verification send have identical responses but unequal work: an existing account does a token delete, insert, outbox insert and a provider call inside the request; an unknown address returns after one query. Only login has timing equalisation (KN-22a). Address existence can be inferred from latency | Do the work after the response (queue only), or add equalising work. The outbox already exists; `sendDurably` could skip the first in-request attempt for these callers |
| D-05a | Low | `login/route.ts:19-27`, `rate-limit.ts:83-94` | Account throttle is read-then-spend, not atomic; a parallel burst can pass the read together and exceed 10 guesses (bounded by 5 per address) | Spend first then refund on success, or reserve with the atomic function |
| D-05b | Low | `rate-limit.ts:17`, `login/route.ts:20` | By the constants, one request per 6 minutes keeps an account bucket under one token indefinitely, so the real owner is refused with the right password. The comment at `rate-limit.ts:15-17` says the limit is meant to keep lockout short | Accept and document, or exempt a recent successful sign-in device, or require the captcha path instead of refusing |
| D-06 | Low | `actions.ts:130-136`, `verify-confirm.tsx:80-90` | Confirming the link for an inactive account consumes the token, sets `email_verified`, creates no session, returns ok, and the page says "You're signed in" | Return a distinct result for inactive accounts |
| D-07 | Low | `tokens.ts:35-40` | `issueToken` deletes then inserts as two statements without a transaction; concurrent requests can leave two valid tokens, contradicting the comment that a new link invalidates the old | Wrap in a transaction, or use an upsert keyed on `identifier` |
| D-08 | Info | `src/server/auth/session.ts:73-75` | `revokeAllSessions` is documented as used when disabling an account or demoting staff but has no caller; `members/actions.ts` deletes sessions inline | Use it there (inside the transaction needs a client parameter) or remove it |
| D-09 | Info | `src/proxy.ts:10-12`, `edge-guard.ts:65-86` | A refusal returns bare 403 and logs nothing; the reason (`origin-verify` or `origin-mismatch`) is discarded, so a wrong secret or missing `ALLOWED_ORIGINS` entry is undiagnosable from logs | Log the reason and path (not header values) at warn level |
| D-10 | Info | `src/server/auth/session.ts:22`, `config.ts:26` | The 30 day lifetime is duplicated as two constants and the secure-cookie expression is duplicated at `session.ts:39-41` and `:51-52` | Share one constant and one helper |

## Limitations

| ID | Limitation |
|---|---|
| L-01 | If `CloudFront-Viewer-Address` is missing, all requests share the `unknown` address and thus one bucket per route (file 06, 07) |
| L-02 | A request that fails the captcha still spends the per-address token |
| L-03 | Shared campus addresses: limits are per address, successful sign-ins also spend `login:<ip>` |
| L-04 | Expired `sessions` rows and expired, never presented `verification_tokens` rows are not purged by any code located |
| L-05 | `users.email` uniqueness is case-sensitive at the database; lowercasing is applied only by `emailSchema`. Rows written by another path (Google profile, seed, manual SQL) with upper case would not match lowercased lookups. Not determined which paths can produce them |
| L-06 | No audit row or log line for sign-in, failed sign-in, sign-out, password reset or verification; `audit_logs.actor_user_id` is `NOT NULL` with `RESTRICT`, so unauthenticated events do not fit that table as designed |
| L-07 | Reset requests are limited per address only (5 per hour); there is no per-recipient limit as on verification send. Many addresses can mail one person, and each request replaces that person's outstanding reset token |
| L-08 | Session tokens are stored in clear (Auth.js adapter contract, S-10); raw e-mailed links also exist in `email_outbox.body` while pending and for dead rows up to seven days |
| L-09 | `rate_limits` rows are never purged |
| L-10 | Turnstile `action` and `hostname` from `siteverify` are not checked |
| L-11 | Development without a Turnstile secret accepts any request |
| L-12 | `email_outbox` `sent` rows (address, subject) kept indefinitely |
| L-13 | No bounce or complaint handling in application code |
| L-14 | Dead-row body retention counts from creation, not death |
| L-15 | Enum value `application_deadline_reminder` has no producer |
| L-16 | Google sign-in cannot attach to an existing password account (Auth.js default linking refusal; `allowDangerousEmailAccountLinking` unset). Auth.js behaviour not re-verified in `node_modules` |
| L-17 | Google start has no human check; only the address limit |
| L-18 | Staff have the same factors and 30 day session as members |
| L-19 | Payload shadow-row upsert failures are swallowed (`auth-strategy.ts:62-64`) |
| L-20 | CSP allows `'unsafe-inline'` scripts |

## Stale or inaccurate documentation

| Document | Statement | Reality at this commit |
|---|---|---|
| `SECURITY-REVIEW.md` S-09 | "returns a refusal for a registered address while a new one gets a session" (`actions.ts:63`) | Sign-up now answers 202 identically and sets no session; the review's own update paragraph says so. The squatting description is only partly resolved (D-01) |
| `SECURITY-REVIEW.md` S-05 | cost factor at `actions.ts:71`; reset delete at `actions.ts:169`; consume at `:160` | Now `actions.ts:66`, `:179`, `:174` |
| `SECURITY-REVIEW.md` S-03 | `env.ts:46` guard on mail transport | Now `env.ts:51-53` |
| `SECURITY-REVIEW.md` S-11 | rotation "with a short overlap if both are accepted" | `guardRequest` accepts exactly one secret value |
| `SECURITY-REVIEW.md` "no finding" table | session cookie flags at `session.ts:54` | `session.ts:53-59` |
| `src/server/auth/session.ts:72` | "used when disabling an account or demoting staff" | Not used (D-08) |
| `src/db/schema/notifications.ts` (header comment of `notifications`) | "Every write here is paired with an email" | Pairing is by convention; `writeNotification` alone writes no mail |
| `src/server/email/outbox.ts:69` | "Never throws once the row is stored" | A database error in the failure bookkeeping inside `attempt` would propagate |
| `docs/delivery/EMAIL-SETUP.md` | `sendEmail` no longer throws when SES rejects | True once the row is stored; it still throws when both the outbox insert and the direct send fail |

## Open items from SECURITY-REVIEW still relevant here

| ID | State at review | Note |
|---|---|---|
| S-01 CSP `unsafe-inline` | Open | `proxy.ts` could mint a nonce |
| S-09 | Open, accepted | See D-01 before accepting |
| S-10 session token in clear | Open | Staff lifetime shortening is a config-level change in `config.ts` |
| S-11 origin secret readable in distribution config | Open (ops) | |
| S-12 HSTS edge only | Open (documented) | |
| S-13 no second factor for staff | Open (decision) | |
| S-14 gate hash `!==` | Open (accept) | In `infra/cfn/edge.yaml`, outside this volume |

## Suggested order for a new owner

1. D-01 (account takeover path through unverified sign-in), then D-02 (reset mail correctness).
2. D-04 and L-07 together (enumeration and reset-link replacement), as one change to how these two endpoints queue mail.
3. D-05, then L-06 (decide where authentication events are recorded).
4. L-04 and L-09 and L-12 as one retention job.
5. D-03, D-06, D-07, D-08, D-09, D-10.
