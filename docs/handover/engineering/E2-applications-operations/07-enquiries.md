# 07. Enquiries (contact form and staff inbox)

Module: `src/server/enquiries/actions.ts` (76 lines), `validation.ts` (33 lines); routes `src/app/api/enquiries/route.ts` and `src/app/api/admin/enquiries/[id]/handled/route.ts`; table `app.enquiries`; pages `src/app/(public)/contact/` and `src/app/(staff)/admin/enquiries/`.

## 1. Data model

`app.enquiries` (`src/db/schema/enquiries.ts`; lines below counted from that file's start):

| Column | Notes |
|---|---|
| `id` | text UUID |
| `name`, `email`, `message` | NOT NULL text |
| `topic` | enum `general, program, partnership, mentor, press, support`, default `general` |
| `status` | enum `new, handled`, default `new` |
| `user_id` | nullable FK to users, `ON DELETE SET NULL`: kept if the account is deleted |
| `created_at`, `handled_at`, `handled_by` | `handled_by` FK to users, `SET NULL` |

Index `(status, created_at)`. The table is in `app`, not the CMS, because it holds personal data and should follow member-data access and retention rules (HD-06, `enquiries.ts` header comment). Nothing is shown publicly.

## 2. Submission

### Route: `POST /api/enquiries` (`route.ts:7-19`)

Order of defences:

1. **Per-IP rate limit**: `checkRateLimit('enquiry:<ip>', RATE_LIMITS.enquirySubmit)`: capacity 3, refill window one hour (`rate-limit.ts:25`). Over the limit: 429 "Too many messages from this connection." Done before parsing the body so a flood costs one database upsert, not a parse and a captcha call. The IP comes from `clientIp(request)`, which resolves the address from the trusted source configured for the deployment (`src/server/security/client-ip.ts`, outside this volume).
2. Parse JSON (null on failure).
3. **Turnstile** (`captchaFailure`): 400 `captcha` or 503 `captcha-unavailable`.
4. Session lookup (`getSessionUser`) to attach the account if signed in.
5. `submitEnquiry(body, { userId })`.
6. Success is `201 { ok: true }`; validation failure is `400 { error }`.

If the rate limiter's own database call throws, the route throws (500); it does not fail open or closed explicitly. Note the analytics route handles that case differently (file 10).

### `submitEnquiry(input, { userId })` (`actions.ts:15-35`)

1. `enquirySchema.safeParse(input)`; first issue message returned on failure.
2. **Honeypot**: if the `website` field is non-empty, return `{ ok: true }` and store nothing, so a bot learns nothing (`:19`). The contact form renders the field out of sight (`contact-form.tsx:90`, `tabIndex={-1}`, `autoComplete="off"`).
3. Insert the row with `topic` and `user_id` (null when anonymous).
4. If `ENQUIRY_NOTIFY_EMAIL` is set, send a plain-text notification (`:26-33`) containing the sender's name and e-mail, topic, message and the reference id. A failure is caught and logged; the message is already stored, so it never fails the submission.

The staff notification goes through `sendEmail`, which is outbox-backed (retried by the worker). If `ENQUIRY_NOTIFY_EMAIL` is unset no mail is sent and staff must look at the inbox.

### Validation (`validation.ts:25-31`)

| Field | Rule |
|---|---|
| `name` | trimmed, 2..100 |
| `email` | trimmed, lower-cased, valid e-mail, max 254 |
| `topic` | one of the six values |
| `message` | trimmed, 10..2000 (`MAX_ENQUIRY_MESSAGE`) |
| `website` | optional string (honeypot) |

Messages are phrased per the UX copy rules ("Name is required.", "Message is too short.").

Header injection: the subject is `New KNEST enquiry (<topic>)` with a validated enum topic; user text appears only in the plain-text body (`actions.ts:27-30`).

## 3. Staff inbox

### Access

Area `enquiries`: roles `content_admin` and `super_admin` (`roles.ts:23`). The page and layout use `requireAdminArea('enquiries')` (`enquiries/layout.tsx:8`, `page.tsx:18`); the functions use `requireStaffOrThrow('enquiries')`. The JSDoc above `listEnquiries` says it "requires the users area (super admin)" (`actions.ts:39`); that comment is stale, the code checks `enquiries`.

### `listEnquiries({ status?, page? })` (`actions.ts:40-49`)

Newest first (`created_at DESC`, no id tie-break), 25 per page, total from a second `count(*)` run in parallel. Returns `{ rows, total, page, pageSize }` including the full message text and e-mail.

### `markEnquiryHandled(id)` (`actions.ts:52-76`)

- One transaction: `UPDATE enquiries SET status='handled', handled_at=now, handled_by=<staff> WHERE id=$1 AND status='new' RETURNING id`; when a row changed, insert an audit row `enquiry_handled` (`before {status:'new'}`, `after {status:'handled'}`).
- Compare-and-set on `status = 'new'`, so two staff clicking at once yield exactly one audit row (test `32-staff-console.test.ts:142`).
- Idempotent: when nothing changed it checks the id exists and answers `{ ok:true }` if so, `{ ok:false, error:"That enquiry doesn't exist." }` if not. The route maps that error to HTTP 404.
- Rate limit at the route: `staffAction` (600 per hour) (`handled/route.ts:7-8`).

There is no reply feature: staff reply from their own mail client via the `mailto:` link on the page (`enquiries/page.tsx:60`; the address passed the e-mail validator at submission). There is no "re-open" action; handled is terminal.

## 4. Privacy and retention notes

- The table stores free text and an e-mail address with no expiry job in the code read. Retention is an open decision (HD-06 inputs under `docs/delivery/HD-06-PRIVACY-INPUTS.md`).
- The e-mail copy sent to `ENQUIRY_NOTIFY_EMAIL` places the same personal data in a mailbox outside the database; the mailbox's retention is outside this system.
- Enquiries sent by a signed-in member carry `user_id`, shown to staff only as "signed-in member".

## 5. Tests

`tests/integration/31-public-pages.test.ts:69-119`: refuses without a token and stores nothing; stores anonymous; attaches the signed-in user; honeypot dropped; per-connection limit. `37-journey-staff.test.ts:230-285`: visitor sends, staff see and mark handled, leaves new list, audit row. `32-staff-console.test.ts:141-170`: content admin handles once with one audit row; unauthorised roles and unknown id refused. There is no unit test of `validation.ts`.

## 6. Limitations

- The 3-per-hour limit is per address; users behind a shared institutional address (a campus NAT) share it. Whether the deployed `clientIp` sees real client addresses is not determined here.
- Stale JSDoc noted above.
- No pagination bounds issue: `page` is parsed by `parsePage` (1..100000).
