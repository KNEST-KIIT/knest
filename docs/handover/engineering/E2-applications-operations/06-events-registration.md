# 06. Events: registration, capacity and calendar

Module: `src/server/events/actions.ts` (121 lines); routes `src/app/api/events/[id]/register/route.ts` and `.../unregister/route.ts`; table `app.event_registrations`; event content from `src/server/content/events.ts`; pages `src/app/(public)/events/[slug]/page.tsx`, `calendar.ics/route.ts`, `src/app/(member)/dashboard/events/page.tsx`.

## 1. Data model

`app.event_registrations` (`src/db/schema/events.ts:16-35` of that file as numbered from its start): `id`, `user_id` (FK to users, cascade), `event_id` (integer, a Payload event id, **no foreign key**), `registered_at`. Unique index `event_registrations_user_event_idx (user_id, event_id)`.

The event itself (title, time, location, capacity, external `registrationUrl`) lives in the CMS `events` collection (`src/payload/collections/events.ts`). Because there is no FK, a registration can outlive its event: deleted or unpublished events simply return null from `getEventById` and are skipped by the dashboard list (`dashboard/events/page.tsx:17-18,42-44`). They still count towards nothing visible but remain in the table and in the analytics truth count (file 10).

## 2. `registerForEvent(eventId: number): Promise<ActionResult>`

`actions.ts:24-76`.

1. `requireUserOrThrow()`.
2. `getEventById(eventId)` through the content layer (`overrideAccess: false`, so a draft event is "doesn't exist", `content/events.ts:73-80`). The function catches every error and returns null, so a CMS outage also reports "That event doesn't exist." (`:73-80`).
3. If the event has a `registrationUrl`, refuse: registration happens on the organiser's page and is not ours to count (`:32-35`).
4. Compute `endsAt = event.endsAt ?? event.startsAt`; if it is in the past, refuse "This event has already taken place." An event is joinable until it ends, or until it starts when no end is given (`:36`).
5. One transaction (`:41-55`):
   - If the event has `capacity`: take `pg_advisory_xact_lock(7101, eventId)` (`:43`, namespace constant `:79`); count registrations; look for this user's own row; if the user is not already registered and `count >= capacity` return `'full'`.
   - `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id`; `'registered'` if a row was returned, `'already'` otherwise.
6. `'full'` returns "This event is full." (`:56`).
7. Only for `'registered'` (a newly created row): build the confirmation, call `notify(...)` (in-app row then e-mail), swallow any error from it, then `track('event_register')`.
8. Return `{ ok: true }`, including for `'already'`.

### Why this shape

- **Capacity (R-05).** Counting then inserting let N simultaneous requests all see one seat left and all take it. The advisory lock serialises registrations for one event for the duration of the transaction, so the count and the insert are consistent. The lock is transaction-scoped (`pg_advisory_xact_lock`) so it is released on commit or rollback and cannot leak. The two-key form uses 7101 as a namespace so event ids do not collide with other advisory locks in the database. Test `26-concurrency.test.ts:87` "never sells more seats than the capacity, however many ask at once".
- **No lock when capacity is unset.** Idempotency then rests entirely on the unique index, which is sufficient: no count is needed.
- **Idempotency.** Registered-already is not an error (`:210`) and, importantly, a full event still answers success to someone who is already registered (the `alreadyRegistered` bypass at `:51`; test `26-concurrency.test.ts:105`).
- **Notification only when a row was created** so double-clicks and two tabs send one e-mail (`:214-217`; test `33-event-notifications.test.ts:61`).
- **Notification failure never undoes the registration** (`.catch(console.error)`, `:73`). Note `notify` writes the in-app row first and then calls `sendNotificationEmail`; if the in-app insert throws, the e-mail is not attempted and only a log line is written. `sendEmail` itself writes to the durable outbox before attempting (`email/send.ts:64-67`).

The lock does not cover other things that could change capacity: the editor lowering `capacity` in the CMS below the current count simply makes the event "full" for new registrants; existing registrations are untouched.

## 3. `unregisterFromEvent(eventId)`

`actions.ts:81-89`: `DELETE WHERE user_id = <session> AND event_id = $1`. No existence check, no past-event check, no audit row, no analytics event, no notification, no lock. Deleting frees capacity and cannot oversell, so no lock is needed. Cancelling a registration for an event that is not registered returns success. The analytics registration event is not removed, which is the cause of the "records removed" line in the analytics reconciliation (file 10).

## 4. Read helpers

| Function | Auth | Behaviour |
|---|---|---|
| `getRegistrationStatus(userId, eventId)` `:91-97` | `requireSelf` | boolean |
| `getRegistrationCount(eventId)` `:99-105` | none | `count(*)`; used on the public page |
| `listRegisteredEventsForUser(userId)` `:107-120` | `requireSelf` | registrations newest first, each joined to its CMS event with one `getEventById` per row (N+1 against the CMS, unbounded by page) |

## 5. Routes

Both routes: `Number(id)` must be an integer else 400 "Invalid event."; then `limitByUser('eventRegister')` (60 per hour refill, `rate-limit.ts:33`); then the action. `UnauthorizedError` becomes JSON 401/403. A refusal from the action is 400. They share the limiter bucket, so register and unregister draw from the same 60.

`Number.isInteger` accepts negative numbers and very large integers; they simply find no event.

## 6. Public event page

`events/[slug]/page.tsx:33-144`:

- Loads the event by slug with depth 2 (`getEventBySlug`, errors caught and logged, null on failure).
- Reads registration count and, for a signed-in user, own status. `full = capacity && count >= capacity && !registered`.
- `finished = hasPassed(endsAt ?? startsAt)`: shows "finished" and hides registration.
- An external `registrationUrl` renders a plain link with `target=_blank rel="noopener noreferrer"`. The collection field is free text (`events.ts:59` of the collection file) so the link is whatever the editor entered; there is no scheme validation in the code read.
- Calendar download links to `/events/<slug>/calendar.ics`.

The page is dynamic because it reads the session. The displayed count and the server's capacity check can differ by the time the person presses the button; the server's answer is authoritative and shows "This event is full."

## 7. Calendar file

`events/[slug]/calendar.ics/route.ts:11-34` (as numbered from the route's first line): reads the event through the same content layer (a draft has no file, 404), builds RFC 5545 text with `buildIcs` (`src/lib/ics.ts`), UID `event-<id>@<site host>`, times in UTC, one hour default when no end, text escaping and 75-octet folding. Response is `text/calendar`, `attachment`, `nosniff`, `Cache-Control: public, max-age=300`. The filename is the slug with non-alphanumerics replaced by `-`. Covered by `src/lib/ics.test.ts`.

## 8. Event listing queries

`src/server/content/events.ts`:

| Function | Lines | Notes |
|---|---|---|
| `listEvents(filters)` | `:18-37` | up to 100, sorted by `startsAt`; filters `eventType`, `format`, `stage` (matched against `relevantStages`) |
| `listUpcomingEvents(filters)` | `:40-71` | `endsAt > now`, or no `endsAt` and `startsAt > now`; up to 100; errors propagate |
| `listRecommendedEvents(stage, limit = 3)` | `:102-110` | events for the stage; if fewer than `limit`, topped up with any other upcoming event so the dashboard is not empty |

All use `overrideAccess: false` with no user, so drafts cannot appear (file 11).

## 9. Defects and limits

- The home page counter of "upcoming events" counts `startsAt >= now` (`src/server/content/ecosystem-counts.ts:34`) while the list uses end time, so an event in progress is in the list but not in the count (file 11).
- The dashboard's past/upcoming split uses `endsAt ?? startsAt` and agrees with registration closing (`dashboard/events/page.tsx:13-18`).
- Waitlist, reminders and attendance for these events do not exist in the code read; "event reminder email" is cited as a reason for the table but no sender was found.
- The N+1 in `listRegisteredEventsForUser` has no cap; a user with many registrations issues that many CMS queries on each dashboard load.

## 10. Tests

`tests/integration/26-concurrency.test.ts:87-130` (capacity, idempotency, past and external events), `33-event-notifications.test.ts:41-74` (one notice and one e-mail, IST time, no repeat, nothing on refusal or cancel), `36-journey-student.test.ts:240,279` (register, see it, cancel frees the place). There is no unit test of `registerForEvent` with mocks.
