# E4.11 The rate_limits token bucket

Code: `src/server/security/rate-limit.ts`, route wrappers `src/server/security/route-limits.ts`, table
`app.rate_limits` (column reference in `05-platform-tables-rate-limits-and-mail.md`). No Redis: "one
atomic UPSERT per check ... not needed at this scale" (`rate-limit.ts:47-55`).

## 1. The statement (`rate-limit.ts:59-72`)

```sql
INSERT INTO app.rate_limits AS rl (key, tokens, updated_at)
VALUES (:key, :capacity - 1, now())
ON CONFLICT (key) DO UPDATE SET
  tokens = GREATEST(
    -1,
    LEAST(
      :capacity::double precision,
      rl.tokens + EXTRACT(EPOCH FROM (now() - rl.updated_at)) * :refillPerSecond::double precision
    ) - 1
  ),
  updated_at = now()
RETURNING tokens
```

`refillPerSecond = capacity / refillIntervalSeconds` (line 57). The call returns `true` when the
returned `tokens >= 0` (line 75).

### Why it is built this way

- **One round trip, no read-modify-write race.** `INSERT ... ON CONFLICT DO UPDATE` takes the row
  lock, so two concurrent requests with the same key are serialised by PostgreSQL and each sees the
  other's result. There is no application lock and it is correct across several web containers.
- **First request is free of a SELECT.** A missing key is inserted with `capacity - 1`: the bucket
  starts full and the first request has already spent one token.
- **Refill is lazy.** Nothing runs in the background. The tokens that accrued since `updated_at` are
  added at the next check and clamped to `capacity` by `LEAST`.
- **Time source is the database.** `now()` is the PostgreSQL server clock, so all containers agree
  and application clock skew is irrelevant. Because the call is made with `db.execute` outside a
  transaction, `now()` is the statement time.
- **Debt floor of -1** (`GREATEST(-1, ...)`): a drained bucket may drift to -1 and no further, "so a
  burst of already-rejected requests doesn't push the debt (and so the recovery time) out any
  further than a single rejected attempt would".

### Worked behaviour (derived from the SQL)

Let `C` = capacity and `r` = `C / interval` tokens per second.

| Event | Stored tokens after | Result |
|---|---|---|
| 1st request on a new key | `C - 1` | allowed |
| `k`-th request in a burst (no time passing) | `C - k` | allowed while `C - k >= 0`, i.e. `k <= C` |
| `C + 1`-th request in the burst | `-1` (floored) | rejected |
| further requests with no time passing | `-1` | rejected |
| a request after a pause of `t` seconds from stored `-1` | `min(C, -1 + t*r) - 1` | allowed iff `-1 + t*r >= 1`, i.e. `t >= 2 / r` |

Two consequences that follow directly:

1. **Recovery from lockout takes `2 * interval / C`, not `interval / C`.** For `login`
   (`C = 5`, 900 s) that is 360 s of silence.
2. **A rejected request still writes `updated_at = now()`.** A client that keeps retrying with gaps
   shorter than `2 / r` is never admitted: each rejected attempt deducts a token and re-floors at
   -1. Steady retrying extends a lockout indefinitely; stopping for `2 / r` ends it. For per-address
   buckets behind one shared NAT address this means one noisy user can keep the address locked.
3. A fully idle bucket refills to `C`, so a long-idle key behaves like a new one.

## 2. The read-only check (`rate-limit.ts:83-94`)

`hasRateLimitCapacity` runs a `SELECT LEAST(C, tokens + elapsed * r) FROM app.rate_limits WHERE key =
:key` and returns true if the row is missing or the refilled value is `>= 1`. It spends nothing. It is
used where only failures should count: the per-account sign-in limit, so a successful login never
moves an account towards lockout (comment lines 78-82). Note the gap between the check and the spend
is not atomic; two simultaneous failed logins can both see capacity. Acceptable because spend is the
atomic statement above.

## 3. Named limits (`rate-limit.ts:13-45`)

`capacity` requests per `refillIntervalSeconds` for a full drain. Sustained rate = `C / interval`.

| Name | Capacity | Full-refill interval | Keyed by (as seen in code) |
|---|---|---|---|
| `login` | 5 | 15 min | route + IP |
| `loginAccount` | 10 | 60 min | hashed e-mail; failures only |
| `signup` | 5 | 60 min | IP |
| `passwordResetRequest` | 5 | 60 min | IP |
| `applicationStart` | 10 | 60 min | `application-start:<userId>` (`applications/actions.ts`), new applications only |
| `fileUpload` | 20 | 60 min | user |
| `analyticsTrack` | 60 | 10 min | IP |
| `enquirySubmit` | 3 | 60 min | `enquiry:<ip>` (`app/api/enquiries/route.ts:8`) |
| `verifySend` | 5 | 60 min | IP and address |
| `tokenConfirm` | 20 | 60 min | IP |
| `answerSave` | 600 | 60 min | `answerSave:<userId>` via `limitByUser` |
| `onboardingStep` | 120 | 60 min | user |
| `eventRegister` | 60 | 60 min | user |
| `notificationRead` | 300 | 60 min | `notificationRead:<userId>` |
| `labRequest` | 20 | 60 min | user |
| `staffAction` | 600 | 60 min | user |
| `labAction` | 120 | 60 min | user |
| `labAvailability` | 240 | 60 min | user |
| `labScan` | 600 | 60 min | user |

"Keyed by" for rows not individually cited is inferred from the comments in `rate-limit.ts` and the
two helpers; confirm at the call site before relying on it.

Helpers (`route-limits.ts`):

- `limitByIp(request, name, extraKey?)` builds `<name>:<ip>[:extra]` and returns a 429 JSON response
  or `null`.
- `limitByUser(name)` builds `<name>:<userId>`; with no session it returns `null` (lets the request
  continue) so an anonymous caller cannot drain someone else's bucket and the route's own sign-in
  check answers 401.
- `enforceRateLimit` throws `RateLimitError('Too many requests')` for server actions
  (`rate-limit.ts:101-112`).

Client address source: `clientIp(request)` uses `clientIpFromHeaders` with `CLIENT_IP_SOURCE`
(`cloudfront` for hosted production, `x-forwarded-for` in the test suite; `src/server/env.ts:26`,
`tests/integration/global-setup.ts:61-62`). If that setting is wrong, every visitor shares one bucket
or each can choose their own key; it is a security-relevant deployment setting.

## 4. Operational notes

- **Failure mode.** `checkRateLimit` has no try/catch: a database error propagates to the caller.
  Whether each caller fails open or closed is not determined from this file.
- **Growth.** There is no purge; `DELETE FROM app.rate_limits WHERE updated_at < now() - interval
  '1 day'` is safe at any time because an absent key behaves as a full bucket, which is also what a
  fully refilled key behaves as (for any bucket whose interval is under a day; all are at most 60
  minutes).
- **Reset a user or address**: `DELETE FROM app.rate_limits WHERE key = '<name>:<id>'`.
- **Hot-row contention.** All requests of one key serialise on one row. For `staffAction` and
  `labScan` the key is per user, so contention is bounded to one person's own requests.
- **Privacy.** IP addresses are embedded in `key` for IP-keyed limits and kept until deleted.
