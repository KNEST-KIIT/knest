# 09. E-mail delivery: transports, durable outbox, operator resend, templates

Files: `src/server/email/send.ts`, `outbox.ts`, `admin.ts`, `templates.ts`; `src/db/schema/email-outbox.ts`; `src/instrumentation.ts`; admin UI `src/app/(staff)/admin/mail/`; route `src/app/api/admin/mail/[id]/resend/route.ts`. Setup steps for SES identity and DNS are in `docs/delivery/EMAIL-SETUP.md`; that document states the SES identity does not yet exist and sending has not been exercised from the build environment, and this volume makes no delivery claim either.

## Purpose and shape

Every outgoing message goes through `sendEmail`. Verification and reset links are credentials, so losing one to a provider outage means a person cannot get into their account. The outbox stores the message before the first send and retries with back-off.

```
caller
  sendEmail(msg, {ttlMs?})                              send.ts:64-68
    EMAIL_OUTBOX=off ? sendEmailDirect(msg)
    : sendDurably(msg, ttl)                             outbox.ts:70-91
         INSERT email_outbox (pending, lease 2 min, expires now+ttl)
            fails -> sendEmailDirect(msg); errors reach the caller
         attempt(id, msg)                               outbox.ts:38-67
              sendEmailDirect OK   -> status sent, body '' , sent_at
              sendEmailDirect fail -> attempts+1, last_error
                                       attempts >= 8 or expired -> dead / expired
                                       else next_attempt_at = now + backoff
retry worker (every 30 s per process)                  outbox.ts:132-179
```

## Transports (`send.ts`)

| Selection | Condition | Behaviour |
|---|---|---|
| SES | `EMAIL_TRANSPORT === 'ses'` (`:74`) | `@aws-sdk/client-sesv2` loaded by dynamic import; client created once with region `AWS_REGION` or `S3_REGION`; credentials from the SDK default chain (the instance role on AWS, no stored secret). `SendEmailCommand` with `FromEmailAddress`, one `ToAddresses` entry, UTF-8 subject, plain-text body, optional `ConfigurationSetName` from `SES_CONFIGURATION_SET` (`:21-36`, `:48-54`) |
| SMTP | `SMTP_HOST` set at process start | `nodemailer` transporter built once at module load: port `SMTP_PORT` or 587; `secure` only when the port is exactly 465; auth only when `SMTP_USER` is set (`:38-45`). Changing SMTP settings needs a restart |
| Console | neither, and not production | Logs `To`, `Subject` and the full text to stdout, so development links are visible (`:86-88`) |
| Refusal | neither, and `NODE_ENV === 'production'` | Throws "No mail transport is configured; refusing to log the message body." The body is a credential and must not reach CloudWatch (`:80-85`, SECURITY-REVIEW S-03) |

`EMAIL_TRANSPORT=smtp` is accepted by `env.ts` but `send.ts` only tests for `'ses'`; any other value behaves as "use SMTP_HOST if set". The enum value `smtp` has no distinct code path.

From address: `EMAIL_FROM`, else `KNEST <no-reply@knest.kiit.ac.in>` (`send.ts:16`, `:72`). `env.ts:31` requires `EMAIL_FROM` in production, so the default is for development. The default domain differs from the SES identity domain named in `EMAIL-SETUP.md` (`kiitnest.com`); which domain production uses is set by the `email-from` parameter (`infra/cfn/app.yaml:586`) and is not determined from the code.

Message shape: plain text only. No HTML part, no `Reply-To`, no list headers, no custom `Message-ID`. Recipient is exactly one address.

`sendEmailDirect` throws on any provider failure; `sendViaSes` lets the error reach the caller by design (`send.test.ts:30`).

## Outbox (`outbox.ts`)

### Constants

| Name | Value | Line |
|---|---|---|
| `DEFAULT_TTL_MS` | 24 hours | `:20` |
| `MAX_ATTEMPTS` | 8 | `:21` |
| `LEASE_MS` | 2 minutes | `:22` |
| `BACKOFF_MS` | 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h | `:23` |
| `DEAD_BODY_RETENTION_MS` | 7 days | `:18` |
| Worker interval | 30 s | `:166` |
| `processDue` default batch | 20 | `:132` |

`backoffMs(failedAttempts)` clamps its argument between 1 and 7 (`:26-28`). The seven delays sum to 22 h 21 min, so eight attempts finish inside the 24 hour TTL: attempt 1 is immediate, attempt 8 occurs about 22 h 21 min later (test `outbox.test.ts:5`).

### Row lifecycle

`pending` becomes `sent`, `expired` or `dead`. `dead` means eight failed attempts. `expired` means `expires_at` passed before success.

| Transition | Where | Body |
|---|---|---|
| to `sent` | `attempt` (`:41`) | blanked to `''` |
| to `expired` | `attempt` (`:55`), `processDue` (`:154`) | blanked |
| to `dead` | `attempt` (`:55`) | kept so an operator can resend |
| dead body blanked | start of `processDue` (`:133-136`) | when `created_at` is older than 7 days |

`body` of a pending or dead row contains the raw e-mailed link. That is a second copy of the credential beside the hashed `verification_tokens` row (file 04).

### `sendDurably(message, ttlMs = DEFAULT_TTL_MS): Promise<void>` (`:70-91`)

1. Insert the row with `next_attempt_at = now + 2 min` (a lease for the immediate attempt, so the worker does not pick it up concurrently) and `expires_at = now + ttl`.
2. If the insert throws (database down): log `email_outbox_unavailable <description>`, call `sendEmailDirect` and let its error propagate. This is the only path where the caller sees an error.
3. `attempt(id, message)`.

The first attempt runs inside the request, so provider latency adds to sign-up, reset and verify request latency. No timeout is set on the SES call in this file; nodemailer and the AWS SDK use their own defaults (not determined).

### `attempt(id, message)` (`:38-67`)

Success path: `sendEmailDirect`, then `UPDATE ... SET status='sent', sent_at, body='', last_error=NULL`.

Failure path: `UPDATE attempts = attempts + 1, last_error = describeError(error) RETURNING attempts, expires_at`. If `attempts >= 8` or `expires_at <= now`: status `expired` (with blank body) when expired else `dead`; log `email_outbox_dead id=... attempts=... reason=expired|attempts error=...`. Otherwise set `next_attempt_at = now + backoffMs(attempts)` and log `email_outbox_retry`.

`describeError` (`:31-34`) makes the error one line, replaces anything shaped like an address with `<address>` and truncates at 300 characters, because provider messages can echo recipients (`outbox.test.ts:13`).

Delivery semantics: at least once. If `sendEmailDirect` succeeds and the following `UPDATE` to `sent` fails (database error), the exception lands in the same `catch`, the row is recorded as a failure and will be sent again (D-03).

### `requeue(id, actorUserId)` (`:100-129`)

Operator resend. In one transaction: `SELECT ... FOR UPDATE`; return `not_found`, `not_resendable` (status not dead or expired) or `no_body` (blanked); otherwise set `status='pending'`, `attempts=0`, `last_error=NULL`, a new 2 minute lease, `expires_at = now + 24 h`, and insert the `email_resent` audit row with `before {status, attempts}` and `after {status:'pending'}`. After commit make one `attempt`. Returns `'queued'` even if that attempt fails (the row then follows the normal retry path).

The row lock is why two operators pressing Resend send one message: the second sees `pending` and gets `not_resendable` (test `45-accounts-modules.test.ts:228`).

### `processDue(limit = 20): Promise<number>` (`:132-161`)

1. Blank bodies of dead rows older than seven days.
2. In a transaction: `SELECT id FROM email_outbox WHERE status='pending' AND next_attempt_at <= now ORDER BY next_attempt_at LIMIT n FOR UPDATE SKIP LOCKED`, then `UPDATE next_attempt_at = now + 2 min` for those ids `RETURNING` the message fields. The lease is the claim; the transaction commits before any network call.
3. For each claimed row: expired rows become `expired` (blanked) and are logged; the rest `attempt`.

Returns the number claimed. Safe from several processes because of `SKIP LOCKED` and the lease.

Lease risk: a send that takes longer than two minutes could be claimed again by another worker and sent twice (D-03b).

### Worker start (`startOutboxWorker`, `:166-179`; `instrumentation.ts:13-15`)

`setInterval` every 30 s, guarded by a `running` flag so a slow batch does not overlap itself, with `unref()` so it does not hold the process open. Errors are logged `email_outbox_worker`.

It is started from `register()` only when `NEXT_RUNTIME === 'nodejs'` and `shouldCheckEnv(process.env)` is true (production, not the build phase, not a Vercel preview) and after the environment check passed (`instrumentation.ts:2-15`). Consequences: in development and in the integration suite there is no retry worker; a failed first attempt stays `pending` until a production process runs; and a deployment that fails the environment check does not start it.

## Operator view (`admin.ts`, `/admin/mail`)

- `listOutbox({ filter?, page? })` requires `requireStaffOrThrow('mail')`, which is super admin only (`roles.ts:29-30`). Filters: `attention` (default: `dead` and `expired`), `pending`, `sent`, `all`. Page size 25, newest first. Returns recipient, subject, status, attempts, `lastError`, timestamps and a computed `resendable` flag; the body is never selected (`admin.ts:20-54`). Also returns counts per status.
- `resendOutboxMessage(id)` requires the same area and calls `requeue`; failures map to 404 (`not_found`), 409 (`not_resendable`, `no_body`) with messages (`:56-72`).
- The page layout calls `requireAdminArea('mail')` (`(staff)/admin/mail/layout.tsx:5`); the route handler applies `limitByUser('staffAction')` (`resend/route.ts:8`).
- Test: `45-accounts-modules.test.ts:183-238` (closed to other staff roles with 404 and 403; list shows failure text but not content; resend delivers once with one audit row; second press 409; blanked row 409 with "request a new link").

A dead message's body is not visible to the operator even though it is stored; the operator can only resend or ignore.

## Monitoring hooks

| Signal | Source | Consumer |
|---|---|---|
| Log `email_outbox_dead` | `outbox.ts:57`, `:155` | CloudWatch metric filter `EmailDeadMetricFilter` and `EmailDeadAlarm` in `infra/cfn/app.yaml:661-684` (sum greater than 0 in a 5 minute period); one occurrence is meant to alarm |
| Log `email_outbox_retry` | `outbox.ts:64` | Visible in the log group only |
| Log `email_outbox_unavailable`, `email_outbox_worker` | `outbox.ts:86`, `:173` | Log group only |
| `GET /admin/mail?filter=attention` | `admin.ts` | Human |

No metric counts successful sends or oldest pending age; stuck `pending` rows with a dead worker would raise no alarm. The alarm covers only rows that reached `dead` or `expired` (both log `email_outbox_dead`).

## Templates (`templates.ts`)

Copy is taken from `CONTENT_SPEC.md` section 7.

| Function | Subject | Body notes |
|---|---|---|
| `verifyEmailTemplate(link)` | "Confirm your email for KNEST" | States the link expires in 24 hours |
| `resetPasswordTemplate(link)` | "Reset your KNEST password" | States "expires in 1 hour"; "If it wasn't you, ignore this" |
| `accountExistsTemplate(loginLink, resetLink)` | "You already have a KNEST account" | Sent to an address that tried to sign up again |

Application and event templates are in `notifications/templates.ts` (file 10). Status-change subjects are identical for every outcome so a lock-screen preview cannot deliver a rejection in public.

## Limits and open items

| ID | Item |
|---|---|
| D-02 | Every message uses the 24 hour outbox TTL (`sendEmail` is called without `ttlMs` in `actions.ts:114`, `:150`), but the reset link expires after 1 hour. A reset mail that was retried after the first hour carries a link that is already dead, and an operator resend of an old reset or verification mail sends the same dead link. The `ttlMs` option exists and is unused |
| D-03 | At-least-once delivery; duplicates possible on a failed `sent` update or an over-long send |
| L-12 | `sent` rows are kept indefinitely with recipient address and subject (body blanked); no retention job located |
| L-13 | SES bounce, complaint and suppression handling is not implemented in the application; the sandbox request text in `EMAIL-SETUP.md` says "bounces and complaints are handled by suppression" which refers to SES account-level suppression, not code |
| L-14 | Dead-row body retention counts from `created_at`, not from when the row died, so a dead row keeps its body for at most about six days |
| - | Unit tests cover `sendViaSes`, `backoffMs` and `describeError`. The queue paths (`attempt`, `processDue`, `requeue`) are covered only through the integration suite's operator-resend test and the sign-up and reset flows that read the SMTP stub |
