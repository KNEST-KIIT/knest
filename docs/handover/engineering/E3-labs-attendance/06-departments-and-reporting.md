# E3.06 Departments hierarchy and utilisation reporting

Sources: `src/server/labs/departments.ts`, `department-admin.ts`, `reports.ts`, `src/app/api/admin/lab-departments/route.ts`, `src/app/(staff)/admin/labs/departments.tsx`, `src/components/labs/report-table.tsx`, tests `departments.test.ts`, `34-lab-booking.test.ts:441-510`.

## 1. The hierarchy is data

`lab_departments (id, slug, name, parent_id)` is a self-referencing tree (`labs.ts:27-42`). A reorganisation is an edit in `/admin/labs`, not a code change. A lab points at a department through `labs.department_id`; the older free-text `labs.department` label is kept "for display and for labs not yet placed in the hierarchy" (`labs.ts:52`). The two are kept consistent only by `departmentPatch`, which copies the department's name into the label when the lab is placed without an explicit label (`manage.ts:71-81`). Nothing updates labels when a department is renamed.

## 2. Pure functions (`departments.ts`)

| Function | Lines | Behaviour |
|---|---|---|
| `ancestorIds(departments, id)` | 9-20 | Walks `parentId` upward, nearest first. Stops at a missing parent and at any node already seen, so a cycle in the data cannot loop |
| `wouldCreateCycle(departments, id, newParentId)` | 23-27 | True when the new parent is the node itself or one of its descendants (the node appears among the new parent's ancestors) |
| `orderTree(departments)` | 32-48 | Depth-first, siblings sorted by name (`localeCompare`), producing `depth`. A department caught in a cycle, or with a dangling parent, is shown as a root rather than hidden |
| `rollUp(departments, rows, keys)` | 55-74 | For each lab row with a known `departmentId`, adds the lab's numbers to its department and every ancestor; `labs` counts labs at or below. Returns departments that have at least one lab, in tree order. Labs with no or unknown department are not in the roll-up |

Why `orderTree` and `ancestorIds` defend against cycles even though writes refuse them: the database allows any parent that exists (`labs.ts:28-31`), so a cycle could arrive by a manual edit or by a race (section 3). Reading must never hang.

## 3. Administering departments (`department-admin.ts`)

All three operations require a lab administrator (`requireAdminUser`, lines 22-26) and write an audit row in the same transaction.

- **create** (38-57): name 2 to 100 characters; optional parent must exist; slug from the name with `-2`, `-3` probing against all existing slugs (47-49). Names are not unique; two departments of the same name get different slugs.
- **update** (60-80): rename and/or re-parent. A re-parent runs `wouldCreateCycle` against a snapshot of the whole table read just before (64, 71). The check and the update are not in one transaction and take no lock, so two administrators re-parenting two departments at the same moment could each pass the check and together create a cycle. The read side tolerates this (section 2). The race is not exercised by a test.
- **delete** (83-92): removes the row. Foreign keys are `set null`: its children become top-level and its labs become unplaced (`labs.department_id` null); no lab or booking is deleted. The free-text `labs.department` label is **not** cleared, so the report's "by label" table still shows the old name.

Route: `POST /api/admin/lab-departments {action: create|update|delete}`, through `labRoute` (so it also needs the booking flag) (`route.ts:9-23`).

## 4. The utilisation report (`reports.ts`)

### 4.1 Who and what range

- Administrators see every lab (including inactive ones, because the query reads `app.labs` directly). A head sees only labs where they are head; a request naming another lab raises 403 (`reports.ts:54-58`). An assistant or member gets 403.
- `from` and `to` are IST dates, `to < from` is an error. The range is `[istInstant(from), istInstant(to) + 24h)` (`reports.ts:61-62`): the whole last day is included.
- A booking is attributed to the range its **current `starts_at`** falls in (`reports.ts:79`).

### 4.2 The query (`reports.ts:66-84`)

One SQL statement: `app.labs l LEFT JOIN app.lab_bookings b ON b.lab_id = l.id AND b.starts_at in range LEFT JOIN app.lab_attendance a ON a.booking_id = b.id`, grouped by lab. Because both joins are left joins and the lab id list is parameterised (`sql.join`, line 65), labs with no bookings still appear with zeros.

| Column | Definition |
|---|---|
| `requests` | count of every booking that starts in range, whatever its status (including `requested` and `alternative_proposed`) |
| `approved` | status in `approved`, `completed`, `no_show` ("approved and not since cancelled or rejected", `reports.ts:45-47`) |
| `rejected`, `cancelled` | by status |
| `attended` | status `completed` |
| `noShows` | status `no_show` |
| `hoursBooked` | sum of `(ends_at - starts_at)` in hours over `approved` + `completed` + `no_show` |
| `hoursAttended` | the same sum over `completed` only |
| `manualEntries` | `lab_attendance` rows with `method = 'manual'` |

Properties: figures reconcile with a direct count (test `34:464`); nothing is estimated (`reports.ts:47-48`). Important limits:

- `hoursAttended` is the booked duration of completed bookings, not time actually present. A QR check-out is recorded in `lab_qr_checks` but is not read by the report.
- There is no column for QR-sourced attendance. With QR on, `attended` includes QR-verified check-ins and `manualEntries` counts only the manual ones; QR rows are not reported separately (D-08). The doc comment still says manual entries "are the only attendance source until automated check-in exists" (`reports.ts:48-50`).
- A booking whose `starts_at` was moved by an accepted alternative is counted at its new start.
- Counting is by status now, so a booking that was approved and later cancelled appears only as `cancelled`.

### 4.3 Aggregation in code (`reports.ts:102-140`)

- `labs`: one row per lab.
- `departments`: grouped by the **free-text label** (`row.department`).
- `rollup`: by the hierarchy via `rollUp`, each department including its descendants; `labs` is the number of labs at or below.
- `totals`: the sum over `labs` rows (not over `rollup`, which would double count).
- Hours are rounded to two decimals at each level.

### 4.4 CSV (`reports.ts:143-157`, route `api/labs/report.csv`)

- First block: one row per lab with 11 columns (Department, Lab, Requests, Approved, Rejected, Cancelled, Attended, No-shows, Hours booked, Hours attended, Manual attendance entries). If a rollup exists, a blank row then a second block with Department (including those below it), Level, Labs and the same figures.
- Line endings `\r\n`, including a trailing one.
- **Formula injection:** a cell whose text starts with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'` before quoting, so a lab named `=HYPERLINK(...)` is inert in a spreadsheet (`reports.ts:145-146`; test `34:503`). Cells containing `,`, `"` or newline are quoted with doubled quotes.
- The response sets `content-disposition: attachment`, `cache-control: private, no-store`, `x-content-type-options: nosniff` (`report.csv/route.ts:14-20`). The route reads `lab` from the query string; head scoping is enforced inside `labReport`, not by the route.

## 5. Screens

`/dashboard/lab-staff/[slug]/report` (head or admin; default range the last 30 days to today, IST) and `/admin/labs/report` render `ReportTable` and offer the CSV link. Not reviewed further here.
