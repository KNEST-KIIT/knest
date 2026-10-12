# 01. Applications: data model, program questions and lifecycle

Scope: the tables behind an application, where the question set comes from, how "is this program open" is decided, and the status state machine. Behaviour of the applicant and staff operations is in files 02 and 03.

All paths are relative to the repository root. Line ranges refer to the base branch `codex/production-v1` at commit `383abf9`.

## 1. Tables

Defined in `src/db/schema/applications.ts`, schema `app` (`src/db/schema/enums.ts:11`).

| Table | Purpose | Key constraints |
|---|---|---|
| `app.applications` | One row per (user, program) | PK `id` (text UUID); `user_id` FK to `users` with `ON DELETE CASCADE` (`applications.ts:21-23`); unique index `applications_user_program_idx (user_id, program_id)` (`:43`); indexes on `program_id` and `status` (`:44-45`) |
| `app.application_answers` | One row per answered question | FK `application_id` cascade; unique `(application_id, question_id)` (`:69-71`); `value` is `jsonb NOT NULL` (`:66`) |
| `app.application_documents` | One row per uploaded file | FK `application_id` cascade; unique `(application_id, question_id)` (`:91-93`); `storage_key`, `file_name`, `mime_type`, `file_size` (integer) all NOT NULL (`:83-89`) |

Columns on `applications` worth knowing (`applications.ts:18-38`):

- `program_id` is an `integer` holding a Payload document id. There is deliberately no foreign key, because the `cms` and `app` schemas have independent migrations (`:7-14`). Integrity is enforced in application code instead: `startApplication` checks the program exists (`src/server/applications/actions.ts:54-56`) and a Payload `beforeDelete` hook on `programs` refuses to delete a program that has applications (`src/payload/collections/programs.ts:43-58`, HTTP 409, "Unpublish it instead").
- `status` is the `app.application_status` enum, default `draft` (`enums.ts:76-85`).
- `submitted_at` is set only by `submitApplication`. `decision_at` is set only when the new status is `accepted` or `rejected` (`src/server/applications/review.ts:151,161`).
- `decision_note` is "staff-facing only, never surfaced to the applicant" (`applications.ts:28-29`). Nothing in the files read renders it back to anyone: the review detail page does not display it, and it appears only inside the `after` JSON of the audit row (`review.ts:175`) and in the column itself.
- `question_snapshot` is `jsonb` of `ApplicationQuestion[]`: the questions exactly as they stood at submit. It is null on drafts and on rows submitted before the column existed (`applications.ts:30-36`).

`answer.value` shape per field type (comment at `applications.ts:65`): string for `text`, `textarea`, `select`, `url`; `string[]` for `multiselect`. The `file` type stores nothing in this table (see file 02, section 4).

## 2. Where the question set lives

Questions are not in code or in the `app` schema. They are the `applicationQuestions` array on the Payload `programs` collection (`src/payload/collections/programs.ts:175-238`). Each array item has `label`, `helpText`, `fieldType` (`text | textarea | select | multiselect | url | file`), `options[]` (`label`, `value`), `required` (default true), `maxLength`.

Two design rules that the rest of the module depends on:

1. **Answers are keyed by Payload's generated array-item id**, not by position or label. The collection description states reordering or editing leaves the link to submitted answers intact (`programs.ts:178-181`). `mapProgram` reads that id with a non-null assertion (`q.id!`, `src/server/applications/program-questions.ts:81`); an item without an id would carry `undefined` as its id, and no answer could be matched to it (the routes compare against a string). Not determined from the code whether Payload can ever return an array item without an id for this adapter.
2. **Option `value` is a stable identifier**, auto-filled from the label when blank (`programs.ts:210-226`) and stored on answers. Editing a label later does not orphan answers.

`src/server/applications/program-questions.ts` is "the single place that reads a program's question set" (`:13-14`). Both the applicant form and server-side validation read through it, so they cannot drift.

| Function | Access mode | Returns | Notes |
|---|---|---|---|
| `getApplicationProgram(programId, { includeUnpublished? })` (`:22-36`) | `overrideAccess: true` only when `includeUnpublished === true`, otherwise `false` | `ApplicationProgram \| null` | Uses `find` with `where id equals`, not `findByID`, because `findByID` throws NotFound and an unpublished program used to turn into a 500 on every page touching an existing application (R-04, `:16-21`) |
| `getApplicationProgramBySlug(slug)` (`:43-54`) | `overrideAccess: false` | `ApplicationProgram \| null` | Public view only: an unpublished program is invisible to the applicant |
| `getProgramTitlesByIds(ids)` (`:93-112`) | `overrideAccess: false` | `Map<id, {title, slug}>` | One batched query; see defect D-1 in file 15 |

`ApplicationProgram` is `{ id, title, slug, applicationStatus, applicationDeadline: string | null, questions }` (`:4-11`). `applicationStatus` is one of `open | opening_soon | closed | in_progress` (`:8`).

## 3. "Is this program accepting applications": `closedReason`

`src/server/applications/availability.ts:11-22`.

```
closedReason(program: { applicationStatus: string; applicationDeadline: string | null }, now = new Date()): string | null
```

- Returns a sentence when `applicationStatus !== 'open'` ("Applications for this program aren't open right now.") or when a deadline exists and `new Date(deadline) < now` ("... closed on <date>").
- Returns `null` when open. A program with status `open` and no deadline is open indefinitely.
- The comparison is strict `<`, so an application at exactly the deadline instant is still accepted.
- The deadline string is parsed with `new Date()`; the timezone interpretation therefore comes from the ISO string the CMS stores. Not determined from this file what zone editors intend (the CMS field is edited through Payload's date picker).

Call sites (all must agree, which is the point of centralising it, `availability.ts:3-9`):

| Caller | File:line | Effect when closed |
|---|---|---|
| `startApplication` | `actions.ts:57-58` | Refuses to create a draft |
| `saveAnswer` | `actions.ts:123-125` | Refuses; message says the draft is kept |
| `uploadDocument` | `actions.ts:172-174` | Same |
| `submitApplication` | `actions.ts:242-243` | Refuses to submit |
| `/apply/[program]` page | `src/app/(member)/apply/[program]/page.tsx:35,48-66` | No draft: redirect to the program page. Existing draft: "is closed" panel |

The public program page's `ApplyCta` does not call `closedReason` (see D-4).

## 4. Status state machine

Source of truth: `ALLOWED_TRANSITIONS` in `src/server/applications/transitions.ts:13-22`.

| From | Permitted next statuses | Triggered by |
|---|---|---|
| `draft` | `submitted` | Applicant, via `submitApplication` |
| `submitted` | `under_review`, `rejected` | Staff |
| `under_review` | `shortlisted`, `rejected` | Staff |
| `shortlisted` | `interview`, `rejected` | Staff |
| `interview` | `accepted`, `rejected`, `waitlisted` | Staff |
| `waitlisted` | `accepted`, `rejected` | Staff |
| `accepted` | none (terminal) | |
| `rejected` | none (terminal) | |

```
draft -> submitted -> under_review -> shortlisted -> interview -> accepted
              |            |               |             |  \-> waitlisted -> accepted
              |            |               |             |             \-----> rejected
              \------------\---------------\-------------\-> rejected
```

Properties, each backed by `transitions.test.ts`:

- Nothing returns to `draft`, nothing transitions to itself, nothing leaves `accepted` or `rejected` (`src/server/applications/transitions.test.ts:25-36, 51-55`; see file 14).
- There is no edge from `submitted` straight to `accepted` or `waitlisted`.
- `waitlisted` is reachable only from `interview`.
- `nextStatuses(from)` (`transitions.ts:28-30`) drives the dropdown in the review UI, so the UI offers only legal moves; the server re-checks in `changeApplicationStatus` (`review.ts:126-131`).

Important limitation in how the table is used: `isLegalTransition('draft', 'submitted')` is true, and `changeApplicationStatus` does not exclude a draft source or the `submitted` target. See defect D-2 in file 15.

Who may move what: the table says "every other edge is staff-triggered" (`transitions.ts:6-9`). The staff roles allowed are `program_manager`, `reviewer` and `super_admin` (`src/server/auth/roles.ts:17`).

## 5. What the applicant may see after submission

`getOwnedApplicationDetail` (`actions.ts:340-366`) returns the program with `questions` replaced by `question_snapshot` when one exists (`:352-353`). The applicant therefore sees the questions they actually answered, not the program's current ones. The status route and review pages do the same for staff (`review.ts:84-93`).

Where a snapshot exists but the program has been deleted or unpublished, review fabricates a program object with title "Program no longer available", empty slug, `applicationStatus: 'closed'` (`review.ts:85-93`).
