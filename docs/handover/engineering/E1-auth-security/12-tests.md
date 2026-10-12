# 12. Tests covering this volume

Nothing was executed for this volume (documentation task, no installs or builds); the tables list what the test files assert as written. Whether they pass at the base commit is not determined here.

## Unit tests (`src/**/*.test.ts`, no database)

| File | What it asserts |
|---|---|
| `src/server/auth/active-only-adapter.test.ts` | Active user passes through; inactive user yields null and the session row is deleted; no user lookup when there is no session; other adapter methods kept |
| `src/server/auth/dummy-hash.test.ts` | Valid 60 character cost-12 bcrypt hash; comparison does real work |
| `src/server/auth/guards.test.ts` | `requireSelf` rejects anonymous and other users, including staff; allows the owner; `getSessionUser` returns null when `auth()` throws under several `NODE_ENV` values; Next control-flow errors pass through |
| `src/server/auth/providers.test.ts` | Google off with nothing, half, blank; on with both; stub issuer override |
| `src/server/auth/roles.test.ts` | Test list covers every staff role in the enum; area matrix; super admin everywhere; null role nowhere |
| `src/server/auth/validation.test.ts` | 12 characters minimum, 72 bytes maximum counted in bytes; sign-in schema still accepts old long passwords |
| `src/server/security/client-ip.test.ts` | Default source by environment; spoofed `X-Forwarded-For` ignored in CloudFront mode; IPv6 and ports; no fallback when header missing |
| `src/server/security/edge-guard.test.ts` | Secret required, wrong secret of right length refused, health path open, development off; cross-origin and `null` writes refused; configured extras; no-Origin cross-site write refused; hosted production without secret refused including a lookalike host; origin normalisation |
| `src/server/security/turnstile.test.ts` | See file 08 |
| `src/server/email/send.test.ts` | `sendViaSes` request shape, configuration set, error propagation |
| `src/server/email/outbox.test.ts` | Back-off growth capped at 12 h; error description strips addresses and is bounded |
| `src/server/notifications/templates.test.ts` | Absolute links; identical status subject |
| `src/server/env.test.ts` | Complete production environment accepted; names not values in messages; database TLS rules; mail path; both Turnstile keys; site URL; origin secret and client source; https outside localhost; auth origin match; S3 key pair; `shouldCheckEnv` |
| `src/lib/safe-next.test.ts` | Accepts same-origin paths; rejects the malicious list; never returns other than single-slash path |
| `src/app/api/analytics/track/route.test.ts` | Limited and limiter-failure paths of the analytics route |

## Integration tests (`tests/integration`, real server, Postgres, stubs)

Helpers: `tests/support/helpers.ts` (`CAPTCHA`, `createUser`, `login`, `uniqueIp` to avoid sharing the per-address bucket, mail reading), `smtp-stub.ts` (mail capture), `turnstile-stub.ts`, `dev-pg.ts`/`pg.ts` (database), `s3-stub.ts`.

| File | Covers |
|---|---|
| `28-token-hygiene.test.ts` | Reset rollback when session delete fails; digest at rest; wrong token leaves real link usable; use-once under concurrency; verification token cannot reset a password; verification digest and single use |
| `30-auth-and-redirects.test.ts` | Open redirect list in a real browser; login timing unknown vs known e-mail; deactivated account cannot sign in; sign-up sets no cookie, link verifies once and sets cookie |
| `42-account-login-throttle.test.ts` | Per-account failure throttle, success not counted, unregistered same |
| `45-accounts-modules.test.ts:31-64` | Sign-up identical response for new and existing, no session, owner told by mail, weak password message identical. `:183-238` operator mail view |
| `25-account-deactivation.test.ts` | Deactivation kills existing session on next request; cannot sign in; reactivation does not resurrect; staff removed from `/admin` and Payload; role change revokes and audits; who may do it; self-change refused; strict input |
| `24-last-admin-concurrency.test.ts` | Concurrent cross-removal of super admins through both operations |
| `29-edge-controls.test.ts` | No-store on private paths; health endpoint; cross-origin write refusals including no-Origin cross-site; hardening headers |
| `46-google-enabled.test.ts` | Google button, provider listing, start redirect with PKCE and safe return path, hostile return path ignored, failed return message, disabled behaviour |
| `44-account-network-failure.test.ts` | Dropped requests on login, sign-up, reset request, resend and confirm are retryable and keep input |
| `33-event-notifications.test.ts` | Event notice and e-mail, idempotence, dashboard display |
| `31-public-pages.test.ts:109-117` | Contact-form limiter returns 429 after three |
| `01-server-action-boundary.test.ts` | Production Server Action transport exposes no internal services |
| `27-document-upload.test.ts:135` | Content mismatch refused and nothing stored |

## Not covered (as far as located)

| Gap | Note |
|---|---|
| `checkRateLimit` arithmetic (floor, refill cap, atomicity) | Only exercised through routes |
| `hasRateLimitCapacity` race | Parallel failed logins vs the 10 per hour account bucket |
| Outbox `attempt` success-then-failed-update, lease expiry, `processDue` skip-locked with two workers | No test |
| Outbox TTL versus reset link lifetime | No test (D-02) |
| Password reset request timing | Only login timing is tested |
| Unverified account password login | No test asserts either behaviour (D-01) |
| `file-verify.ts` unit behaviour (CFBF acceptance, ZIP lookalikes) | Integration only |
| `markNotificationRead` ownership | Not located |
| Real Turnstile, SES, CloudFront header forwarding | Stubs only; SECURITY-REVIEW lists them as not verifiable |
| Session sliding refresh and Auth.js CSRF behaviour | Library behaviour, not tested in repo |
| `revokeAllSessions` | Unused |
