# 09. Audit trail

Module: `src/server/audit/queries.ts` (52 lines), `snapshot.ts` (9); writer helpers inline at each call site; CMS writers in `src/payload/audit-hooks.ts` (73 lines); viewer `src/app/(staff)/admin/audit/`; table `app.audit_logs`.

## 1. Table

`src/db/schema/notifications.ts:43-59`; created in `src/db/migrations/0002_wonderful_ender_wiggin.sql:35,61,69`.

| Column | Type | Notes |
|---|---|---|
| `id` | text UUID | |
| `actor_user_id` | text NOT NULL | FK to `users`, **`ON DELETE RESTRICT`** |
| `action` | text NOT NULL | free text, not an enum |
| `entity_type` | text NOT NULL | free text |
| `entity_id` | text NOT NULL | free text |
| `before`, `after` | jsonb, nullable | "snapshots of just the changed fields, not full row dumps" |
| `created_at` | timestamptz | default now |

Index: `(entity_type, entity_id)` only. There is no index on `created_at` or `action`; the viewer orders by `created_at` and filters by `action`, which will scan as the table grows.

Consequences of the design:

- `RESTRICT` means an account that has an audit row cannot be deleted, which keeps the trail attributable; the integration tests note this explicitly ("Audit actors are intentionally undeletable", `24-last-admin-concurrency.test.ts`). Any future account deletion or anonymisation feature must reconcile that with privacy obligations (not decided in code; see `docs/delivery/HD-06-PRIVACY-INPUTS.md`).
- `action` and `entity_type` being free text means there is no central registry; the catalogue below is assembled from call sites.
- **Not tamper-evident.** The application never updates or deletes audit rows (no such code was found), and the viewer is read-only, but the database role the app runs as is granted `SELECT, INSERT, UPDATE, DELETE` on all tables in `app` (`src/db/runtime-role.test.ts:14`). The table is append-only by convention, not by database privilege. There is no hash chain.

## 2. What is recorded

The rule: every privileged action writes its row **in the same transaction** as the change, so the trail is "what happened, not what someone remembered to record" (`queries.ts:9-13`). The status change, the member change and the enquiry close all follow it; the only writes outside a transaction are noted below.

| Action | entity_type | Written by | In same transaction as change? | before / after |
|---|---|---|---|---|
| `application_submitted` | application | `actions.ts:302-309` (actor: applicant) | yes | `{status:'draft'}` / `{status, programId, answers, documents}` counts |
| `application_status_changed` | application | `review.ts:169-176` | yes | `{status}` / `{status, note}` |
| `application_document_viewed` | application | `documents/[questionId]/route.ts:41-48` | no (after the read) | null / `{questionId, documentId}` |
| `enquiry_handled` | enquiry | `enquiries/actions.ts:61-68` | yes | `{status:'new'}` / `{status:'handled'}` |
| `account_deactivated`, `account_reactivated` | user | `members/actions.ts:56-63` | yes | `{isActive}` / `{isActive}` |
| `staff_role_changed` | user | `members/actions.ts:97-104` | yes | `{staffRole}` / `{staffRole}` |
| `email_resent` | email_outbox | `src/server/email/outbox.ts:118` | yes (inside the resend transaction) | `{status, attempts}` / `{status:'pending'}` |
| `cms.create`, `cms.update`, `cms.publish`, `cms.unpublish`, `cms.delete` | collection slug, or `global:<slug>` | `audit-hooks.ts:30-61` | no (Payload hook, after change) | `{status,title,slug}` pairs; never the body |
| `lab_*` (created, updated, hours_set, blackout_added/removed, staff_added/removed, department_*, booking_cancelled, device_key_registered/revoked) | lab, lab_booking, lab_department, lab_device_key | `src/server/labs/*`, `attendance-qr.ts` | mostly yes; `lab_device_key_registered` is a plain insert (`attendance-qr.ts:76`) | see lab volume |

Notable absences: unregistering from an event, status changes by the applicant other than submit, onboarding and profile edits, sign-in and sign-out, password resets and failed logins, enquiry creation (the enquiry row is itself the record), mail sends. Those are either not "privileged actions" or are recorded in other tables (outbox, rate limits). Reads of the application queue and detail pages are not audited; only document opens are.

`application_submitted` is attributed to the applicant, so "staff audit trail" also contains rows for non-staff actors.

### The CMS hooks

`withAudit(collection)` appends `auditAfterChange` and `auditAfterDelete` hooks after each collection's own hooks (`audit-hooks.ts:64-73`); applied to every collection except `staff` (`payload.config.ts:67`); the Homepage global gets `auditGlobalAfterChange` (`payload.config.ts:84`).

Behaviour (`audit-hooks.ts:20-61`):

- Action is derived from the document's `_status` change: create gives `cms.create`; to published `cms.publish`; to draft `cms.unpublish`; otherwise `cms.update`.
- The actor is `req.user.id`; **requests with no signed-in user (seeds, migrations) are skipped** because the foreign key requires an actor (`:11-13,21`).
- The insert is wrapped in try/catch: a failure is logged (`[audit] could not record a content change`) and the edit still succeeds (`:22-27`). This is the opposite of the transactional guarantee above; a CMS change can be unrecorded if the audit insert fails. The reason given is that an edit must not fail because the trail could not be written.
- Only title and slug and status are copied, "the document and its version history are the record of content".
- Global changes record `after: { updated: true }` only, with no before.
- Test: `tests/integration/43-cms-audit.test.ts:26`.

## 3. The viewer

`/admin/audit` (`src/app/(staff)/admin/audit/page.tsx:1-94` from its first line): layout gates with `requireAdminArea('audit')` (super admin only, `roles.ts:25`); `export const dynamic = 'force-dynamic'`.

- `listAuditFacets()` returns the distinct `action` and `entity_type` values (two `SELECT DISTINCT` queries, `queries.ts:45-52`). The page accepts a filter only if the value is in that list (`page.tsx:16-17`), "so the filter cannot be used to probe for anything else". Test `32-staff-console.test.ts:188`.
- `listAuditLogs({ action?, entityType?, page? })` (`queries.ts:13-42`): count plus 50 rows (`AUDIT_PAGE_SIZE`), `created_at DESC, id DESC`, inner join to users for actor e-mail and name. Offset paging; deep pages get slower.
- Each row shows action (underscores replaced), entity type, first 8 characters of entity id, time (`formatEventTime`), actor, and before/after through `summariseSnapshot`.

`summariseSnapshot(value, maxLength = 120)` (`snapshot.ts:1-9`): null/undefined gives an em dash; scalars as text; objects as `key: value, ...` with nested objects JSON-encoded; truncated with an ellipsis; empty object gives a dash. React escapes the text, so snapshot content cannot inject markup. Covered by `snapshot.test.ts`.

What the viewer cannot do: search by entity id or actor, export, show the full (untruncated) snapshot, or link to the entity. Notes appear in the snapshot only up to 120 characters.

## 4. Limits

- The `note` entered on a status change (up to 2000 characters) is stored in full in `after` but displayed truncated.
- No retention job. Whether audit logs have a retention period is an open question in the privacy inputs (HD-06).
- The inner join in both the overview and the viewer would hide rows whose actor is missing; `RESTRICT` prevents that state in normal operation.
