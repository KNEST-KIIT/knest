# 15. Known limitations and defects

Findings from reading the E2 source. Nothing here was reproduced by running the system; each item is a statement about the code at commit `383abf9`, with the file and line that supports it. "Impact" is an engineering judgement, not a measured result. No item was fixed as part of this documentation work.

Severity scale: Medium (can produce wrong data or a visible fault in normal use), Low (cosmetic, hardening, or needs unusual input), Note (design limit to be aware of).

## 1. Defects

| ID | Severity | Where | Finding | Suggested direction |
|---|---|---|---|---|
| D-1 | Medium | `src/server/applications/program-questions.ts:100-106`; used at `review.ts:54,62` and `actions.ts:332,336` | `getProgramTitlesByIds` queries with `overrideAccess: false` and no user, so an unpublished program is not found. The staff queue and the applicant's list then show "Unknown program" (and a null slug, hiding the "View program" button) for applications whose program was unpublished. Detail pages are unaffected because they use `includeUnpublished`. The R-04 test only asserts the page does not error (`26-concurrency.test.ts:197-235`) | Add an `includeUnpublished` option for staff callers; for applicants, fall back to the snapshot title if one is stored |
| D-2 | Medium | `transitions.ts:14`, `review.ts:123-131`, `status/route.ts:11-23` | `draft -> submitted` is in the transition table, `changeApplicationStatus` loads the application without excluding drafts, and the route does not restrict `status` at runtime (the TypeScript union at `route.ts:11-18` is not enforced and omits `submitted`). A staff user with the `applications` area who knows a draft's id can POST `{status:"submitted"}` and move someone's draft to `submitted`, skipping the email-verification check, the question validation and the snapshot (`submitApplication`, `actions.ts:248-313`). The update sets neither `submitted_at` nor `question_snapshot` (`review.ts:157-164`); the applicant receives the status e-mail; and because `ORDER BY submitted_at DESC` places NULLs first in Postgres, such a row sorts to the top of the queue (`review.ts:46`). Not executed; derived from reading | Reject any transition whose source is `draft` in `changeApplicationStatus`, or remove the draft edge from the table used for staff moves and keep submit as a separate path; validate `status` against the enum in the route |
| D-3 | Low | `status/route.ts:11-23`, `review.ts:126-129` | No runtime validation of the `status` value. An unknown string is rejected with a 400 by `isLegalTransition`, and the message echoes the supplied string in a JSON error. No injection (JSON, not HTML) but the validation is incidental | Zod enum in the route |
| D-4 | Medium | `src/app/(public)/programs/[slug]/apply-cta.tsx:46-76` | `ApplyCta` branches on `applicationStatus` only; it never calls `closedReason`, so a program still marked `open` after its deadline shows "Apply to ..." with "Closes <past date>". Clicking goes to `/apply/<slug>`, which redirects back to the program page (`apply/[program]/page.tsx:35`), a loop with no explanation | Use `closedReason` in the CTA |
| D-5 | Low | `onboarding/actions.ts:126-136`; `onboarding/step/route.ts:28-29`; `onboarding-flow.tsx:303-309`, `actions.ts:88-91`; `validation.ts:66` | (a) `complete` has no preconditions and is not idempotent: it resets the timestamp and records another `onboarding_completed` event each call. (b) `HANDLERS[step]` is a plain-object lookup, so `"constructor"` or `"toString"` reach an inherited function and answer 400 with no message. (c) Every profile step save sends `skills: []` and no graduation year, so those columns are always overwritten with empty values; nothing else writes them. (d) `skills` has no length or item bounds | Check required answers before completing; use `Object.hasOwn`; stop writing columns the form does not collect |
| D-6 | Low | `content/resources.ts:10-33`, `partners.ts`, `infrastructure.ts` vs `programs.ts`, `events.ts` | Error semantics differ between readers: some return `[]` on failure, contradicting the "failure throws" rule the rest of the layer states (KN-01). Detail readers return null on any error, so a CMS outage appears as a 404 for event, mentor, startup and resource pages | Decide one policy per reader and document it; at minimum distinguish "not found" from "failed" |
| D-7 | Low | `src/app/(public)/page.tsx:58-62,131-132`; `built-with-knest.tsx` | Section keys `person`, `knest` and `startups` are accepted by the CMS but render nothing (the first two are drawn inside `Narrative` under `problem`); `BuiltWithKnest` is dead code. Editors toggling those sections see no effect | Remove the keys from the CMS config or render them |
| D-8 | Note | `enquiries/actions.ts:39` | JSDoc says the list "requires the users area (super admin)"; the code requires `enquiries` (content admin and super admin) | Fix the comment |
| D-9 | Low | `applications/[id]/answer/route.ts:19-21` | A 403 (someone else's application) returns the message "Sign in to continue." | Distinguish messages by status |
| D-10 | Note | `applications/[id]/documents/route.ts:17-18` | Comment claims the size check happens "before reading the body into memory"; `request.formData()` at line 10 has already parsed the whole body. The check avoids only the second copy | Correct the comment; if a hard pre-parse limit is wanted, check `Content-Length` first |
| D-11 | Low | `api/analytics/track/route.ts:37` | The second size check uses `text.length` (UTF-16 units), not bytes | `new TextEncoder().encode(text).length` |
| D-12 | Note | `analytics/funnel.ts:35-59` | North Star loads all distinct matching user ids into memory and sends them back in an `IN` list | Rewrite as a single query with `EXISTS` |
| D-13 | Note | `audit-hooks.ts:20-28`; `db/runtime-role.test.ts:14` | CMS audit inserts swallow errors (the edit succeeds unrecorded); the app database role may UPDATE and DELETE `audit_logs`, so the trail is append-only by convention | Decide whether a revoke or a trigger is wanted before relying on the trail as evidence |
| D-14 | Note | `recommend.ts:20-25`; `enums.ts:97-106` | `goals` and `interests` are stored and never read. Notification type `application_deadline_reminder` exists with no sender found | Either use the data or stop collecting it; wire the reminder or remove the enum value |
| D-15 | Medium (privacy), not verified at runtime | `src/payload/collections/mentors.ts:60-69` | `Mentors.userId` has no field-level read restriction on a publicly readable collection, so the linked platform user id would be returned in anonymous API responses | Add `access.read` for the field, then verify with an anonymous REST request |
| D-16 | Low | `events/actions.ts:107-120` | One CMS lookup per registration, unbounded, on each dashboard events load | Batch by id, as `getProgramTitlesByIds` does |
| D-17 | Note | `storage/reconcile-worker.ts:12-22`, `instrumentation.ts:17-19` | Reconciliation is a timer inside the web process: runs once per instance, depends on a long-lived process, and its only output is a log line | Confirm where it runs in the target deployment; consider a scheduled job |
| D-18 | Low | `members/actions.ts:54-63` | Reactivating an already active account (or deactivating an inactive one) still writes an update and an audit row | Return early when unchanged, as `setStaffRole` does (`:89`) |
| D-19 | Low | `(staff)/admin/applications/page.tsx:65` | The program filter lists only published programs (limit 100), so applications to an unpublished or 101st program cannot be filtered by program | Source the list from applications, or pass `includeUnpublished` |
| D-20 | Low | `applications/validation.ts:15-17` | A `text` or `textarea` question without `maxLength` has no server-side bound; select questions with no options can never be answered | Apply a default ceiling; validate options in the CMS |
| D-21 | Low | `enquiries/actions.ts:45` | Staff list orders by `created_at` only, no id tie-break, unlike the other lists, so rows with identical timestamps can repeat or skip across pages | Add `id` to the order |

## 2. Limitations that are by design or not yet built

- Documents: no malware scanning; legacy Office files accepted by container signature only (file 04); applicants cannot download their own uploads; no encryption parameter or content type set on `PutObject`.
- Review: no assignment, scoring, comments, bulk actions, or exports; the decision note is write-only in the UI.
- Notifications: the e-mail send after commit is not retried across a crash between commit and the `sendEmail` call (file 02, section 4.4). Outage after that call is retried by the outbox.
- Events: no waitlist, reminder, attendance or capacity change notices; cancellation is silent and unaudited.
- Analytics: no consent mechanism, retention job, bot filter or date filtering; the visit id is unreliable for page-view-only visits.
- Audit: no export, no entity link, no search by actor.
- Members: no account deletion or data export; no notification to the affected person.
- Content layer: no caching, so every public view queries the CMS; hard caps of 100 on lists without pagination; search is substring match only.

## 3. Not determined from the code

- Whether Payload escapes `%` and `_` in `contains` queries (public search).
- Whether Payload can return an application question without an `id`.
- Which timezone editors intend for `applicationDeadline`.
- The S3 client's timeout and retry behaviour and the bucket's default encryption.
- Whether the Vercel deployment keeps a process alive long enough for the reconcile worker.
- Whether a test cross-checks the TypeScript onboarding option lists against the database enums.
- Retention periods for any of `analytics_events`, `audit_logs`, `enquiries`, `application_documents` (open decisions in `docs/delivery/HD-06-PRIVACY-INPUTS.md`).
- Behaviour in a deployed environment: nothing in this volume claims production verification.
