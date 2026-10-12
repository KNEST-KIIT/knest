# E3.03 Lab registry, hours, blackouts and the slot engine

Sources: `src/server/labs/manage.ts`, `src/server/labs/rules.ts`, `src/server/labs/service.ts:60-174`, tests `src/server/labs/rules.test.ts`, `rules-edges.test.ts`.

## 1. Time: everything is India Standard Time

`rules.ts:6-8` states the rule: all wall-clock reasoning is in IST (UTC+5:30, no daylight saving) "whatever the server's own clock is set to". `IST_OFFSET_MINUTES = 330` (`rules.ts:10`).

| Function | Lines | What it does |
|---|---|---|
| `istParts(instant)` | 27-34 | Shifts the instant by +330 minutes and reads the UTC fields of the result: IST date string, weekday (0 = Sunday), minute of day |
| `istInstant(date, minute)` | 37-40 | `Date.UTC(y, m-1, d) + minute*60000 - 330*60000`: the instant at which an IST date plus `minute` begins |
| `isValidDateString` | 42-47 | Strict `YYYY-MM-DD`, round-trips through `Date.UTC` so `2026-02-30` is refused |
| `istWeekStart` | 50-54 | The IST Monday of the week containing the instant; weeks run Monday to Sunday |
| `isBlackedOut` | 56 | Inclusive range test on date strings (`date >= startsOn && date <= endsOn`) |

Why it matters: 00:30 IST on a Monday is still Sunday in UTC. The tests pin this (`rules.test.ts:31-37`, `rules-edges.test.ts:30-54`). Date strings compare correctly as strings because they are zero-padded ISO.

The screens format with `Asia/Kolkata` (`src/lib/lab-format.ts`, `src/app/lab-device/pass-panel.tsx:20`).

## 2. Creating and configuring a lab

### 2.1 `createLab` (`manage.ts:47-69`)

- Lab administrators only (`isLabAdmin`: `lab_admin` or `super_admin`, `access.ts:10-12`); others get `UnauthorizedError(403)`.
- Input is the settings schema with `name` required, plus optional `infrastructureId` (positive integer or null).
- The slug is the name lower-cased, NFKD normalised, non-alphanumerics replaced by `-`, trimmed, cut to 60; a collision appends `-2`, `-3`, and so on by probing (`manage.ts:13-19, 55-58`). The probe is a read loop, so two simultaneous creations of the same name can race and one will fail on the unique slug index; the failure is not caught in `createLab` (a 500 rather than a message; not exercised by a test).
- A new lab is "closed in practice": it has no `lab_hours` rows, so no slots exist, and no staff (`LAB-OPERATIONS-GUIDE.md:70`).
- An audit row `lab_created` is written in the same transaction (`manage.ts:63-67`).

### 2.2 `updateLab` (`manage.ts:88-113`)

- Allowed for the lab's head or any lab admin (`requireManager`).
- `isActive` is split out: only an admin may change it (`manage.ts:98`). Moving a lab to another department (`departmentId`) is also admin only (`manage.ts:100`).
- When a department is set without an explicit free-text `department`, the label follows the department's name (`manage.ts:71-81`) so the two do not drift.
- The audit row stores the previous values of exactly the changed keys (`manage.ts:105-110`).
- Changing a policy value does not revalidate bookings that already exist (E3.04).

## 3. Opening hours

`labHours` rows are `(weekday 0-6, opensMinute, closesMinute)`, with `opensMinute < closesMinute <= 1440` (`labs.ts:100-101`). Several windows per day are allowed.

`setLabHours` (`manage.ts:137-151`) **replaces the whole timetable** in one transaction: delete all rows for the lab, insert the new array, write one audit row with only the window count (`after: { windows: n }`, so the audit does not record what the hours were; a previous timetable cannot be reconstructed from the audit trail).

Validation (`manage.ts:115-134`): at most 60 windows; each closes after it opens; two windows on one weekday may not overlap (`x.opens < y.closes && y.opens < x.closes`, so back-to-back windows such as 09:00-12:00 and 12:00-15:00 are permitted).

Existing bookings are not touched: the code comment says "a head cancels any that no longer fit" (`manage.ts:136`).

## 4. Blackouts (closed dates)

`labBlackouts` rows hold an inclusive `starts_on`..`ends_on` date range and a reason (`labs.ts:105-115`). `addBlackout` (`manage.ts:155-169`) validates both dates and order and audits. `removeBlackout` (`171-181`) deletes by id **and** lab id, so a head cannot remove another lab's closure by guessing an id.

Effect of a blackout:

- Slot generation returns nothing for blacked-out dates (`rules.ts:68`).
- New requests for that date are refused (`rules.ts:111`).
- A head cannot approve a `requested` booking that now falls on a blacked-out date (`service.ts:223-227`).
- An accepted alternative is re-validated against the current blackouts (`service.ts:286-290`).
- **Already approved bookings are not cancelled or flagged** by a new blackout. `addBlackout` does not look at bookings at all. The head must cancel them. The operations guide covers this from the person's side; in code there is no warning that approved bookings exist on the new closed dates.

## 5. The slot engine

### 5.1 `generateSlots` (`rules.ts:66-83`)

Inputs: policy, the lab's hours, blackouts, an IST date, `now`.

1. Return `[]` if the date string is invalid or blacked out.
2. Weekday is taken from `istParts(istInstant(date, 12*60))`, that is noon IST, not midnight. Noon cannot be pushed across a date line by the offset arithmetic.
3. `earliest = now + minLeadMinutes`, `latest = now + maxHorizonDays * 24h` (a rolling horizon in milliseconds, not calendar days).
4. For each window of that weekday, ordered by opening time, cut back-to-back slots of `slotMinutes` from the window's opening minute while `start + slotMinutes <= closesMinute`. A final partial slot is not offered. Slots whose start is before `earliest` or after `latest` are skipped.

Because slots are cut from each window's own opening time, changing a window to open at 09:30 shifts every boundary (`rules-edges.test.ts:152`).

### 5.2 Availability (`service.ts:75-85`)

`getAvailability` generates the slots, loads live bookings (`requested`, `approved`, `alternative_proposed`) whose range intersects the slots' overall span, and returns each slot with `free = no live booking overlaps it`. No booker is identified. Only active labs are visible (`getLabBySlug` filters `is_active`, `service.ts:64-66`).

`overlaps` is the strict half-open test (`rules.ts:85`).

### 5.3 `problemWithRequest` (`rules.ts:93-127`)

Returns one human message or null. The checks run in this order, which matters for what a person is told:

| # | Check | Message (abridged) |
|---|---|---|
| 1 | Both instants valid | "Choose a start and an end time." |
| 2 | `end > start` | "The end time must be after the start time." |
| 3 | `headcount` integer >= 1 | "Say how many people will use the space." |
| 4 | `headcount <= capacity` | "This space holds N people at a time." |
| 5 | Start and end on the same IST day (the last millisecond is used so an end of exactly 00:00 counts as the previous day, line 109) | "A booking must start and end on the same day." |
| 6 | Date not blacked out | "The lab is closed on that day." |
| 7 | Length is an integer number of minutes and a multiple of `slotMinutes` | "Bookings are made in blocks of N minutes." |
| 8 | Blocks <= `maxConsecutiveSlots` | "You can book at most N consecutive blocks at once." |
| 9 | One window of that weekday contains the whole range | "That time is outside the lab's opening hours." |
| 10 | `(startMinute - windowOpens) % slotMinutes == 0` | "Pick a start time on the lab's block boundaries." |
| 11 | `start >= now + minLeadMinutes` | "Bookings must be made at least X ahead." |
| 12 | `start <= now + maxHorizonDays` | "Bookings open up to N days ahead." |

A booking cannot span two windows even when they touch, because check 9 requires containment in one window (`rules-edges.test.ts:159`). The longest allowed booking is `maxConsecutiveSlots * slotMinutes`.

### 5.4 Person limits (`service.ts:133-148`, `rules.ts:138-144`)

Inside the insert transaction:

1. The booker's `users` row is locked `FOR UPDATE` (`service.ts:135`). Why: two browser tabs from one person would otherwise both count the limits before either inserts and both slip under them. The lock serialises one person's requests.
2. Open requests: bookings of that person at that lab in `requested` or `alternative_proposed`; refuse when `>= maxOpenRequests`.
3. Weekly hours: all of that person's live bookings at that lab (no date filter in the query), then those whose `startsAt` falls in the same IST Monday-to-Sunday week as the request are summed with the request; refuse when the total exceeds `maxHoursPerWeek` (`rules.ts:138-144`).

Both limits are per lab, not per person overall. A person can hold `maxOpenRequests` pending requests at each lab.

### 5.5 Eligibility (`service.ts:123-126`)

Account must be active and have a verified e-mail. When the lab's eligibility is `onboarded` (the default), the profile must also be completed (`onboardingCompletedAt`). Pages additionally require an onboarded user (`requireOnboardedUser`). Note the screen path is stricter than the API for labs set to `verified`: the dashboard pages call `requireOnboardedUser`, so a not-onboarded user cannot reach the booking page of a `verified` lab, though the API would accept them.

### 5.6 Request schema (`service.ts:89-95`)

`startsAt` and `endsAt`: ISO datetimes with offset. `purpose`: trimmed, 5 to 500 characters. `headcount`: integer 1 to 500. `equipment`: up to 300 characters, optional.

### 5.7 Full order inside `requestBooking` (`service.ts:109-174`)

flag -> session -> lab lookup -> schema -> account eligibility -> `problemWithRequest` -> transaction (user lock, open count, weekly hours, insert, notify heads) -> after commit, e-mail the heads. E-mail is sent after commit, never inside the transaction (`service.ts:171-172`). The notification rows are written inside the transaction, so a committed booking always has its in-app notice for each head.

## 6. What is not enforced anywhere

- A new request can never start in the past (check 11, and `minLeadMinutes >= 0` is a database check). A head can still **approve** a request whose start has since passed: `decideBooking` has no such check (E3.11, D-03).
- There is no cap on the number of labs, bookings per day per lab, or on a person's total bookings across labs.
- Hours and blackouts have no effective-from date; an edit applies immediately to availability.
