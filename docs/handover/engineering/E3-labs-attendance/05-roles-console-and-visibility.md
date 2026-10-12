# E3.05 Roles, the head console, assistants and who can see what

Sources: `src/server/labs/access.ts`, `manage.ts:183-221`, `service.ts:392-569`, `src/app/(member)/dashboard/lab-staff/**`, `src/app/(staff)/admin/labs/**`, tests `34-lab-booking.test.ts:82-130, 352-364, 512-573`.

## 1. Where a lab role comes from

There are two independent sources and they are combined per request by `actorFor(labId)` (`access.ts:32-36`):

| Source | Values | Scope | Stored in |
|---|---|---|---|
| Console staff role on the user | `lab_admin`, `super_admin` count as lab administrators (`access.ts:10-12`) | every lab | `users.staff_role` |
| Lab role | `head`, `assistant` | one lab | `lab_staff (lab_id, user_id, role)`, unique per pair (`labs.ts:127`) |

"A lab role comes only from [`lab_staff`]; it does not need a staff role in the console" (`labs.ts:117`). A head or assistant is an ordinary member account.

`LabActor = { id, staffRole, isAdmin, role }`. Two predicates drive everything:

- `canManage(actor) = isAdmin || role === 'head'` (`access.ts:39`): decide, cancel, configure, report.
- `canStaff(actor) = isAdmin || role !== null` (`access.ts:42`): see assigned bookings, mark attendance (subject to assignment).

Note that `canStaff` is true for a lab administrator of any lab, so the per-lab console opens for admins everywhere.

## 2. Capability matrix

| Capability | Booker (any member) | Assistant of the lab | Head of the lab | Lab administrator |
|---|---|---|---|---|
| See active labs, rules and free/busy slots | yes | yes | yes | yes |
| Request a booking | yes, if eligible | yes, as a member | yes | yes |
| See own bookings | yes | yes | yes | yes |
| See bookings of others in the lab (name and e-mail) | no | only those assigned to them | all of the lab | all of every lab |
| Decide a request | no | no (403) | yes | yes; reason required if the lab has a head |
| Cancel someone else's booking | no | no | yes, with reason | yes, with reason |
| Mark attendance | no | only assigned bookings | any booking of the lab | any |
| Edit lab settings, hours, closed dates | no | no | yes | yes |
| Open or close a lab (`isActive`), move it between departments | no | no | no | yes |
| Add or remove an assistant | no | no | yes | yes |
| Appoint or remove a head | no | no | no | yes |
| Create a lab, manage departments | no | no | no | yes |
| Utilisation report | no | no | own labs | all labs |
| See escalated requests | no | no | no | yes (`listEscalations`) |
| Roster and desk code for QR scanning | no | assigned bookings | own labs' approved bookings | all approved bookings |
| Decide a held QR scan | no | no | yes | yes |

Sources for the cells: `service.ts:199-205, 327-331, 370`; `manage.ts:92, 98, 100, 193, 215`; `reports.ts:54-58`; `service.ts:474`; `attendance-qr.ts:234-250, 551`.

## 3. The lab console

Route `/dashboard/lab-staff/[slug]`.

**Gate.** `layout.tsx:12-17` runs before the page streams: feature flag, lab exists and is active, `actorFor` succeeds, `canStaff`; otherwise `notFound()`. A non-staff user therefore gets a real 404 with no hint the lab exists (test `34:529-546`). `LabConsolePage` repeats the check (`page.tsx:34-35`).

**Sections** (`page.tsx`):

| Section | Shown to | Data |
|---|---|---|
| Requests waiting | managers | `listLabBookings(labId, 'open')`: `requested` and `alternative_proposed`, oldest start first, limit 200 |
| Approved and coming up | all staff | `approved` with `endsAt >= now`; assistants filtered to their assignments |
| Recent history | all staff | `rejected`, `cancelled`, and `approved`/`completed`/`no_show` that ended, newest first, first 30 shown |
| Decision history | managers | `listDecisionHistory`, from `audit_logs` |
| Rules and details, Opening hours, Closed dates, Head and assistants | managers | the forms in `controls.tsx` |

For a request in `alternative_proposed` the console shows only "Waiting for them to answer your suggestion" and no controls (`page.tsx:91-99`). The API would still accept `reject` for that state (`rules.ts:153`); no screen offers it.

Controls call the single endpoint `/api/labs/[slug]/manage` with `{action, ...}` (`controls.tsx`, `manage/route.ts:14-29`). A head can edit and manage; the `isActive` checkbox is rendered only for admins (`controls.tsx:268, 322`).

## 4. Assistant roster and visibility

- **Console:** an assistant's lists are `assistant_user_id = me` for "upcoming" and "past", and the "requests waiting" and "decision history" sections are not rendered for them (`page.tsx:38-46`). The page says so to the user (`page.tsx:74`). The earlier design note listing this as a gap (`LAB-BOOKING-DESIGN.md:167`) is out of date: the code does filter.
- **What an assistant sees about a person:** booker name and e-mail for their assigned bookings (`who(memberName, memberEmail)`, `page.tsx:59, 85, 117`). The QR roster sends only the display name, never e-mail (`attendance-qr.ts:220`).
- **Duties list:** `listRoster(userId)` returns approved bookings with `assistant_user_id = me` and `endsAt >= now` across labs (`service.ts:432-440`), shown on `/dashboard/lab-staff` as "Your duties coming up".
- **Availability** never names anyone (`service.ts:74`).
- **Existence hiding:** cancel, respond and the checks endpoint return `not-found`, not `forbidden`, for a booking the caller may not see (`service.ts:281, 327`; `attendance-qr.ts:340`).

What assignment does *not* do: removing a person from `lab_staff` does not clear `assistant_user_id` on bookings (`manage.ts:216-219` deletes only the staff row). The removed person loses `labRoleFor`, so manual attendance (`requireStaffOfLab`) and QR scans (`not-staff`) fail for them, and the booking stays assigned to someone who can no longer act on it. A head or admin can still close it out (D-07).

## 5. Staff management rules (`manage.ts:183-221`)

- Input: e-mail (lower-cased) and role.
- Only an administrator may appoint a head (`manage.ts:193`); only an administrator may remove a head (`215`). A head may add and remove assistants.
- The person must already have an active account (`No active account has that email address`) and a verified e-mail (`manage.ts:195-197`).
- Re-adding a person with a different role changes their role in place; the same role returns a `state` error (`manage.ts:199-207`). Audit rows `lab_staff_added`/`lab_staff_removed` carry before and after.
- A lab can have several heads. `isEscalated` and the override rule treat "has a head" as "has at least one".

## 6. Escalation

`isEscalated` (`rules.ts:173-178`), for a booking with status `requested` only:

- no head on the lab: escalated immediately, reason `no_head`;
- otherwise escalated when `now - createdAt >= escalateAfterHours` (default 48), reason `waiting`.

`listEscalations` (`service.ts:472-516`): administrators only (others receive `[]`, line 474); rows are `requested` bookings of active labs whose start is still in the future (line 492), oldest first, limit 200, one extra query for which labs have heads. It is displayed on `/admin/labs` as "Needs an administrator (N)" with a link to the lab console (`admin/labs/page.tsx:35-59`).

Limits worth knowing: escalation is a list, not a notification; nothing is e-mailed to administrators when a request escalates. A request leaves the list silently when its start time passes. Escalation does not change who may decide; it only surfaces the request to an admin, who then decides through the normal path with the mandatory override reason (E3.04 section 3).

## 7. Closed labs: one-way door

`getLabBySlug` returns only active labs (`service.ts:64-66`). The console layout, every `manage` action (the route looks the lab up by slug first, `manage/route.ts:10-12`) and the booking pages all depend on it. An administrator who clears "Open for booking" therefore makes the lab's own console answer 404, and the "Open console" link on `/admin/labs` (`admin/labs/page.tsx:103`) leads there. No screen or route re-opens it (D-01). The operations guide carries the same warning (`LAB-OPERATIONS-GUIDE.md:77-81`).
