# 10. Notifications

Files: `src/server/notifications/send.ts`, `actions.ts`, `templates.ts`; `src/db/schema/notifications.ts`; route `src/app/api/notifications/[id]/read/route.ts`.

## Model

A notification is two independent things written for the same event: an in-app row in `app.notifications` and an e-mail through `sendEmail` (file 09). Spec section 25 wants both channels for application status changes; the code keeps them separate so each stays readable and so the e-mail can follow the database commit (`notifications.ts` schema comment, `send.ts:19-27`).

## Write side (`send.ts`)

```
type NotifyInput = { userId; type: notificationType; title; body; href?; applicationId?;
                     email: { subject; text } }                                  :9-17
```

| Function | Line | Signature | Behaviour |
|---|---|---|---|
| `writeNotification` | `:28-37` | `(dbClient: db \| tx, input) => Promise<void>` | Inserts the row only. Accepts a transaction so the row commits atomically with the change it describes |
| `sendNotificationEmail` | `:44-57` | `(userId, email) => Promise<void>` | Looks up the user's address; no user means return silently; sends via `sendEmail` and catches and logs failure. Never throws |
| `notify` | `:65-68` | `(input) => Promise<void>` | `writeNotification(db, ...)` then `sendNotificationEmail`. For callers not in a transaction |

Why the split: an e-mail must never roll back a transaction it is not part of, and a transaction must never hold a database connection open across a network call (`send.ts:19-27`). Callers inside a transaction call `writeNotification(tx, ...)` and, after commit, `sendNotificationEmail`.

Recipient address is read from `users.email` at send time; callers never pass an address, so a notification cannot be redirected by caller input.

Errors: `notify` can throw if the row insert fails; the e-mail half cannot throw. The event registration caller wraps `notify` in its own `.catch` so a failed notice never undoes the registration (`events/actions.ts:63-71`).

### Callers

| Event | Type | Pattern | File:line |
|---|---|---|---|
| Application submitted | `application_received` | row in the submit transaction, e-mail after commit | `applications/actions.ts:311`, `:317` |
| Application status changed by reviewer | `application_status_changed` | row in the review transaction, e-mail after | `applications/review.ts:178`, `:185` |
| Event registration (only when a registration was actually created) | `event_registered` | `notify` | `events/actions.ts:63` |
| Lab booking requested, decided, alternative proposed, cancelled | `booking_*` | rows via `notifyMany` (optionally in a transaction), e-mails via `emailMany` after | `labs/service.ts:97-101`, `:268`, `:272` |

`application_deadline_reminder` is a value of the enum (`enums.ts:97-106`) but no code in `src` writes it. Reminders are not implemented (L-15).

## Templates (`templates.ts`)

All links are absolute through `absoluteUrl(path)` (`site-url.ts:56-58`), because a bare path in an e-mail is not a link (test `templates.test.ts:10`).

| Function | Subject | Notes |
|---|---|---|
| `applicationReceivedTemplate(program)` | "We've got your application to {program}" | Links to `/dashboard/applications` |
| `applicationStatusChangedTemplate(program, status)` | `Your application to {program} — an update` for every status | Identical subject by design; the outcome is in the body, which is read after opening (`:4-11`, test `templates.test.ts:17`). Body per status in `STATUS_BODY` for all eight statuses |
| `eventRegisteredTemplate({title, when, location?, path})` | "You're registered: {title}" | Time pre-formatted in IST by the caller |
| `bookingRequestedTemplate`, `bookingDecidedTemplate`, `bookingAlternativeTemplate`, `bookingCancelledTemplate` | lab-specific | Decision text includes the lab head's free-text note or reason when present |

The subject of booking and event mails includes content that is not user-controlled except the free-text `purpose` and notes in bodies (plain text, not HTML, so no markup injection). Program and lab names come from the CMS or database.

## Read side (`actions.ts`)

| Function | Line | Authority | Behaviour |
|---|---|---|---|
| `listNotificationsForUser(userId, limit = 10)` | `:15-22` | `requireSelf(userId)` | Newest first |
| `countUnread(userId)` | `:24-31` | `requireSelf(userId)` | Count where `read_at IS NULL` |
| `markNotificationRead(notificationId)` | `:34-45` | `requireUserOrThrow()` | Finds the row by id AND `user_id = session user`; not found returns `{ok:false, error:'Notification not found.'}` so an id belonging to someone else is indistinguishable from a missing one; then sets `read_at = now()` |

The files import `server-only`. `countUnread` is called in the dashboard and public layouts for every signed-in render (`(member)/dashboard/layout.tsx:18`, `(public)/layout.tsx:11`), so each page view costs one count query served by the `(user_id, read_at)` index.

Route `POST /api/notifications/[id]/read`: `limitByUser('notificationRead')` (300 per hour), then `markNotificationRead`; `UnauthorizedError` becomes the carried status with "Sign in to continue."; a not-found result is 400.

Gaps: there is no "mark all read", no deletion, no pagination beyond the `limit` argument, no retention or purge of old notifications, and no per-user channel preferences.

## Tests

- `templates.test.ts`: absolute origin with trailing slash tolerated; subject identical across outcomes.
- `tests/integration/33-event-notifications.test.ts`: one in-app notice and one e-mail with absolute link and IST time; no repeat for the same person registering twice or from two tabs; shown on the dashboard; cancel and refused registration send nothing.
- `tests/integration/26-concurrency.test.ts:133`: two simultaneous reviewers move an application once with one audit row and one notice.
- `guards.test.ts:13-28` for the `requireSelf` rule the read functions rely on.
- No unit test of `markNotificationRead` ownership was located; the ownership predicate is in the query.
