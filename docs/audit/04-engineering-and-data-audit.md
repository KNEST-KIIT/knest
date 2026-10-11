# Engineering and data audit
Evidence mode: independent architecture/backend source review, reconciled by orchestrator and independent challenger. Runtime results are bounded in [10](10-evidence-and-verification-log.md). Source paths refer to current working disk.

## Controls worth retaining
- Application start is idempotent via unique user/program key + onConflictDoNothing (`applications/actions.ts:75–79`).
- Save/upload/submit serialize on application row locks; submit revalidates answers and snapshots questions (`:107–114,140–151,191–209,277–306`).
- Reviewer state transitions use compare-and-set and atomically write audit + notification (`review.ts:150–176`).
- Capacity-limited events use an advisory transaction lock around count/insert (`events/actions.ts:41–53`).
- Lab initial requests lock per-user quota checks/inserts (`labs/service.ts:129–159`); migration 0010 installs GiST exclusion for overlapping live states.
- Enquiry handling uses conditional update and transactional audit (`enquiries/actions.ts:54–70`).
These facts refute old claims that the same historical races necessarily remain. They do not prove all lifecycle transitions or persistent environments safe.

## F11 — Authentication and administrator invariants lack transaction-level protection
**P1; high static confidence; concurrency/interruption-dependent likelihood.**
`src/server/members/actions.ts:43,82` counts other active superadmins before mutation transactions at lines 48/86. Two admins can concurrently deactivate/demote each other; both pass the check, both commit, leaving zero. Self-change denial does not prevent cross-target races. Lock a stable shared admin-invariant key, re-read/count and mutate inside one transaction; include session revocation/audit.
`auth/actions.ts:158,165,172` separately consumes reset token, updates hash and revokes sessions. Interruption can burn a valid link or retain sessions after password change. Hash first, then consume/update/revoke atomically. `auth/tokens.ts:35–40` replacement delete/insert is separate; concurrent resends can leave multiple valid tokens where newest-only semantics are intended.
**Verification:** disposable PostgreSQL coordinated cross-admin race; injected failure after reset update; parallel issuance/consume. Assert at least one active superadmin and all-or-nothing reset. No such production attack was executed.

## F12 — Upload membership, storage lifecycle and resource accounting incomplete
**P1 for correctness/approved retention; P2 broader hardening; high confidence.**
`applications/actions.ts:157–214` does not resolve questionId against current program/file question type, unlike saveAnswer at lines 128–130. It trusts supplied file metadata while the API does derive actual size; direct callable paths need equivalent validation. The object is stored before locked draft check (lines 183–184), and replacement updates metadata without deleting previous object. No delete abstraction/compensation exists. `api/applications/[id]/documents/route.ts:10–30` buffers multipart body before action authentication; proxy cap is 12 MB but concurrent unauthenticated buffering is still a resource concern.
Impact: arbitrary owned-draft question attachments and orphan growth, with ambiguous retained applicant documents. MIME magic is a type check, not malware scanning; no executable-upload exploit is claimed.
Remedy: authenticate/limit before parsing where possible; validate current file question; derive bytes/metadata at authoritative boundary; delete superseded/failed objects or reconcile safely under approved retention. Decide quarantine/PDF-only/AV based on actual institutional risk.
**Verification:** unknown/nonfile question refusal; altered declared size; byte limit; cross-user/draft status; replacement and submit/upload race; storage reconciliation dry run. Do not delete real objects in audit.

## F13 — Notification delivery and post-commit responses are not durable
**P1 if required two-channel delivery; high confidence.**
In-app application/review notifications share transactions, which should be retained. Email is sent after commit without an outbox/retry. `notifications/send.ts:48` user lookup is outside the caught mail send at line 54; lookup failure can return error after domain success. Event registration commits before notify (`events/actions.ts:61–71`), so interruption can lose the in-app/email confirmation. Transport failure is logged, not retried.
Impact: missed transactional mail, misleading failure responses, staff support burden. This does not mean all application notifications vanish: their DB records are often atomic already.
Remedy: minimal transactional delivery/outbox records with idempotent attempt keys, bounded retries/status and operator resend. Put event in-app notice in registration transaction. A DB task and scheduler suffice; no distributed message platform is mandated.
**Verification:** simulated crash/lookup/send failure, resumed delivery, truthful committed response, no duplicate in-app notice; real SES proof separately required.

## F14 — Staff draft privacy is inconsistent
**P1 subject to confirmed privacy intent; high confidence and bounded runtime confirmation.** A synthetic reviewer page-action call returned draft status; see report 10. Document-route behavior remains source-confirmed rather than separately reproduced.
Queue excludes drafts because they are private unfinished work (`review.ts:23–30`); detail (lines 67–80) and admin document route17–34 do not reject a known draft ID. Authorization does restrict to applications-area staff: this is not anonymous document access.
Remedy: enforce non-draft parent access consistently and minimize applicant DTOs (F01). **Verification:** known synthetic draft ID denied through page/action/file; submitted ID accessible only to correct role. DTO/password-hash exposure is F01, avoiding duplicate backlog effort.

## F15 — Lab approval, staffing and occupancy invariants bypassed on alternate paths
**P1 conditional on enabling labs; high confidence static; runtime regressions still required.**
1. `labs/manage.ts:173,180–182` only reserves requested head role for admin; upserting an existing head as assistant bypasses removal restriction (line 195). A head can demote another existing head. Check both existing/new roles under lock.
2. `labs/service.ts:206` enforces requiresAssistant on normal approval, but proposal (lines 229–231) and accept (line 275) set approved without valid assistant. Initial weekly quota (line 143) is not reapplied when proposal changes week/duration. Centralize transition invariants and lock affected member quota.
3. Attendance (line 346) permits completion/no_show once start passes; status (lines 350–354) leaves the exclusion predicate (`0010_lab_booking.sql:119`) immediately. With allowed zero-lead policy and a 09–12 booking completed at 09:01, a 10–11 request can overlap actual use. Default four-hour lead lowers likelihood, not the allowed-policy defect. Separate attendance from occupancy/release or retain occupancy until end.
4. Normal approve (lines 203–211) lacks future-time check. Proposal accept does recheck future time and database overlap: do not claim all alternative proposals can double-book.
**Verification:** existing-head→assistant denied for nonadmin; assistant-required alternative acceptance; cross-week duration/quota race; early attendance followed by overlapping future grid slot; past approval denied. Flag must remain off until policy/negative tests accepted.

## F16 — Lab lifecycle, visibility and feedback not operationally complete
**P1 conditional; high source confidence.**
Open-request query (line 136) counts stale requested/alternative rows indefinitely; no expiry/reminder processor. Current design (lines 54–58) admits no expiry, past approval, assistant scope mismatch, absent attendance correction and inability to reopen inactive labs through active-only console lookup (`service.ts:60`).
The design says assistants see own duties but another security paragraph allows all lab identities. This is a policy conflict; restrict by least necessary scope until signed HD-16.
`booking-picker.tsx:53,108–114` clears success/conflict message during availability reload. Persist outcome and announce after refresh.
Remedy: approve pending-reservation/expiry/escalation, assistant privacy, no-show/correction/reactivation rules; implement auditable idempotent transitions and persistent feedback. **Verification:** stale requests free quota, expired cannot approve, own-duty isolation, correction requires reason, inactive can reopen, success/conflict survives reload. Manual attendance remains distinct from QR proof.

## F07 data-loss qualification
`src/migrations/20261009_083013_drop_cms_lab_bookings.ts:6` drops old CMS bookings CASCADE; down recreates empty structure. Whether important persistent rows exist is UNKNOWN. Treat data disposition as a P0 migration gate if they exist, not a confirmed data-loss incident.
Current deploy **does snapshot and wait before migration** (`infra/cfn/app.yaml:548–552`). No restore/reconnection drill was evidenced. Snapshot permission/template existence is not proof of an operational restore. Full F07 in [06](06-deployment-and-operations-audit.md).

## Maintainability, data integrity and deferred debt
Operational/content schema separation is defensible, but stable-ID application references require service integrity and historical snapshots. Both Payload and Drizzle use pools; measure aggregate connections on small RDS. Add cleanup for privacy-required retention; batch event metadata/read pagination only when pilot volumes warrant. Audit coverage exists for many operational mutations; CMS publishing and every privileged action need explicit coverage against the contract, not generic claims of immutable comprehensive auditing. Audit table currently lacks a separate append-only principal guarantee.

No payment/refund/financial arithmetic gaps are applicable. No cross-tenant architecture is established; ordinary cross-user confidentiality still is mandatory. No wholesale rewrite or additional service boundary is justified.

