# 11. Content delivery layer

Module: `src/server/content/` (15 files). This is the only code path by which public pages read CMS content. It wraps Payload's local API and enforces three rules: public reads see only published documents, empty means empty, and failure is visible.

Line numbers below are counted from the start of each named file.

## 1. The client: `payload-client.ts`

`getContentClient = cache(() => getPayload({ config }))` (`:11`). React `cache()` memoises one Payload instance per request render so every component in a render shares it. It saves `getPayload` setup, not connections; Payload pools its own database connections (`:5-10`). Everything else in the directory imports this and nothing else touches Payload directly, with the exceptions listed in section 6.

## 2. Rules every reader follows

1. **`overrideAccess: false` and no `user`.** The local API bypasses access control by default; passing `false` with no user makes each call see exactly what an anonymous REST visitor would see. The collections' read rule is `readPublished`: anonymous gets `_status = published`, staff get everything (`src/payload/access.ts:32-35`). So a draft cannot reach a public page through this layer whatever calls it (`programs.ts:13-18`, `events.ts:11-15`). `lists.test.ts:52-57` asserts every `find` call carries `overrideAccess: false`.
2. **Empty means empty; failure throws (KN-01).** The list functions return `[]` for no rows and let errors propagate so the route's error boundary renders an honest error. They used to substitute invented records in either case (`startups.ts:11-16`, `articles.ts:3-8`). `lists.test.ts:34-50` asserts `[]`, throws, and passthrough for 11 list calls.
3. **Missing is null, not an exception** for single-document readers (`getProgramBySlug`, `getEventById`, etc.).

Inconsistencies against rule 2 (see file 15, D-6): `resources.ts`, `partners.ts` and `infrastructure.ts` catch every error, log a warning and return `[]`; `getEventById`, `getEventBySlug`, `getMentorBy*`, `getStartupBySlug`, `getResourceBySlug` return null on any error, so an outage looks like a 404 for those detail pages.

## 3. Readers by collection

| Module | Function | Behaviour |
|---|---|---|
| `programs.ts` | `listPrograms(filters)` `:21-42` | up to 100, `sort -nextCohortStart`, depth 1; filters `stage`, `sector`, `audience`, `format`, `status` (applicationStatus) |
| | `listProgramsByMentor(mentorId)` `:45-57` | up to 50, depth 0 |
| | `getProgramById(id)` `:60-67` | `findByID`, any error null |
| | `getProgramBySlug(slug)` `:69-85` | depth 1, first doc or null |
| | `listProgramCohortsWithStartups(programId)` `:92-123` | cohorts (50) then one query for all their startups (100, depth 1), grouped in memory: one query not one per cohort |
| `events.ts` | `listEvents`, `listUpcomingEvents`, `getEventById`, `getEventBySlug` (depth 2), `listRecommendedEvents` | file 06, section 8 |
| `mentors.ts` | `listMentors({expertise})` `:26-42` | up to 100, then **sorted in memory** open, limited, unavailable (`:9-17,41`); an unavailable mentor is ranked last, never hidden |
| | `getMentorByUserId(userId)` `:51-68` | resolves a signed-in mentor's published profile via `Mentors.userId`; null is legitimate (staff review before publishing) |
| | `getMentorBySlug` `:70-87` | |
| `startups.ts` | `listStartups({stage,sector})` `:17-35` | up to 100, `-createdAt` |
| | `listFeaturedStartups(limit=6)` `:38-51` | `featured = true` |
| | `getStartupBySlug` `:53-70` | depth 2 |
| `articles.ts` | `listFounderArticles(limit=6)` `:10-23` | where `startup` exists, by `-publishedAt` |
| | `getArticleBySlug`, `listArticles(limit=12)` | |
| `resources.ts` | `listResources`, `getResourceBySlug`, `listRecommendedResources(stage,limit=3)` | `getResourceBySlug` requires `body` to exist: an externally hosted resource has no `/resources/[slug]` page (`resources.ts:38-46`) |
| `partners.ts` | `listPartners(limit=30)` | sorted by name |
| `infrastructure.ts` | `listInfrastructure(limit=20)` | showcase only, no booking |

Hard caps: 100 documents for most lists, silently. A catalogue larger than 100 will be truncated with no pagination in these functions. The sitemap uses `listArticles(500)` for articles only (`sitemap.ts:33`).

Filter values come straight from URL query strings (`searchParams`) into `where` clauses as `equals`; Payload parameterises them. An unknown value simply returns no rows.

## 4. Search

`search.ts:25-126`: `search(query)` trims; empty returns `[]`. Five parallel `find` calls (programs, startups, mentors, events, resources), each `limit 20`, `sort -createdAt`, `overrideAccess: false`, using Payload's `contains` operator across title/tagline/name/bio fields, i.e. SQL `ILIKE '%term%'`. Results are mapped to `{type,id,title,summary,href}` and ordered: exact (case-insensitive) title matches first, otherwise collection priority (programs, startups, mentors, events, resources) then recency.

Properties and limits:

- Partners and articles are not searched (`:22-23`).
- Maximum 100 results, no pagination, no ranking beyond exact-title first.
- Whether Payload escapes `%` and `_` typed by the user inside `contains` was not determined from this code (the comment asserts the wrapping only, `:14-18`). The staff-console search escapes explicitly (`likePattern`); this one does not.
- The query length is not capped here or on the page (`search/page.tsx:67`).
- A resource with no hosted body links to its `externalUrl`, or `#` when neither exists (`:113`).
- Each search page request runs five queries plus an analytics insert and is not rate limited.
- Test `31-public-pages.test.ts:138-150`: published mentor found by name and organisation, never a draft.

## 5. Homepage and ecosystem counters

### Homepage global: `homepage.ts`

`getHomepage()` (`homepage.ts:42-54`): reads the `homepage` global; if it has a `heroHeadline` returns it, else returns `FALLBACK_HOMEPAGE`; on any error logs `console.error` and returns the same fallback. The fallback is built only from `HOMEPAGE_COPY` (`homepage-copy.ts`, 33 lines), the approved text from the content spec, with no figures, funding or ranking claims. `lists.test.ts:82-86` asserts the copy contains no digits and none of capital, grant, credit, ranking. One source feeds both the code fallback and the CMS seed so they cannot drift, and changing it needs the copy approver, not a developer (`homepage-copy.ts:1-8`).

`enabledSections(homepage)` returns ordered, enabled section keys; falls back to the fixed default order when the array is empty. Defects: in `src/app/(public)/page.tsx` the cases `person`, `knest` (`:58-62`) and `startups` (`:131-132`) return `null`. The person and knest copy is rendered inside `Narrative` as part of the `problem` section (`narrative.tsx:16,33,52`), so toggling those keys in the CMS has no effect and disabling `problem` removes all three. `BuiltWithKnest` (`built-with-knest.tsx`) is not imported anywhere, so the homepage "startups" section never renders.

### Counters: `ecosystem-counts.ts`, `ecosystem-groups.ts`, `ecosystem-types.ts`

`getEcosystemCounts()` runs ten `payload.count` calls in parallel, each wrapped by `safeCount` so one failure becomes `null` for that figure and a log line, and a failure to obtain the client returns `UNKNOWN_COUNTS` (`ecosystem-counts.ts:3-44`). Counts are of published rows only (`overrideAccess: false`). Partner counts are by `type`; upcoming events are `startsAt >= now`, which differs from the event list's end-time-aware rule so a running event is listed but not counted.

`visibleCount` (`ecosystem-types.ts`) accepts only positive integers; `buildEcosystemGroups` (`ecosystem-groups.ts:54-64`) drops zero or unknown stats and then empty groups, so a young platform shows a short honest section, or none, never "0 programs" (KN-01). Singular and plural labels switch at 1. Tested by `ecosystem-groups.test.ts`.

## 6. Other direct users of Payload in these areas

- `/admin/applications` page queries `programs` itself with `overrideAccess: false`, limit 100 (`applications/page.tsx:65` of that file's numbering) for the filter dropdown.
- `program-questions.ts` (file 01) reads `programs` with an optional access override for staff.
- `sitemap.ts` calls the list functions inside a `safely` wrapper so the sitemap still lists static pages if content fails (`:16-24`); it is `force-dynamic` and covers programs, events, mentors, startups, resources with a body, and articles, deliberately omitting `/privacy` and `/terms` until text is approved (`:13-14`).

## 7. Caching and freshness

No `revalidate`, `unstable_cache`, `'use cache'` or `force-static` appears anywhere under `src` (searched). Every public layout reads the session (`(public)/layout.tsx:10`), which makes public pages dynamic. Consequences: edits in the CMS are visible on the next request with no revalidation hook needed, and every page view issues CMS queries against the database, including the homepage (programs, global, ten counts) on each load. At KIIT scale this is simple and correct; it is the first place to look if load testing shows database pressure (`docs/handover/LOAD-TEST.md`).

## 8. Gotchas for the next engineer

- Adding a new public list: copy an existing reader, keep `overrideAccess: false`, decide explicitly whether errors propagate.
- Relationship depth: detail pages request depth 1 or 2 because pages read one or two hops (`programs.ts:75-79`); raising depth multiplies queries.
- `Mentors.userId` is a plain text field with no field-level read restriction (`src/payload/collections/mentors.ts:60-69`); because the collection is publicly readable, the linked platform user id would be included in anonymous REST responses. Not verified at runtime.
- Draft visibility for staff previews relies on staff being logged into Payload; this layer never passes a user, so staff previewing a draft in the public site would also get a 404.

## 9. Tests

`lists.test.ts` (11 list functions: empty, failure, passthrough, anonymous scope; homepage fallback and copy rules), `ecosystem-groups.test.ts`, integration `05-empty-cms.test.ts` (empty database, honest empty states, publishing a program makes it appear), `10-anonymous-api.test.ts:119` (unpublished program invisible), `31-public-pages.test.ts`. Not unit-tested: `search`, `mentors` ordering, `getEcosystemCounts` failure handling, `listProgramCohortsWithStartups` grouping, `listRecommendedEvents` filler.
