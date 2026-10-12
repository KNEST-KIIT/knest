# 02. Applications engine: the applicant flow

Module: `src/server/applications/actions.ts` (366 lines), `validation.ts`, plus the four applicant API routes and the two member pages that drive them.

## 1. Shape of the module

`actions.ts` is a plain server module (`import 'server-only'`, line 1). It carries no `'use server'` directive, so none of its exports is a Server Action. This is asserted against the compiled manifest by `tests/integration/01-server-action-boundary.test.ts:6-19`, which lists `startApplication`, `saveAnswer`, `uploadDocument`, `submitApplication` and the read helpers as names that must not appear in `.next/server/server-reference-manifest.json`. Consequence: the only way to reach these functions over the network is through the route handlers listed in section 6, each of which is a normal HTTP route behind the edge guard (`src/proxy.ts`, `src/server/security/edge-guard.ts`).

Result type: `ActionResult = { ok: true } | { ok: false; error: string; code?: string }` (`actions.ts:17`). Authorisation failures are not results; they throw `UnauthorizedError` (401 not signed in, 403 not permitted, `src/server/auth/guards.ts:86-97`) and rate-limit exhaustion throws `RateLimitError` (`src/server/security/rate-limit.ts:101-106`). The routes translate both.

## 2. Public interface

| Function | Signature | Auth | Writes |
|---|---|---|---|
| `getApplicationStatusForUser` (`:20-27`) | `(userId, programId) => Promise<status \| null>` | `requireSelf(userId)` | none |
| `findApplicationForProgram` (`:30-37`) | `(userId, programId) => Promise<{id,status} \| null>` | `requireSelf` | none, "creates nothing" |
| `startApplication` (`:50-87`) | `(programSlug) => {ok:true, applicationId} \| {ok:false, error}` | `requireUserOrThrow` | `applications` insert; analytics `application_start` |
| `saveAnswer` (`:110-152`) | `(applicationId, questionId, value: unknown) => ActionResult` | `requireUserOrThrow` + owner | `application_answers` upsert; bumps `applications.updated_at` |
| `uploadDocument` (`:154-225`) | `(applicationId, questionId, {name,type,size,buffer}) => ActionResult` | `requireUserOrThrow` + owner | object storage; `application_documents` upsert |
| `submitApplication` (`:227-321`) | `(applicationId) => ActionResult` (`code: 'verify-required'` possible) | `requireUserOrThrow` + owner | status, snapshot, audit row, notification row; then e-mail and analytics |
| `listApplicationsForUser` (`:323-338`) | `(userId) => rows with programTitle, programSlug` | `requireSelf` | none |
| `getOwnedApplicationDetail` (`:340-366`) | `(applicationId, userId) => detail \| null` | `requireSelf` + owner | none |

`requireSelf(userId)` derives authority from the session and refuses a mismatched id with 403 (`guards.ts:100-104`), so a caller cannot read someone else's rows by passing a different id.

Ownership helper `loadOwnedApplication` (`:90-96`) returns null when the row is missing or belongs to another user. Callers then throw `UnauthorizedError(403)` (`:117,162,230`). Missing and foreign are deliberately indistinguishable.

## 3. Concurrency model: one row lock, taken by every writer

`lockDraft(tx, applicationId)` (`:101-108`) runs `SELECT status FROM applications WHERE id = $1 FOR UPDATE` inside the caller's transaction and reports whether the status is still `draft`.

Why it exists (R-05): the draft check at the top of each function is a plain read. Between that read and the write a concurrent submit can commit and freeze the application. Without a shared lock, an answer or file could land after the snapshot was taken and after validation, so the stored application would differ from what was validated and snapshotted.

Every write that must not outlive a submit goes through this lock:

| Writer | Where the lock is taken |
|---|---|
| `saveAnswer` | `actions.ts:137-148` |
| `uploadDocument` | `actions.ts:195-217` |
| `submitApplication` | `actions.ts:282-313` |

Because `FOR UPDATE` serialises them, exactly one of {answer write, submit} goes first. If submit goes first, the answer's transaction then sees `status = 'submitted'`, `lockDraft` returns false and the write is skipped with "This application has already been submitted." (`:149`). If the answer goes first, submit validates a set that includes it. Integration test `26-concurrency.test.ts:164` ("nothing is written after the moment of submission") exercises this.

The earlier check-then-write submit allowed two simultaneous submits to both succeed and send two confirmations; the transaction now makes the second find a non-draft (`actions.ts:274-281`). Test `70-core-journey.test.ts:196` ("ten simultaneous submits produce one submission and one confirmation").

## 4. Operation by operation

### 4.1 `startApplication`

Control flow (`:50-87`):

1. `requireUserOrThrow`.
2. Look up the program by slug through the CMS with `overrideAccess: false` (`getApplicationProgramBySlug`). Unknown or unpublished: `{ ok:false, error:"That program doesn't exist." }`.
3. `closedReason(program)`; if closed, return it.
4. Look for an existing row for (user, program). Only when none exists, `enforceRateLimit('application-start:<userId>', RATE_LIMITS.applicationStart)` (10 per hour refill, `rate-limit.ts:20`). A repeat press of Start on an existing application is not penalised (`:60-69`).
5. `INSERT ... ON CONFLICT (user_id, program_id) DO NOTHING RETURNING id`. If a row came back, track `application_start` and return its id. If not (the unique index fired, meaning a concurrent request or earlier start), re-select and return the existing id.

Idempotency: the unique index `applications_user_program_idx` is the mechanism, not the pre-check. The pre-check at step 4 exists only to decide whether to spend a rate-limit token. Two concurrent first-time requests can both pass step 4 and both consume a token; one insert wins and the other returns the same id. This is acceptable: tokens are only wasted, no duplicate row can exist.

Error handling: failure to find the row after a conflict (`:85`) returns a generic error. The route maps `ok:false` to 400 (`src/app/api/applications/start/route.ts:13`), `UnauthorizedError` to 401/403, `RateLimitError` to 429 (`:16-21`). Any other exception is rethrown and becomes a 500.

Note R-06: viewing `/apply/[program]` never calls this. A draft is created only by the explicit Start button (`start-application.tsx:20-35`, which posts to `/api/applications/start` then `router.refresh()`), so prefetches and crawlers cannot create drafts. Test `26-concurrency.test.ts:317`, `36-journey-student.test.ts:144`.

### 4.2 `saveAnswer`

Control flow (`:110-152`):

1. Auth and ownership. Foreign or missing: throws 403.
2. If status is not `draft`: `ok:false`, "already been submitted".
3. Fetch program (current CMS version, public access). If the program is closed, refuse with "Your draft is kept but can't be submitted." (`:123-125`). This is intentional early notice, rather than letting the person fill everything in and fail at submit.
4. Locate the question by id in the current question set. Not found: "That question no longer exists on this program."
5. `schemaForQuestion(question).safeParse(value)`; first issue's message is returned on failure.
6. Transaction: lock, upsert on `(application_id, question_id)`, touch `applications.updated_at`.

Validation rules (`src/server/applications/validation.ts:9-38`), where `required = question.required !== false`:

| fieldType | Required | Optional |
|---|---|---|
| `text`, `textarea` | `z.string().trim().min(1)`; `max(maxLength)` when set | `z.string().trim()...optional().or(z.literal(''))` |
| `url` | `z.string().trim().url()` | optional or empty string |
| `select` | string that is one of the option values | optional or empty string |
| `multiselect` | `string[]` of option values, `min(1)` | array, no minimum |
| `file` | literal `true` | boolean, optional |

Consequences worth knowing:

- Values are trimmed by Zod and the trimmed result (`parsed.data`) is what is stored (`:141`).
- If `maxLength` is absent there is no server-side length bound on `text`/`textarea`. The only ceiling is the request body limit. The form sets `maxLength` on the input only when the question has one (`application-form.tsx:260,273`).
- A `select` or `multiselect` question with zero options can never be answered (the refine over an empty list always fails), which would also make a required one unsubmittable. The CMS does not stop an editor creating that.
- The `file` branch accepts `true`. Nothing in the upload path writes such an answer; the client skips saving file questions (`application-form.tsx:62`). Submit decides file presence from `application_documents`, not from answers (`validation.ts:72-77`).

Rate limit: the route calls `limitByUser('answerSave')` before parsing (`src/app/api/applications/[id]/answer/route.ts:8-9`): 600 per hour refill (`rate-limit.ts:31`). With no session it lets the request through, so the route's own 401 answers (`route-limits.ts:15-24`). The action itself does not rate limit.

### 4.3 `uploadDocument`

Control flow (`:154-225`), in order:

1. `requireUserOrThrow`, then `enforceRateLimit('file-upload:<userId>', fileUpload)` (20 per hour refill, `rate-limit.ts:21`) before ownership is checked, so even a refused upload spends a token.
2. Ownership and draft status.
3. Declared MIME type must be in `ALLOWED_UPLOAD_MIME_TYPES` (PDF, DOC, DOCX, PPT, PPTX; `validation.ts:40-46`).
4. Program fetched; closed programs refused.
5. The question must exist and have `fieldType === 'file'`.
6. `buffer.byteLength <= MAX_UPLOAD_BYTES` (10 MiB, `validation.ts:48`). The size used is the buffer's real length, not the client-declared `size`.
7. `verifyFileContents(buffer, declaredType)` sniffs magic numbers with the `file-type` package (`src/server/security/file-verify.ts:25-35`): no signature means reject; the sniffed MIME must be in the accepted list for the declared type. DOC and PPT both sniff as `application/x-cfb`, so either declared legacy type accepts any CFB container (`file-verify.ts:8-11,18-19`).
8. `generateStorageKey(name)` then `putFile(key, buffer)`. The object is written before any database row exists.
9. Transaction: `lockDraft`; read the previous row's `storage_key`; upsert on `(application_id, question_id)` setting `file_name`, `storage_key`, `mime_type`, `file_size`, `uploaded_at`; touch `updated_at`; return the previous key.
10. After the transaction: delete the obsolete object. If the transaction committed that is the previous object; if `lockDraft` said not a draft it is the object just written (`:218-221`). Delete failures are only logged (`[uploads] obsolete object cleanup failed`).

Failure modes and their cleanup:

| Failure | Result | Leftover |
|---|---|---|
| Rejected before `putFile` (steps 2-7) | `ok:false`, nothing stored | none (test `27-document-upload.test.ts:90` asserts object count unchanged) |
| `putFile` throws | exception, 500; no row | possibly a partial object, S3 `PutObject` is atomic so effectively none |
| Process dies between 8 and 9 | no row points at the object | orphan, removed later by reconciliation (file 04) |
| Submit won the race (`lockDraft` false) | `ok:false`, new object deleted immediately | none unless the delete fails |
| Delete of replaced object fails | upload still succeeds | orphan, reconciliation |

Design reason for write-object-first, row-second: a database row that points at a missing object is a visible defect to staff (a download 500s), whereas an unreferenced object is harmless and cleaned in the background. The reverse order would make the failure mode the harmful one.

Route-level behaviour (`src/app/api/applications/[id]/documents/route.ts`): parses `formData`, requires `file` to be a `File` and `questionId` a string, then rejects `file.size > MAX_UPLOAD_BYTES` with 413 (`:14-21`). The code comment says this is "before reading the body into memory"; by that point `formData()` has already parsed the body, so the check saves the extra `arrayBuffer()` copy but not the parse. The effective body ceiling is `experimental.proxyClientMaxBodySize: '12mb'` in `next.config.ts:67`, which exists so that a file of exactly 10 MiB plus multipart framing is not truncated by the proxy buffer (test `27-document-upload.test.ts:146`).

Applicants have no download route for their own documents in the files read; only the staff route reads storage (`src/app/api/admin/applications/[id]/documents/[questionId]/route.ts`, file 03).

### 4.4 `submitApplication`

Control flow (`:227-321`):

1. Auth, ownership, draft check (read).
2. Program fetched (`getApplicationProgram`, public access). Missing: "That program no longer exists." Closed: refuse.
3. Load the user's `email_verified`. Not verified: `{ ok:false, error:'Verify your email before submitting.', code:'verify-required' }` (`:248-254`). The client reacts to this code by sending the person to `/verify?next=...` and the draft is kept (`application-form.tsx:130-133`). Identity is required only at the moment a decision about a person is going to be made; signup and onboarding are not blocked by it (`:245-247`).
4. Prepare the notification payload.
5. One transaction (`:282-313`):
   - `lockDraft`; if not draft, outcome `already`.
   - Load all answers and all documents.
   - `findSubmissionProblem(program.questions, answers, documentQuestionIds)`; if a problem is found outcome `invalid` with its message and nothing is written.
   - `UPDATE applications SET status='submitted', submitted_at=now, updated_at=now, question_snapshot=<program.questions>`.
   - Insert audit row `application_submitted` (actor is the applicant, before `{status:'draft'}`, after `{status:'submitted', programId, answers: n, documents: n}`).
   - `writeNotification(tx, ...)` the in-app row.
6. After commit: `sendNotificationEmail` (never throws) and `track('application_submit')`.

Re-validation (KN-31, `validation.ts:52-93`): stored answers are validated again against the program's current question set with the same schema that guards saving. A required file question needs a document row; a required non-file question needs an answer row; any present answer, required or not, must still pass its schema. Answers for questions that no longer exist are ignored. The first problem in question order is returned. This closes the earlier hole where presence of a row was enough, so an answer saved against an older option list or a looser length limit was accepted (tests `src/server/applications/validation.test.ts:25-77`; `70-core-journey.test.ts:158`).

Why validate inside the transaction: because every writer takes the same lock, the answers read after `lockDraft` are exactly the set that will be frozen. Nothing can slip in between check and status change (`:279-281`).

Why the e-mail is outside the transaction: a transaction must not stay open across a network call, and the send already tolerates failure by design (`:257-262`). Practical consequence: if the process dies after commit and before the send, the in-app notice exists and the e-mail does not; `sendEmail` itself writes to the outbox first when enabled (`src/server/email/send.ts:64-67`), so an SMTP or SES outage after that point is retried by the worker, but a crash between commit and the call to `sendEmail` is not recovered. Not determined from the code whether anything else reconciles this.

CAPTCHA: the submit route requires a Turnstile token before calling the action (`src/app/api/applications/[id]/submit/route.ts:9-10`; `captchaFailure` returns 503 `captcha-unavailable` or 400 `captcha`, `src/server/security/captcha.ts:10-25`). In production an unset `TURNSTILE_SECRET_KEY` fails closed (`src/server/security/turnstile.ts:31`). The action has no CAPTCHA of its own; calling the action from another route without that check would skip it.

## 5. Applicant-facing pages

| Page | File | Behaviour |
|---|---|---|
| `/apply/[program]` | `src/app/(member)/apply/[program]/page.tsx:22-78` | `requireUser('/apply/<slug>')`; unknown program 404; no application: closed program redirects to `/programs/<slug>`, else shows Start; existing non-draft redirects to `/dashboard/applications`; draft on a closed program shows a closed panel; otherwise the form |
| form | `application-form.tsx` | One question per screen; `Save & continue` posts the answer (`:66-70`); file questions upload on selection (`:91-112`); review screen lists all answers with Edit links (`:173-220`); submit posts `{turnstileToken}` (`:117-121`) and on a CAPTCHA failure resets the single-use token (`:134-137`) |
| `/dashboard/applications` | `src/app/(member)/dashboard/applications/page.tsx:10-58` | `requireUser`, not `requireOnboardedUser`: checking one's applications is not gated on onboarding |

Client-side `canContinue` (`application-form.tsx:143-150`) is a convenience only: it blocks the Continue button for an empty required field but the server is the enforcement. On the server a `required` question's answer must be non-empty regardless.

The apply layout renders a reduced shell without the site navigation (`apply/[program]/layout.tsx:10-28`) and the page does not require onboarding to be complete (it uses `requireUser`).

## 6. Route table

| Route | Method | Guards in order | Success | Errors |
|---|---|---|---|---|
| `/api/applications/start` | POST | action: session, rate limit (only new) | 200 `{ok,applicationId}` | 400 missing slug or action error; 401/403; 429 |
| `/api/applications/[id]/answer` | POST | `limitByUser('answerSave')`, action | 200 `{ok:true}` | 400 missing questionId or action error; 401/403; 429 from `limitByUser` |
| `/api/applications/[id]/documents` | POST | 413 size pre-check, action (session, `fileUpload` limit) | 200 | 400 missing file or action error; 401/403; 413; 429 |
| `/api/applications/[id]/submit` | POST | Turnstile, action | 200 | 400 (with `code`), 400/503 captcha; 401/403 |

The `answer` route reports every `UnauthorizedError` as "Sign in to continue." including a 403 for someone else's application (`answer/route.ts:19-21`); the status code is correct, the message is not.

## 7. Configuration

| Setting | Where | Effect |
|---|---|---|
| `RATE_LIMITS.applicationStart`, `fileUpload`, `answerSave` | `src/server/security/rate-limit.ts:20-31` | Per-user token buckets in `app.rate_limits` |
| `MAX_UPLOAD_BYTES`, `ALLOWED_UPLOAD_MIME_TYPES` | `validation.ts:40-48` | Compile-time constants |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | `turnstile.ts:20-31` | Submit CAPTCHA |
| `S3_BUCKET` etc. | file 04 | Where documents go |
| `proxyClientMaxBodySize` | `next.config.ts:67` | 12 MB request buffer |

## 8. Known limitations

See file 15 for the numbered list. Those specific to this flow: no server-side length bound without `maxLength`; legacy Office files are only checked as "a CFB container"; no antivirus or content scanning exists in the code read; no applicant download of own uploads; rate limit tokens are spent before ownership is checked on upload.
