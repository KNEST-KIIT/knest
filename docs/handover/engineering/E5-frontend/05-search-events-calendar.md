# E5.05 Search, events and calendar export

## 1. Search

Files: `src/app/(public)/search/page.tsx`, `src/server/content/search.ts`, `src/lib/search-query-log.ts`, `src/lib/empty-state-copy.ts`, `src/lib/result-summary.ts`.

Flow: a plain GET form (`search/page.tsx:78-88`, `action="/search" method="get"`, `name="q"`, `type="search"`) so search works without client JavaScript and is shareable by URL. The server page reads `q`, trims it (`:66-67`) and, when non-empty, renders `SearchResults`, which calls `search(query)` then `track('search_query', toLoggedSearch(query, count))` (`:23-24`).

`search()` (`search.ts:25-126`):
- Empty after trim returns `[]` with no query (`:26-27`).
- Five parallel Payload `find` calls (programs, startups, mentors, events, resources), each `contains` on title/name/tagline/summary (mentors also title, organization, bio), `depth: 0`, `limit: 20`, `sort: '-createdAt'`, `overrideAccess: false` (`:31-72`). Drafts therefore cannot appear. Partners, articles, infrastructure and cohorts are not searched; articles are missing even though the blog is public.
- Results are concatenated in funnel order (programs first, resources last) and then stably re-sorted so an exact, case-insensitive title match comes first (`:117-125`).
- Resource href is `/resources/<slug>` when it has a hosted body, otherwise `externalUrl`, otherwise the literal `#` (`:113`). A resource with neither yields a dead link card; the same fallback exists on the list page (`resources/page.tsx:59`).

Constraints and failure modes:
1. `contains` is an `ilike %q%`; Payload wraps the term itself (comment `:15-18`). Whether it escapes `%` and `_` typed by the user was not determined; the helper `likePattern` in `lib/pagination.ts:24-26` escapes them but is used only by staff lists. Worst case is a broader match, not injection.
2. No minimum length, no rate limit on the page. A one-letter query runs five table scans. Rate limiting for the public page was not found in the files read.
3. Hard cap of 100 results (5 x 20) and no pagination; a 21st program match is invisible.
4. Search is not ranked beyond exact title; no stemming or typo tolerance.
5. A failure inside `search()` throws and `search/error.tsx` renders `RouteError`. The query is preserved in the URL, so "Try again" re-runs it.
6. The page copy at `:75` says "Programs, startups, events and resources" and omits mentors, which are searched (`metadata` at `:11` lists them).

Logging (`search-query-log.ts:16-42`): length and result count are always recorded; the text is stored lower-cased only if it is at most 64 characters and contains no email-like token (`\S+@\S+`), no URL and no run of six or more digits (allowing separators). Otherwise `query` is `null`. Test: `search-query-log.test.ts`. Retention is governed by `docs/delivery/SEARCH-RETENTION.md` and is not enforced in this layer. Note the page logs at render, so each reload of a result page, and each prefetch if any, adds a row.

Empty state: `searchEmpty(query)` builds the heading `Nothing matched "<query>".` (`empty-state-copy.ts:34-39`). The query is interpolated into a heading as a React text child, so it is escaped. A very long query is not truncated and will wrap; `Heading` has no `overflow-wrap` rule.

Accessibility: the input has `aria-label="Search"` and no visible label (`:79-86`); result count goes through `LiveRegion` (`:36,44`); results are `LinkCard`s with `label="<Type>: <Title>"`. Result titles are `h3` directly under the page `h1` with no `h2` (`:50`), a heading-level skip.

## 2. Filters on list pages

Programs, events, startups, mentors and resources keep filter state entirely in the URL. `FilterBar` (`components/ui/filter-bar.tsx:21-70`) holds a `config` array of `{key, label, options}`, reads `useSearchParams`, and `router.push`es on every `<select>` change; "Clear all" appears when any key is set (`:38,59-67`). The server page maps the same keys into a typed filter object (`programs/page.tsx:90-96`). Consequences: each change is a full server render of the list; unknown values are passed through and simply match nothing; back/forward work.

Duplicates: `resources/filters.tsx` re-implements `FilterBar` by hand (its own `setFilter`, `hasFilters`, "Clear all"), contradicting the extraction note in `filter-bar.tsx:12-19`. `mentors/need-select.tsx` is a different control (single choice using `SingleSelect`, toggle-off by re-click, `:18-23`).

`resultSummary(count, noun, options)` (`lib/result-summary.ts:7-28`) produces the count sentence. With zero results and no filters it returns `emptyNoFilters`; with filters `No <noun>s match that combination.` unless overridden; otherwise `N noun(s) [qualifier|match your filters].` The pluralisation is `noun + 's'`, so any noun with an irregular plural would render wrongly; none of the current nouns do.

## 3. Events listing

`events/page.tsx` renders `listUpcomingEvents(filters)` (limit 100, sort `startsAt`). "Upcoming" is defined server-side as: `endsAt > now`, or no `endsAt` and `startsAt > now` (`server/content/events.ts:40-55`). Event time is `formatEventTime` (`lib/dates.ts:72-75`): "12 March, 14:30 IST", assembled from `formatToParts` so ICU connector words cannot vary. All dates are pinned to `Asia/Kolkata` (`dates.ts:13`), because the server runs in UTC and an unpinned formatter would show a 22:00 IST deadline as the previous day (`:8-12`). `TYPE_LABELS` is duplicated in `events/page.tsx:16-24` and `events/[slug]/page.tsx:12-20` and again as filter options in `events/filters.tsx:6-14`; `eventType` values not in the map render `undefined` for the tag (the lookup has no fallback beyond `?? 'workshop'` on a missing value, `events/page.tsx:62`).

The homepage "upcoming events" count uses a different rule: `startsAt >= now` only (`ecosystem-counts.ts:34`), so an event in progress is counted by `/events` but not by the homepage figure.

## 4. Event detail and registration

`events/[slug]/page.tsx` (144 lines):
- Finished = `hasPassed(endsAt ?? startsAt)` (`:41`). Finished events show "This event has finished." and a link back; there is no registration or calendar link.
- Full = capacity set, `registeredCount >= capacity` and the visitor is not already registered (`:42`). The count is read at render, so it can be stale by the time the user clicks; the server enforces capacity (`api/events/[id]/register`), and the button surfaces its error text.
- Two registration modes: an external `registrationUrl` renders a plain `<a target="_blank" rel="noopener noreferrer">` (`:118-126`); otherwise `RegisterButton` toggles registration through `/api/events/<id>/register|unregister` (`register-button.tsx:25-43`). The schema stores `registrationUrl` as free `text` (`payload/collections/events.ts:59`); there is no scheme validation, so an editor could save a `javascript:` or `data:` URL. The risk is limited to authenticated staff authors and React's own handling of `javascript:` hrefs, which was not verified here.
- Signed-out click gets a 401 and is sent to `/signup?next=/events/<slug>` (`register-button.tsx:33-36`), which is why that path must survive `safeNext` (E5.04).

## 5. Calendar export

`events/[slug]/calendar.ics/route.ts` (34 lines) and `lib/ics.ts` (79 lines).

- The link is a plain `<a href="/events/<slug>/calendar.ics" download>` (`events/[slug]/page.tsx:130-136`), shown only for unfinished events.
- The route loads the event through the same access-controlled reader as the page, so a draft has no file (`:5-12`). Missing returns `404 Not found`, `cache-control: no-store`.
- `buildIcs` (`ics.ts:55-79`) writes `VCALENDAR` 2.0, `PRODID:-//KNEST//Events//EN`, `METHOD:PUBLISH`, one `VEVENT` with `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`, optional `DESCRIPTION` (the event summary) and `LOCATION`, and `URL`. All times are UTC (`utc()` at `:22-24`) so calendar apps convert to the viewer's zone; nothing depends on the host zone.
- Missing or non-increasing `endsAt` yields a one-hour event (`:20,56-58`; test `ics.test.ts:47-55`).
- Text escaping covers backslash, semicolon, comma and newlines (`:27-29`). Lines are folded at 75 octets using `TextEncoder` so multi-byte characters are never split (`:32-53`), with continuation lines holding 74 plus the leading space.
- `UID` is `event-<id>@<hostname of siteUrl()>` (`route.ts:14-16`): stable per event, so re-importing updates rather than duplicates, but changing the site hostname creates duplicates. `DTSTAMP` is request time.
- Response headers: `text/calendar; charset=utf-8`, attachment with a slug-derived filename (non-alphanumerics replaced, `:29`), `cache-control: public, max-age=300`, `nosniff`.

Limits: `escapeIcsText` does not escape the `URL` value or `UID`; both are controlled (slug and numeric id). The `CRLF` line ending is applied by the final `join('\r\n')` (`:78`). Rich text descriptions are not exported; only the plain `summary`. No `SEQUENCE`, so an edited event time will not update an already-imported entry in all clients. Event time zone is not tied to IST; that is correct for UTC output.

Tests: `ics.test.ts` covers escaping, folding, UTC conversion, default length and omitted fields (`:15-62`). There is no integration test for the route handler or its draft behaviour in the files read.
