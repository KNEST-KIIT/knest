# 12. Routes, guards and rate limits (cross-cutting matrix)

This file consolidates, for every route and page in the E2 scope, the guard that applies, the rate limit, the audit row and the failure mapping. Per-module detail is in files 02 to 11.

## 1. Layers a request passes

1. **Edge guard** (`src/proxy.ts` calling `guardRequest`, `src/server/security/edge-guard.ts:58-91`), applied to every path (`matcher: '/:path*'`). In production it refuses any request that lacks the origin-verification secret header (unless the site URL is localhost or the path is `/api/health`); it refuses state-changing methods (POST, PUT, PATCH, DELETE) whose `Origin` is not the site's own or listed in `ALLOWED_ORIGINS`, and refuses a write with no `Origin` that carries `Sec-Fetch-Site: cross-site`. Non-browser clients that send neither header are not blocked here; authentication stays mandatory. It also sets `X-Robots-Tag: noindex` until `SITE_INDEXING=on` (`proxy.ts:15`).
2. **Response caching headers**: `/api/*`, `/dashboard/*`, `/admin/*`, `/apply/*`, `/onboarding/*`, auth pages are `private, no-store` (`next.config.ts` `PRIVATE_PATHS`, `:44-58`).
3. **Route-level limiter and guard** (below).
4. **Action-level checks**: ownership, status, validation, transactional locks.

No `'use server'` actions exist for these modules (asserted by `tests/integration/01-server-action-boundary.test.ts`), so there is no second transport that bypasses layers 1 to 3.

## 2. Guard vocabulary (`src/server/auth/guards.ts`)

| Guard | Fails with | Used by |
|---|---|---|
| `requireUser(returnTo?)` | redirect to `/login?next=` | pages |
| `requireOnboardedUser` | redirect to `/onboarding` | dashboard home |
| `requireStaff`, `requireAdminArea(area)` | `notFound()` (404) | staff pages and layouts |
| `requireUserOrThrow` | `UnauthorizedError(401)` | actions, JSON routes |
| `requireSelf(userId)` | `UnauthorizedError(403)` on mismatch | read helpers |
| `requireStaffOrThrow(area?)` | `UnauthorizedError(403)` | staff actions and routes |

`getSessionUser` fails closed: a lookup error is logged and treated as signed out (`guards.ts:17-33`).

## 3. API routes

Rate-limit keys: `limitByUser(name)` uses `<name>:<userId>`; `limitByIp` and direct `checkRateLimit` use the resolved client address. Limits are token buckets in `app.rate_limits` (`rate-limit.ts:56-76`); capacity is the burst and the interval is the time to refill fully.

| Route | Auth | Limiter (capacity / interval) | Other defences | Audit | Failure statuses |
|---|---|---|---|---|---|
| `POST /api/applications/start` | session | `applicationStart` 10 / 1 h, only when creating | slug must exist and be open | none (analytics `application_start`) | 400, 401/403, 429 |
| `POST /api/applications/[id]/answer` | session, owner | `answerSave` 600 / 1 h | schema per question, row lock | none | 400, 401/403, 429 |
| `POST /api/applications/[id]/documents` | session, owner | `fileUpload` 20 / 1 h (in action) | 10 MiB, MIME allow-list, magic number check, row lock | none | 400, 401/403, 413, 429 |
| `POST /api/applications/[id]/submit` | session, owner | none | Turnstile, verified e-mail, full re-validation | `application_submitted` | 400 (`verify-required`), 400/503 captcha, 401/403 |
| `POST /api/admin/applications/[id]/status` | staff (applications) | `staffAction` 600 / 1 h | legal transition, CAS on status, note <= 2000 | `application_status_changed` | 400, 401/403, 409 conflict, 429 |
| `GET /api/admin/applications/[id]/documents/[questionId]` | staff (applications) | `staffAction` | non-draft only | `application_document_viewed` | 401/403, 404, 429 |
| `POST /api/enquiries` | none (session optional) | `enquirySubmit` 3 / 1 h per IP | Turnstile, honeypot | none | 400, 429, 503 |
| `POST /api/admin/enquiries/[id]/handled` | staff (enquiries) | `staffAction` | CAS on `new` | `enquiry_handled` | 401/403, 404, 429 |
| `POST /api/events/[id]/register` | session | `eventRegister` 60 / 1 h | capacity lock, closed/external/past checks | none | 400, 401/403, 429 |
| `POST /api/events/[id]/unregister` | session | `eventRegister` (shared) | | none | 400, 401/403, 429 |
| `POST /api/onboarding/step` | session | `onboardingStep` 120 / 1 h | Zod per step | none | 400, 401/403, 429 |
| `POST /api/analytics/track` | none | `analyticsTrack` 60 / 10 min per IP | allow-list, size cap, prop narrowing | none | 204 (limited), 400, 413 |
| `POST /api/admin/members/[id]/active` | staff (users) | `staffAction` | strict boolean, last-admin guard | `account_deactivated`/`reactivated` | 400, 401/403, 429 |
| `POST /api/admin/members/[id]/staff-role` | staff (users) | `staffAction` | role enum check, last-admin guard | `staff_role_changed` | 400, 401/403, 429 |
| `GET /events/[slug]/calendar.ics` | none | none | published events only | none | 404 |

Observations on the matrix:

- `limitByUser` lets an anonymous request through so the handler's own 401 answers and an anonymous caller cannot drain another person's bucket (`route-limits.ts:15-24`). The two routes that rate-limit inside the action (`start`, `documents`) convert `RateLimitError` themselves.
- Routes where limiter infrastructure failure would 500: all of them except `analytics/track`, which catches it deliberately.
- The submit route has no rate limit of its own; the transaction makes repeated submits harmless, and the Turnstile call is the cost-bearing step.
- Event register and unregister share one 60 per hour bucket.
- `staffAction` is keyed per staff user, not per target; it bounds a stolen session's churn rather than protecting individual records.

## 4. Pages

| Page | Guard | Notes |
|---|---|---|
| `/apply/[program]` | `requireUser` | never creates anything (R-06) |
| `/dashboard`, role views | `requireOnboardedUser` | |
| `/dashboard/applications`, `/dashboard/events` | `requireUser` | deliberately not gated on onboarding |
| `/onboarding` | `requireUser` | re-openable after completion |
| `/admin/overview` | `requireStaff` | content depends on role |
| `/admin/applications`, `[id]` | layout + function `requireAdminArea('applications')` | |
| `/admin/enquiries` | `requireAdminArea('enquiries')` | |
| `/admin/members` | `requireAdminArea('users')` | |
| `/admin/audit` | `requireAdminArea('audit')` | |
| `/admin/analytics` | `requireAdminArea('analytics')` | |
| public content pages | none | read through the content layer |

## 5. Rate limiter semantics worth knowing

- Atomic single upsert per check; the bucket starts full, refills continuously, and is allowed to drift to -1 so that a burst of rejected requests does not extend recovery beyond one attempt (`rate-limit.ts:47-76`).
- Keys are plain strings; IP-based keys depend on `clientIp` selecting a trustworthy source for the deployment (`rate-limit.ts:96-99`, `client-ip.ts`).
- Every limited request writes to Postgres; the rate-limit table is shared with the rest of the application and is not cleaned by code in this volume (a 7-day retention is proposed in the privacy inputs).
