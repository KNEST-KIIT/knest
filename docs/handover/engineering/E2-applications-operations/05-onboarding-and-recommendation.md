# 05. Onboarding and recommendation

Module: `src/server/onboarding/` (`actions.ts`, `validation.ts`, `recommend.ts`, `destination.ts`), route `src/app/api/onboarding/step/route.ts`, pages `src/app/(member)/onboarding/` and the dashboard views that consume the recommendation.

## 1. Design

- **Each step writes immediately and independently** to the `users` row, so closing the tab loses at most the step in progress (`actions.ts:19-28`). There is no onboarding draft table and no step counter on the server; the server holds no notion of "which step the person is on".
- **One endpoint**, `POST /api/onboarding/step`, with a JSON body `{ step, data }`. It is a JSON route, not a page, so an expired session answers 401 that the client can act on; a redirect from `requireUser` would be followed silently by `fetch` and fail JSON parsing (`actions.ts:22-28`). The client turns a 401 into a trip to `/login?next=...` (`onboarding-flow.tsx:81-85`).
- **The recommendation is a pure function** of (platform role, journey stage). It is not stored. It is recomputed in the browser on the final screen (`onboarding-flow.tsx:334`) and again on each dashboard load (`student-view.tsx:12`).

## 2. Step handlers

All in `actions.ts`; each begins with `requireUserOrThrow()`, validates with a Zod schema from `validation.ts`, and issues one `UPDATE users ... WHERE id = <session user>` that also sets `updated_at`. The target row is always the signed-in user; there is no user id in the payload.

| Step key | Function | Schema (`validation.ts`) | Columns written |
|---|---|---|---|
| `role` | `saveRoleStep` `:30-41` | `stepRoleSchema` `:44-46`: enum of 7 platform roles | `platform_role` |
| `goals` | `saveGoalsStep` `:43-50` | `:48-50`: array of the 8 goal values, min 1 | `goals` |
| `stage` | `saveStageStep` `:52-63` | `:52-54`: enum of 7 journey stages | `journey_stage` |
| `interests` | `saveInterestsStep` `:65-76` | `:56-58`: array of CMS sector values (`SECTOR_OPTIONS`), default `[]` | `interests` |
| `profile` | `saveProfileStep` `:78-97` | `:60-67` | `name`, `school`, `graduation_year`, `linkedin_url`, `bio`, `skills` |
| `mentor-profile` | `saveMentorProfileStep` `:100-119` | `:69-78`: name, optional organisation, `expertiseAreas` min 1 from `EXPERTISE_OPTIONS`, years 0..80, availability enum, optional LinkedIn | `name`, `organization`, `expertise_areas`, `years_of_experience`, `mentor_availability`, `linkedin_url` |
| `complete` | `completeOnboarding` `:126-136` | none | `onboarding_completed_at = now`; analytics `onboarding_completed` |

Field rules of note (`validation.ts:60-78`): `name` trimmed, 1..120; `school` max 160; `bio` max 500; `linkedinUrl` must be a URL or empty string; `graduationYear` coerced number 1990..2100. Empty optional strings are stored as `NULL` (`school || null`, etc., `actions.ts:87-89`).

The step handlers return `{ ok:false, error }` on validation failure with a short message (`'Pick one.'`, or the first Zod issue); the route maps that to 400.

## 3. The route

`src/app/api/onboarding/step/route.ts:24-43`.

1. `limitByUser('onboardingStep')`: 120 per hour refill (`rate-limit.ts:32`); anonymous callers pass through to the 401 below.
2. Parse JSON; `HANDLERS[step]` selects the function; unknown step returns 400 "Unknown step." (`:28-31`).
3. `complete` is called with no data; the others with `body.data`.
4. `UnauthorizedError` becomes JSON 401/403 "Sign in to continue."; other exceptions propagate to 500.

## 4. Enumerations and where they live

| Set | Defined | Source of truth for the DB |
|---|---|---|
| Platform roles | `validation.ts:11-19`, enum `app.platform_role` (`enums.ts:20-28`) | DB enum |
| Journey stages | `validation.ts:32-40`, enum `app.journey_stage` (`enums.ts:41-49`) | DB enum |
| Goals | `validation.ts:21-30` | `goals` is `text[]` with no DB constraint |
| Sectors, expertise | `src/payload/fields/taxonomy.ts` | `interests`, `expertise_areas` are `text[]` with no DB constraint |
| Mentor availability | `validation.ts:42`, enum `app.mentor_availability` | DB enum |

The TypeScript lists in `validation.ts` and the DB enums are maintained by hand in parallel; a value present in one and missing from the other produces a database error at write time (500). Not determined from the code whether a test cross-checks them.

## 5. The recommendation function

`recommend(platformRole, journeyStage): Recommendation` (`recommend.ts:35-101`). Pure, synchronous, no I/O.

| Condition | Path | Next page (`destination.ts:10-24`) |
|---|---|---|
| role `mentor` | `MENTOR` | `/dashboard` (profile is reviewed by staff; no `/profile` page exists, HD-13) |
| role `investor` or `partner` | `CONNECT` | `/about#contact` |
| any other role, stage `idea` or `validation` | `VALIDATE` | `/programs?stage=<stage>` |
| stage `mvp` or `early_revenue` | `BUILD` | `/programs?stage=<stage>` |
| stage `scaling` or `established` | `GROW` | `/programs?stage=<stage>` |
| stage `exploring`, or null | `EXPLORE` | `/events` |

Why only role and stage: the decision table in the content spec is fully specified by those two inputs, and using goals or interests would "mean inventing product behaviour that isn't written down anywhere reviewable" (`recommend.ts:20-25`). Every result carries a `reason` string shown to the user, because the product requirement is a transparent, rule-based recommendation (`:11-15`).

Limitations:

- `goals` and `interests` are collected and stored but no code path reads them (`grep` for `.goals` and `.interests` outside onboarding and schema finds none). The comment says they are intended for event and resource recommendations (`recommend.ts:23-25`); the dashboard queries use only the stage (`student-view.tsx:14-15`, `events.ts:286-294`, `resources.ts:184-188`).
- `headline` and `body` carry identical strings in every branch (`recommend.ts:37-38` and the others); callers use `headline || body`.
- The completion screen prints the raw path code ("VALIDATE") as a badge (`onboarding-flow.tsx:357-359`).

## 6. Return path handling

`onboardingReturnPath(raw)` (`destination.ts:31-36`) accepts only values that pass `safeNext` (same-origin absolute path; rejects `//`, backslashes, control characters and non-same-origin results, `src/lib/safe-next.ts:46-63`) and refuses `/onboarding` itself to avoid a loop. `completionDestination(next, path, stage)` returns that path if present, otherwise `pathHref` (`:43-49`). `onboardingUrl` rebuilds `/onboarding?stage=..&next=..` from validated parts (`:52-59`).

Purpose: the application a person was about to start survives the signup and onboarding detour (KN-14); the homepage selector's chosen stage survives a login (`page.tsx:24-26`). Hostile values fall back to the recommendation, never to the attacker (`destination.test.ts` "a hostile return path falls back").

## 7. Pages

`/onboarding` (`page.tsx:14-53`): `requireUser(onboardingUrl(...))`, loads the user row and passes current answers as initial state. It does not redirect an already onboarded user, because the "re-configure your profile" link relies on re-entry (`:28-30`). The stage query parameter prefills only when it is a valid stage.

The step list is derived from the chosen role (`onboarding-flow.tsx:112-120`): mentor, investor and partner skip `stage`; mentors get `mentor-profile` instead of `profile`.

The dashboard calls `requireOnboardedUser`, which sends a person with `onboardingComplete === false` back to `/onboarding` (`guards.ts:50-54`). `/apply/*`, `/dashboard/applications` and `/dashboard/events` deliberately use `requireUser` and are not gated.

## 8. Failure modes and defects

- **Completion does not check that anything was answered.** `completeOnboarding` sets the timestamp unconditionally (`actions.ts:126-136`). A client posting only `{step:'complete'}` is "onboarded". The timestamp is used by the dashboard gate, by lab eligibility (`src/server/labs/service.ts:126`) and by the analytics North Star (file 10).
- **Not idempotent.** Each `complete` call overwrites the timestamp and records another `onboarding_completed` event, so that event count can exceed the number of onboarded users (the reconciliation panel will then describe it as records removed, file 10).
- **Re-running the profile step erases `skills` and `graduation_year`.** The UI always sends `skills: []` and never sends a graduation year (`onboarding-flow.tsx:303-309`); the handler writes `parsed.data.skills` and `graduationYear ?? null`. No other code writes either column, so both are effectively always empty. Re-opening onboarding after completion cannot lose real data today, but the handler would destroy any value another feature added.
- **Unbounded arrays.** `skills` is `z.array(z.string())` with no item or count limit (`validation.ts:66`); only the request body size bounds it.
- **Prototype key lookup.** `HANDLERS[step]` indexes a plain object with a client string (`route.ts:29`). A `step` such as `"constructor"` or `"toString"` resolves to an inherited function, is called, returns a non-result, and the route answers 400 with no `error` text. Harmless in effect but not an intended 400 "Unknown step.".
- **Role is self-asserted.** Any signed-in user may set `platform_role` to `mentor` or `investor` at any time, including after completion. It only selects the dashboard variant and the recommendation; staff authority is the separate `staff_role` column that this module never writes.

## 9. Tests

| File | Covers |
|---|---|
| `recommend.test.ts` | Every role x stage (including null) resolves to a path with a reason; mentors always MENTOR; investor/partner always CONNECT; stage mapping table; null stage is EXPLORE; six paths reached |
| `destination.test.ts` | Every recommendable path maps to an existing page; stage kept on programs link; hostile and looping return paths dropped; return path beats recommendation; `onboardingUrl` encoding |
| `tests/integration/70-core-journey.test.ts:78-133` | KN-14: lands on the application not dashboard; falls back to recommended page; hostile `next` ignored; failed finish keeps the person on the page with an error |
| `tests/integration/36-journey-student.test.ts:100` | Finishes onboarding and lands on a fitting page |

No unit test exists for the step handlers' validation or the route's unknown-step handling.
