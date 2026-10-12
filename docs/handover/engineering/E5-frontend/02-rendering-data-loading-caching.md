# E5.02 Server and client components, data loading, caching and dynamic rendering

Scope: how each page obtains its data and what is rendered on the server versus the client. Line citations are to the files named. No build output was available (no `node_modules`, no `.next`), so the static or dynamic classification below is derived from the code, not from a build report.

## 1. The rule the code follows

- Pages and layouts are Server Components by default. `'use client'` appears only on leaves that need state, effects, router hooks or framer-motion: forms, filter controls, the header, motion wrappers, the Turnstile widget, `LiveRegion`, `Field`.
- Client components never import `src/server/*` except for pure constants: `contact-form.tsx:9` imports `ENQUIRY_TOPICS` and `MAX_ENQUIRY_MESSAGE` from `@/server/enquiries/validation`; `onboarding-flow.tsx:10-12` imports `recommend`, `destination` helpers and validation lists from `src/server/onboarding`. These must stay free of `db`, `payload` and `process.env` secrets or they would leak into the client bundle. Nothing in this repository enforces that boundary (no `server-only` import was found in the files read); it depends on reviewer attention.
- Data is fetched in the page or in an async child Server Component and passed down as props (for example `StartApplication`, `ApplicationForm` receive `questions`, `initialAnswers`, `turnstileSiteKey` from `apply/[program]/page.tsx:69-76`). The Turnstile site key is a prop read at request time, not `NEXT_PUBLIC_*`, so one image serves any environment (`contact/page.tsx:12-13`, `login/page.tsx:7-8`).

## 2. There is no static caching layer

A search of `src` for `revalidate`, `generateStaticParams`, `unstable_cache`, `'use cache'`, `cacheLife`, `revalidatePath` and `revalidateTag` finds nothing. Consequences:

1. Every content page reads Payload on every request through the local API (`src/server/content/*.ts`). There is no ISR and therefore no staleness to manage, and no protection for the database from public traffic other than the CDN configuration in infra.
2. Publishing a page in Payload is visible on the next request with no revalidation hook. This is the design intent stated in `sitemap.ts:10` ("a newly published page appears without a rebuild") and `blog/page.tsx:13-15`.
3. The only memoisation is React `cache()` around `getContentClient` (`server/content/payload-client.ts:11`), which dedupes Payload client construction within one render, not queries.

### How pages become dynamic

`(public)/layout.tsx:10` awaits `getSessionUser()`, which calls Auth.js `auth()` and reads request cookies. `guards.ts:22-25` documents the reliance: Next signals "this render is dynamic" by throwing from request APIs, and `unstable_rethrow` must let that through "or a page that reads the session gets prerendered as if nobody were signed in". Because the layout does this, every page under `(public)` is dynamic whether or not it exports `dynamic`.

Explicit `export const dynamic = 'force-dynamic'` exists on: `blog/page.tsx:15`, `contact/page.tsx:13`, `privacy/page.tsx:10`, `terms/page.tsx:9`, `login`, `signup`, `reset` pages, `lab-device/page.tsx:11`, `robots.ts:4`, `sitemap.ts:11`, `api/health/route.ts:6`, the lab booking and lab staff pages and eight staff pages. The explicit flags guard the case where someone removes the session read from the layout: the blog comment records that exactly this once froze invented content into the build. Pages without the flag (home, about, programs, events, mentors, startups, resources, ecosystem, invest, get-involved, search and every detail page) are protected only by the layout. Recommendation for a future change: add the flag to those pages as well, or add a test that fails if a content page is prerendered.

Pages that call `requireUser`, `requireStaff` or `cookies()` are dynamic by construction.

## 3. Per-page data loading

| Route | Server reads | Notes |
|---|---|---|
| `/` | `getHomepage()` (global, depth 1), `getSessionUser()`, `listPrograms({})`, `getEcosystemCounts()`, `track('landing_view')` in one `Promise.all` (`page.tsx:31-45`) | Programs failure is converted to `unavailable: true`; homepage failure to approved static copy (`server/content/homepage.ts:51-60`); counts failure to unknown counts (`ecosystem-counts.ts:17-23`). The page survives a CMS outage. |
| `/programs` | `listPrograms(filters)` (limit 100, sort `-nextCohortStart`) | `programs.ts:32-39`. No pagination; filtered by `equals`. |
| `/programs/[slug]` | `getProgramBySlug` twice (metadata and page), `track('program_view')`, `listProgramCohortsWithStartups`, `ApplyCta` twice | See section 4. |
| `/events` | `listUpcomingEvents(filters)` | Computes "now" per call; an event with no end stays until it starts, one with an end until it ends (`events.ts:40-71`). |
| `/events/[slug]` | `getEventBySlug` (depth 2) twice, `getRegistrationCount`, `getSessionUser`, `getRegistrationStatus` | Swallows errors to `null`, see section 5. |
| `/events/[slug]/calendar.ics` | `getEventBySlug` | Route handler, section 6 of E5.05. |
| `/mentors`, `/mentors/[slug]`, `/startups`, `/startups/[slug]`, `/resources`, `/resources/[slug]`, `/blog`, `/blog/[slug]` | `listMentors`, `getMentorBySlug`, etc. | Detail pages for startups and resources call `track(...)` in render. |
| `/ecosystem` | `listInfrastructure()`, `listPartners()` | Six dimensions and the infrastructure spec list are literals in the page (`ecosystem/page.tsx:12-60`), not CMS data. |
| `/invest` | `listUpcomingEvents({eventType:'demo_day'})`, `listFeaturedStartups(6)`, `listFounderArticles(6)` | One `Promise.all` (`invest/page.tsx:25-29`). |
| `/search` | `search(q)` then `track('search_query')` | `search/page.tsx:22-24`. Five parallel Payload queries, limit 20 each. |
| `/contact`, `/login`, `/signup` | `turnstileSiteKey()`, `googleConfigured()` | Env read at request time. |
| `/dashboard` | `requireOnboardedUser`, `listNotificationsForUser`, `isLabBookingEnabled`, `labsRunBy`, then a role view that reads events, resources, applications | `dashboard/page.tsx:26-38`; views at `student-view.tsx:12-17`, `founder-view.tsx:12-16`. |
| `/apply/[program]` | `requireUser`, `getApplicationProgramBySlug`, `findApplicationForProgram`, `getOwnedApplicationDetail` | Never creates a draft on GET (R-06, `apply/[program]/page.tsx:29-30`). |
| `/onboarding` | `requireUser`, direct Drizzle read of `users` | `onboarding/page.tsx:26-32`. Page-level database access, unlike the others which go through `src/server`. |

## 4. Duplicate reads in one request

The content fetchers are plain async functions with no `cache()` wrapper, so identical work runs more than once:

- `generateMetadata` and the page component each call `getProgramBySlug` (`programs/[slug]/page.tsx:17,28`), `getEventBySlug` (`events/[slug]/page.tsx:28,35`), `getMentorBySlug`, `getResourceBySlug`, `getStartupBySlug`, `getArticleBySlug`. That is two Payload queries per detail view. Next dedupes `fetch` calls, not Payload local-API calls. Wrapping each getter in React `cache()` is a one-line fix per function.
- `ApplyCta` is rendered twice on `programs/[slug]`, once in the mobile block and once in the sticky aside (`programs/[slug]/page.tsx:180,187`). Each instance is an async Server Component that calls `getSessionUser()` and, for an open program with a signed-in user, `getApplicationStatusForUser` (`apply-cta.tsx:14,48`). Both are rendered into the HTML and hidden with CSS (`lg:hidden` and `hidden lg:block`), so every request pays for both and ships duplicate markup.
- The `(public)` layout, the page and `track()` each resolve the session (`layout.tsx:10`, `track.ts:58`, `apply-cta.tsx:14`). Whether Auth.js memoises `auth()` per request was not determined from the code; if not, each call is a session-table read.

## 5. Failure modes that differ by getter

| Getter | On failure | Result for the visitor |
|---|---|---|
| `listPrograms`, `listEvents`, `listUpcomingEvents`, `getProgramBySlug` | throws (comment "failure throws (KN-01)", `programs.ts:20`, `events.ts:17`) | segment `error.tsx` with `RouteError` |
| `getEventBySlug` | catches, `console.warn`, returns `null` (`events.ts:94-97`) | `notFound()`: a CMS outage on an event page shows "This page doesn't exist", is a 404 to crawlers, and the ICS route returns a 404 with `no-store` (`calendar.ics/route.ts:12`) |
| `getEventById` | catches, returns `null` (`events.ts:73-80`) | caller-dependent |
| `getHomepage`, `getEcosystemCounts` | catch and degrade | home still renders |
| `sitemap.ts` `safely()` | catches per collection (`sitemap.ts:16-24`) | static paths still listed |

The inconsistency in `getEventBySlug` is a defect candidate: a transient database error should not tell search engines the page is gone.

## 6. Analytics inside render

`track()` is awaited in `programs/[slug]/page.tsx:30`, `startups/[slug]/page.tsx:29`, `resources/[slug]/page.tsx:32`, `search/page.tsx:24` and as part of the home `Promise.all` (`page.tsx:44`). It inserts a row into `analytics_events` (`server/analytics/track.ts:60-65`). Properties:

- Never throws (`:66-68`), so analytics cannot break a page.
- It does add a database round trip to the critical path of each of those renders; the row is not fire-and-forget.
- Cookie setting is attempted and silently fails in a Server Component (`:25-37`), so for a pure page-view visit the `sessionId` is a new random UUID per request. Page-view analytics therefore cannot be grouped by visitor until a route handler sets the cookie; counts of "views" are request counts.
- Prefetch behaviour of `next/link` on these routes was not determined; if production prefetch renders the page body, views are over-counted.

## 7. Streaming and Suspense

List pages define the data-bearing component as a child async function (`ProgramsList`, `EventsList`, ...) but render it directly, not inside `<Suspense>` (`programs/page.tsx:116-118`). The only `<Suspense>` boundaries wrap the client filter bars because `useSearchParams` requires one (`programs/page.tsx:111-113`, `mentors/page.tsx:94-96`, `login/page.tsx:15-17`). The route-level `loading.tsx` is therefore the only streamed fallback, and it appears on navigation, not on a hard reload (framework behaviour, not verified here).

## 8. Request headers that affect caching

`next.config.ts:44-58` sends `Cache-Control: private, no-store` for `/api/*`, `/dashboard/*`, `/admin/*`, `/apply/*`, `/onboarding/*`, `/login`, `/signup`, `/verify/*`, `/reset/*`, stating that the CDN is also configured not to cache them. `/sw.js` is `no-cache` (`:74`). `/lab-device` is intentionally not in the private list because its shell is cacheable by the service worker. Public content pages set no explicit header; their effective `Cache-Control` is whatever Next emits for dynamic output, which was not determined from the code. `calendar.ics` sets `public, max-age=300` (`calendar.ics/route.ts:30`), so a draft that was briefly published can remain downloadable from a shared cache for five minutes.

## 9. Limits and unbounded queries

Public lists use `limit: 100` with no pager (`programs.ts:36`, `events.ts:31`, `events.ts:65`). A hundred-and-first program or event never appears on the list page and is reachable only by URL, search (limit 20 per collection, `search.ts:35-70`) or the sitemap. The sitemap asks for 500 articles (`sitemap.ts:33`). The staff lists paginate through `lib/pagination.ts`.
