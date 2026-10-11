# Outgoing mail: SES sender verification and durable retry

Date: 2026-10-11. Status: engineering complete and tested locally; the AWS identity and the DNS records are **not yet created** (see `OPERATOR-COMMANDS.md`). Until the identity is verified and the account leaves the SES sandbox, no verification or reset mail reaches a real student.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Durable outbox | `src/db/schema/email-outbox.ts`, migration `0011_email_outbox.sql` | Every message is stored before it is handed to SES. The body is blanked as soon as the row leaves `pending`, so single-use links do not accumulate. |
| Retry worker | `src/server/email/outbox.ts`, started from `src/instrumentation.ts` | Attempts immediately, then retries with backoff 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h (8 attempts or 24 h, whichever comes first). Rows are leased with `FOR UPDATE SKIP LOCKED`, so a second host or a restart never double-sends. |
| Alarm | `app.yaml`: `EmailDeadMetricFilter`, `EmailDeadAlarm` | One abandoned message raises an alarm to the alert topic. |
| Sender identity | `infra/cfn/ses.yaml` | SES domain identity `kiitnest.com` with Easy DKIM (2048-bit). No SPF or MX change. |

Behaviour change worth knowing: `sendEmail` no longer throws when SES rejects a message. The message is queued and retried, and the person sees the normal "check your inbox" screen. A message the outbox gives up on is visible only in the alarm and in `app.email_outbox` (`status = 'dead'`, `last_error`).

## Steps to make mail work (in order)

1. **Create the identity** (ap-south-1): deploy `infra/cfn/ses.yaml` as stack `knest-production-ses`.
2. **Read the three DKIM records** from the stack outputs `DkimName1..3` and `DkimValue1..3`. Each is a CNAME: `<token>._domainkey.kiitnest.com` pointing at `<token>.dkim.amazonses.com`.
3. **Add them at GoDaddy** (additive; the account owner must approve each change with the emailed one-time code). Use the host part only (`<token>._domainkey`), type CNAME, TTL 1 hour, no existing record is edited. Do **not** touch MX, the SPF TXT or DMARC.
4. **Wait for verification**: `aws sesv2 get-email-identity --email-identity kiitnest.com --region ap-south-1 --query '{v:VerifiedForSendingStatus,d:DkimAttributes.Status}'` should show `true` and `SUCCESS` (minutes to an hour).
5. **Leave the sandbox** (account level, once): the console request "Request production access" in ap-south-1, or `aws sesv2 put-account-details --production-access-enabled --mail-type TRANSACTIONAL --website-url https://kiitnest.com --use-case-description "..." --additional-contact-email-addresses pinakipattnaik@gmail.com --contact-language EN --region ap-south-1`. The use case text to paste: *Transactional mail only for a university incubator platform: account verification links, password resets, application status notifications. No marketing. Recipients sign up themselves; bounces and complaints are handled by suppression. Expected volume under 2,000 messages per month.* AWS answers within about a day; until then only verified recipient addresses receive mail, which is enough for the private preview if the owner verifies a test mailbox.
6. **Prove it**: sign up with a mailbox you control and read the received headers for `dkim=pass` and `dmarc=pass`. Keep the headers (with the address redacted) as evidence.

## Preview-time shortcut (sandbox)

While the account is in the sandbox, verify one personal address so a real mail can be received:
`aws sesv2 create-email-identity --email-identity <address> --region ap-south-1` and click the link AWS sends. Remove it afterwards.

## Failure modes and how they show

| Symptom | Likely cause | Check |
|---|---|---|
| `email_outbox_retry` lines in `/knest-production` log | identity not verified, still sandboxed, or recipient not verified in sandbox | `get-email-identity`, `get-account` |
| `EmailDeadAlarm` fires | a message ran out of attempts or passed its 24 h life | `select status, attempts, last_error from app.email_outbox where status in ('dead','expired') order by created_at desc` (read only) |
| Mail arrives in spam | DKIM not aligned or DMARC policy | headers, `dns-compare.mjs` against the snapshot |

## Not claimed

SES sending has not been exercised from this environment: the identity does not exist yet. Delivery, DKIM alignment and the exit from the sandbox are open until steps 1 to 6 are done.
