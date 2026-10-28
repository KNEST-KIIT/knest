# 03. Review console

> **Superseded in part on 2026-10-28.** The staff download no longer uses `getFile`. Both the applicant and the staff routes serve through `serveDocument` (`src/server/applications/document-response.ts`): pending answers 423, a rejected file answers 404, and a clean file is read from the **clean** bucket at the version recorded when it was promoted. See [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](../../../delivery/MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md), section 7.

Module: `src/server/applications/review.ts` (191 lines), `review-constants.ts`, `transitions.ts`; pages under `src/app/(staff)/admin/applications/`; routes `src/app/api/admin/applications/[id]/status/route.ts` and `.../documents/[questionId]/route.ts`.

The console is a custom shell for operational data that lives in the `app` schema, separate from Payload's own admin (`src/app/(staff)/admin/layout.tsx:8-15`). Staff reach CMS content through the "Full admin" link in the same header (`layout.tsx:51-53`).

## 1. Who may do what

| Capability | Area | Staff roles that pass | Enforced by |
|---|---|---|---|
| See queue and detail pages | `applications` | `program_manager`, `reviewer`, `super_admin` | `applications/layout.tsx:7-10` (404 for others) and again inside `listApplicationsForReview` / `getApplicationForReview` via `requireAdminArea('applications')` (`review.ts:28,68`) |
| Change status | `applications` | same | `requireStaffOrThrow('applications')` (`review.ts:117`) |
| Download a document | `applications` | same | `requireStaffOrThrow('applications')` in the route (`documents/[questionId]/route.ts:19`) |

Area to role mapping: `src/server/auth/roles.ts:14-31`; `super_admin` passes every area (`roles.ts:37`). Roles are read from the database on every session read (`src/server/auth/config.ts:39-83`), so a demotion applies on the next request even before sessions are revoked.

Two guard flavours, deliberately different:

- Page code uses `requireStaff` / `requireAdminArea`, which call `notFound()`. A non-staff visitor sees a 404, not a 403, so the existence of `/admin` is not confirmed (`guards.ts:64-80`).
- Route handlers use `requireStaffOrThrow`, which throws `UnauthorizedError` so the handler can answer JSON 401/403. The comment at `review.ts:104-111` records that the route once used the page-flavoured guard and answered an empty-body 404 to non-staff.

The guard lives in a layout (`applications/layout.tsx:1-10`) so a role without access gets a real 404 status before any of the page streams. The functions repeat the check so they are safe if called from elsewhere.

## 2. Queue: `listApplicationsForReview`

`review.ts:27-65`.

```
listApplicationsForReview(filters: { programId?: number; status?: Status; q?: string; page?: number })
  => Promise<{ total: number; page: number; rows: { application:{id,status,submittedAt}; applicant:{id,name,email}; programTitle: string }[] }>
```

Behaviour:

- Always `status <> 'draft'` (`:30`). A draft is the applicant's work in progress and staff cannot list it. An explicit `status: 'draft'` filter is ignored (`:32`).
- `programId` filters by Payload id; `status` by enum.
- `q` is trimmed and matched with `ILIKE` against the applicant's name or e-mail, using a subquery on `users` (`:33-39`). `likePattern` escapes `\`, `%`, `_` so a search for "50%" is literal (`src/lib/pagination.ts:24-26`; test `32-staff-console.test.ts:103`).
- Order: `submitted_at DESC, id DESC` (`:46`). The `id` tie-break makes paging stable so no row is repeated or lost between pages (test `32-staff-console.test.ts:123`).
- Page size 25 (`review-constants.ts:2`); `OFFSET (page-1)*25`. `page` is clamped to at least 1 only; the page component clamps for display and shows the empty state for an out-of-range page.
- Total is a separate `count()` over the same predicate (`:43`). Two queries in a non-serialisable read, so total and rows can disagree momentarily under concurrent submits; harmless for a paged list.
- Program titles come from one batched Payload lookup (`getProgramTitlesByIds`) and default to "Unknown program" (`:54,62`). See defect D-1: an unpublished program is not found by that lookup, so its applications show "Unknown program" in the queue.

The page (`applications/page.tsx:58-143`) additionally lists up to 100 published programs for the filter dropdown (`applications/page.tsx:65`), so applications to an unpublished program cannot be filtered by program from the UI. Search params are validated: `status` must be a key of the label map (`applications/page.tsx:67`), `program` is `Number(...) || undefined`, `page` goes through `parsePage` (integer 1..100000, `pagination.ts:5-8`).

## 3. Detail: `getApplicationForReview`

`review.ts:67-102`.

- Returns null for a missing id or a draft (`:71`), which the page turns into a 404.
- Loads the program with `includeUnpublished: true` (`overrideAccess: true`) so review still sees an unpublished or taken-down program (`:76`).
- Shows the **snapshot** questions when present (`:84-93`); otherwise the live program's questions. The page iterates `program.questions` and pairs each with the stored answer by id (`[id]/page.tsx:40-60`). An answer whose question is not in the snapshot is not displayed at all.
- Selects and multiselects store option values; the page maps them back to labels through the question's own options (`[id]/page.tsx:11-16`), falling back to the raw value when an option no longer exists.
- Documents render as links to the download route (`[id]/page.tsx:45-50`).

What the detail page does not show: `decision_note`, `decision_at`, any history of previous statuses. The only history is the audit trail (file 09).

## 4. Status change: `changeApplicationStatus`

`review.ts:112-191`, called only from `POST /api/admin/applications/[id]/status`.

```
changeApplicationStatus(applicationId: string, newStatus: Status, note?: string): Promise<ActionResult>
```

Control flow:

1. `requireStaffOrThrow('applications')`.
2. Note validation: when present it must be a string of at most 2000 characters (`MAX_DECISION_NOTE`, `:19,119-121`). Test `26-concurrency.test.ts:151`.
3. Read the application; missing: "That application doesn't exist." (`:123-124`).
4. `isLegalTransition(current, newStatus)`; if not: "Can't move an application from X to Y." (`:126-131`).
5. Read the program (including unpublished) for the e-mail wording; build the notification input (`:133-143`).
6. One transaction (`:156-180`):
   - `UPDATE applications SET status = newStatus, decision_at = (accepted|rejected ? now : unchanged), decision_note = (note ?? existing), updated_at = now WHERE id = $1 AND status = <status read in step 3> RETURNING id`.
   - If zero rows: return false (nothing else written).
   - Insert audit row `application_status_changed`, actor = staff, `before {status}`, `after {status, note|null}`.
   - Insert the in-app notification row.
7. If the transaction returned false: `{ ok:false, code:'conflict', error:'Someone else changed this application first. Reload to see its current status.' }`; the route maps `code === 'conflict'` to HTTP 409 and any other failure to 400 (`status/route.ts:24`).
8. After commit: send the e-mail (never throws). If `newStatus === 'accepted'`, `track('application_accepted', ..., { userId: <applicant> })` so the event is attributed to the applicant and not to the acting staff session (`:186-188`).

Concurrency design: no explicit row lock. The update is a compare-and-set on the previously read status. Two reviewers acting at once both read `submitted`; the first update changes the row, the second's `WHERE status = 'submitted'` matches nothing, so it writes no audit row and no notification and is told it lost (`:153-155`). This is sufficient because the transition graph is acyclic: a row cannot return to a status it had earlier, so there is no ABA case in which a stale read still matches. Test `26-concurrency.test.ts:133` asserts exactly one winner, one audit row, one notice.

Where this CAS does not help: it keys on status only. Two reviewers who both move `submitted -> under_review` with different notes: one wins and the other gets the 409 (same status read), so notes are not interleaved. Two different legal moves from the same state (e.g. `shortlisted -> interview` vs `shortlisted -> rejected`): one wins. Both behave correctly.

Interaction with the applicant: `saveAnswer`, `uploadDocument` and `submitApplication` take `FOR UPDATE` on the row and require `draft`. `changeApplicationStatus` does not take that lock and does not itself require non-draft; see D-2 for the one path where that matters.

### Notification content

`applicationStatusChangedTemplate` (`src/server/notifications/templates.ts:33-41`) uses one subject for every status, "Your application to <program> - an update" (`:11`), so a lock-screen preview of an e-mail does not reveal an acceptance or rejection (`:4-10`). The body carries the outcome text (`STATUS_BODY`, `:20-31`) and a link to `/dashboard/applications`. The in-app notification's `title` is that same subject and `body` is the full text (`review.ts:138-139`), so the outcome is visible once the applicant opens their dashboard.

The `note` is never put into the e-mail or notification; the UI says so (`status-form.tsx:61`).

## 5. Document download

`GET /api/admin/applications/[id]/documents/[questionId]` (`documents/[questionId]/route.ts:9-62`).

Order of checks:

1. `limitByUser('staffAction')` (600 per hour refill, `rate-limit.ts:38`).
2. `requireStaffOrThrow('applications')` mapped to JSON 401/403.
3. Application must exist and not be a draft, else 404 (`:27-31`). Staff cannot read files from a draft.
4. Document row for `(application_id, question_id)` must exist, else 404.
5. `getFile(storageKey)` reads the whole object into memory (`:38`). In local mode a missing file throws and becomes a 500; there is no explicit handling for a row whose object is gone (reconciliation reports such rows but never repairs them, file 04).
6. Insert audit row `application_document_viewed` (actor, `before: null`, `after: { questionId, documentId }`) (`:41-48`). It is written after the read succeeds and outside any transaction. If the insert throws the request fails and the bytes are not returned.
7. Response headers: `Content-Type` from the stored `mime_type` (validated against the allow-list at upload), `Content-Disposition: attachment` with an ASCII-reduced `filename=` and an RFC 5987 `filename*=UTF-8''`, `Content-Length` from the stored size, `X-Content-Type-Options: nosniff` (`:50-61`). `attachment` and `nosniff` mean the browser downloads rather than renders the file.

Test `27-document-upload.test.ts:109`: a draft's document is 404 to staff; after submit staff download exactly the stored bytes, headers match, and exactly one `application_document_viewed` row exists. `:178`: students and anonymous callers cannot download.

Design reason for auditing views: an applicant's document is personal data, so who opened it and when belongs in the trail (`:40`).

## 6. The status form

`status-form.tsx`: a select pre-set to the first legal option, a free-text note, `Update status`. Options are `nextStatuses(current)` passed from the server page (`[id]/page.tsx:73`). A terminal application shows "This application is in a final state." (`status-form.tsx:26-28`). On success `router.refresh()`; on any failure the server's error text is displayed. A 409 is shown as that message; the page is not auto-refreshed, so the reviewer must reload to see the winner's change.

Status labels in the UI differ from enum names: `rejected` is shown as "Not this time" (`applications/page.tsx:22`, `status-form.tsx:15`).

## 7. Rate limits, audit rows and analytics emitted

| Operation | Rate limit | Audit action | Analytics |
|---|---|---|---|
| Status change | `staffAction` 600 per hour per user | `application_status_changed` | `application_accepted` on accept only |
| Document view | `staffAction` | `application_document_viewed` | none |
| Queue and detail views | none | none | none |

## 8. Known limitations

- No assignment, scoring, comments or bulk actions exist in the code read; the model is one status plus an optional note.
- The decision note cannot be read in the UI after saving.
- A rejection is not tracked as an analytics event; only acceptance is.
- Defects D-1 (program titles), D-2 (draft can be forced to `submitted`) and D-3 (no runtime validation of the `status` value) in file 15.
