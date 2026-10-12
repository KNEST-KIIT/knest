# 07. Rate limiting

Files: `src/server/security/rate-limit.ts`, `route-limits.ts`, `client-ip.ts`; table `app.rate_limits`.

## Design

A Postgres-backed token bucket, one atomic statement per check, no Redis (plan section 4.1: not needed at this scale; `rate-limit.ts:47-55`). Limits are shared across every application instance because the state is in the database, and survive restarts.

### Public interface

| Symbol | Line | Signature | Behaviour |
|---|---|---|---|
| `RATE_LIMITS` | `:13-45` | `const` record of `{ capacity: number; refillIntervalSeconds: number }` | One named constant per limited route |
| `checkRateLimit` | `:56-76` | `(key: string, config) => Promise<boolean>` | Spend one token; true if allowed |
| `hasRateLimitCapacity` | `:83-94` | `(key, config) => Promise<boolean>` | True if at least one token is available; spends nothing |
| `clientIp` | `:97-99` | `(request: Request) => string` | Address per `client-ip.ts` using `process.env` |
| `RateLimitError`, `enforceRateLimit` | `:101-112` | `(key, config) => Promise<void>` | Throws instead of returning false |
| `limitByIp` | `route-limits.ts:10-13` | `(request, name, extraKey = '') => Promise<NextResponse \| null>` | Key `<name>:<ip>[:<extraKey>]`; 429 JSON `{error:'Too many requests. Wait a moment and try again.'}` or null |
| `limitByUser` | `route-limits.ts:19-24` | `(name) => Promise<NextResponse \| null>` | Key `<name>:<userId>`; no session means no limit applied (null) |

### Algorithm (`checkRateLimit`)

Parameters: `capacity` C, `refillIntervalSeconds` T; `refillPerSecond = C / T` (`:57`). `T` is the time a fully drained bucket takes to refill, not a requests-per-second rate.

```
INSERT INTO app.rate_limits (key, tokens, updated_at) VALUES (key, C - 1, now())
ON CONFLICT (key) DO UPDATE SET
  tokens = GREATEST(-1, LEAST(C, tokens + elapsed_seconds * C/T) - 1),
  updated_at = now()
RETURNING tokens
allowed = tokens >= 0
```

Properties:

- A new key starts full and the first request spends one token (inserted as `C - 1`).
- Refill is continuous and capped at `C`.
- The floor is `-1`: a burst of already-rejected requests does not push the debt, and so the recovery time, beyond one rejected attempt (`:51-54`). Because every rejected check still writes, `updated_at` advances on each; with the floor in place that does not push recovery out.
- Exactly `C` requests pass in an instantaneous burst; request `C + 1` is refused.
- Atomic per key: Postgres serialises concurrent upserts on the same primary key, so two simultaneous requests cannot both spend the same token.
- Uses the database `now()` so application clock skew between instances does not matter. Within a single autocommit statement `now()` is the statement's transaction start.

`hasRateLimitCapacity` is a plain `SELECT` with the same refill expression and no write. A missing row means a full bucket (`:93`). It is a read that is separate from the later spend, so the pair is check-then-act, not atomic (D-05).

### Recovery arithmetic

One token returns every `T / C` seconds. After a bucket is drained to 0 a caller needs one token back; from the floor of -1 a caller needs two.

| Limit | C per T | One token every | Used for |
|---|---|---|---|
| `login` | 5 per 15 min | 3 min | per address, password and Google start |
| `loginAccount` | 10 per 60 min | 6 min | failed attempts per account |
| `signup` | 5 per 60 min | 12 min | per address |
| `passwordResetRequest` | 5 per 60 min | 12 min | per address |
| `verifySend` | 5 per 60 min | 12 min | per address and per (address, e-mail) |
| `tokenConfirm` | 20 per 60 min | 3 min | verify and reset confirm per address |
| `enquirySubmit` | 3 per 60 min | 20 min | contact form |

## Route catalogue

Keys are literal prefixes; `<ip>` is `clientIp(request)`.

| Route or function | Key | Limit | Response when limited | File:line |
|---|---|---|---|---|
| `POST /api/auth/password/login` | `login:<ip>` | `login` | 429 "Too many attempts. Try again later." | `login/route.ts:8-9` |
| same | `loginAccount:<sha256(email)>` (read, then spend on failure) | `loginAccount` | 429, same body | `login/route.ts:19-22`, `:27` |
| `POST /api/auth/google/start` | `login:<ip>:google` | `login` | 303 `/login?error=TooManyAttempts` | `google/start/route.ts:18-20` |
| `POST /api/auth/password/signup` | `signup:<ip>` | `signup` | 429 | `signup/route.ts:7-9` |
| `POST /api/auth/password/reset/request` | `password-reset:<ip>` | `passwordResetRequest` | 429 | `reset/request/route.ts:7-9` |
| `POST /api/auth/password/reset/confirm` | `tokenConfirm:<ip>` | `tokenConfirm` | 429 | `reset/confirm/route.ts:6-7` |
| `POST /api/auth/password/verify/confirm` | `tokenConfirm:<ip>` | `tokenConfirm` | 429 | `verify/confirm/route.ts:6-7` |
| `POST /api/auth/password/verify/send` | `verifySend:<ip>`, then `verifySend:<ip>:<email>` | `verifySend` | 429 | `verify/send/route.ts:9` |
| `POST /api/enquiries` | `enquiry:<ip>` | `enquirySubmit` | 429 | `enquiries/route.ts:8-10` |
| `POST /api/analytics/track` | `analytics:<ip>` | `analyticsTrack` | 204 (drops the event); also 204 if the limiter itself fails | `analytics/track/route.ts:27-34` |
| Application start | `application-start:<userId>` (only when no application exists yet) | `applicationStart` | `RateLimitError` mapped by route | `applications/actions.ts:60-68` |
| Document upload | `file-upload:<userId>` | `fileUpload` | `RateLimitError` mapped by route | `applications/actions.ts:160` |
| Staff mutations (members, applications status, enquiries, mail resend, document view) | `staffAction:<userId>` | `staffAction` | 429 | e.g. `admin/mail/[id]/resend/route.ts:8` |
| Answer save, onboarding step, event register, notification read, lab request, lab actions, availability, QR scan | `<name>:<userId>` | named constants in `RATE_LIMITS` | 429 | `limitByUser` call sites |

Other constants: `answerSave` 600/h, `onboardingStep` 120/h, `eventRegister` 60/h, `notificationRead` 300/h, `labRequest` 20/h, `staffAction` 600/h, `labAction` 120/h, `labAvailability` 240/h, `labScan` 600/h, `analyticsTrack` 60 per 10 min, `applicationStart` 10/h, `fileUpload` 20/h (`rate-limit.ts:13-45`).

## Why the login path has three layers

1. Per address (`login`, 5 per 15 min): slows one source.
2. Per account on failures only (`loginAccount`, 10 per hour): stops a guess spread over many addresses. Looser than the address limit so a stranger cannot lock a person out for long (`rate-limit.ts:15-16`). Keyed on a hash of the e-mail whether or not the account exists, so the 429 is identical for unregistered addresses and cannot be used to enumerate (test `42:41`). Successful sign-ins never spend from it (`42:33`).
3. Turnstile (file 08).

Order inside the route (`login/route.ts`): IP bucket first (spent on every request, including ones that later fail the captcha), then body parse and captcha, then the read-only account check, then bcrypt, then spend on failure. Cheap refusals come before the expensive bcrypt (about 700 ms per comparison per the comment in `dummy-hash.ts:5-6`).

Steady state under attack for one account: 10 failed guesses per hour. Once drained, further requests are refused before bcrypt runs, and refused requests do not spend more (they return at `:20-22` before the spend at `:27`).

## Failure modes and limits

| ID | Observation | Consequence |
|---|---|---|
| D-05a | Account-bucket check and spend are separate statements | A parallel burst can pass the read together and each run bcrypt before any spend lands, so a burst can exceed 10 guesses. Each source is still bounded by the per-address bucket, so the excess is bounded by (number of addresses) times 5 |
| D-05b | One attacker making a single wrong guess every 6 minutes keeps the account bucket below 1 token | The real owner is refused (429) even with the correct password, indefinitely. The design comment accepts a lockout "for long" is avoided; by the constants it is not avoided for a persistent attacker. A successful sign-in does not reset the bucket |
| L-01 | `unknown` client address shares one bucket per route | See file 06 |
| L-02 | A rejected captcha still spends the per-address token | Someone behind the same NAT can use up the shared address bucket |
| L-03 | Campus NAT | One address, many people; 5 sign-ins per 15 minutes per address. Successful sign-ins spend this bucket too (`login/route.ts:8` runs before authentication), so ordinary use from a shared address can trip it. Not measured |
| L-09 | No purge of `rate_limits` | One row per distinct key ever seen (address, address+e-mail, user, e-mail hash). Table size grows with distinct visitors. No cleanup code located in `src`, `scripts` or `infra` |
| - | The database is the limiter | If the database is unavailable the auth routes throw and return 500 (they do not fail open). The analytics route deliberately drops the event instead (`analytics/track/route.ts:30-34`) |

## Tests

- `tests/integration/42-account-login-throttle.test.ts`: 10 failures then 429 even with the right password; 15 successful sign-ins never throttle; unregistered address behaves the same.
- `tests/integration/31-public-pages.test.ts:116` expects the fourth and fifth rapid requests of a public route to return 429 (the contact form, limit of 3). `src/app/api/analytics/track/route.test.ts` mocks `checkRateLimit` and covers the limited and limiter-down cases (`:49`, `:56`).
- No unit test of `checkRateLimit` itself (token arithmetic, floor at -1, refill cap) was located. See file 12.
