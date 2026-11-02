# Platform edge-case and error-case audit, 2 November 2026

Scope: the whole platform, read part by part (auth, applications, labs, CMS, email, storage, database,
infrastructure, public site). Static review of branch `codex/production-v1`; the fixes below are in the working
tree, uncommitted, and nothing has been deployed.

Status key: **Fixed** (code changed, covered by the unit suite), **Operator** (needs AWS or an owner action),
**Decision** (needs an owner decision first), **Follow-up** (larger change, not started).

## Fixed in this change

| Part | Finding | Change |
|---|---|---|
| 1 | Pool had no error handler: a database failover crashed the process | `src/db/client.ts` attaches an `error` listener |
| 1, 4 | No connection, statement or idle timeouts: a saturated database hung every request | `src/db/pool-settings.ts`, used by the app pool and the Payload pool; migrations run without a statement timeout |
| 1 | Per-IP login limit counted successes, so a campus behind one address locked itself out | `login/route.ts` spends the address budget on failures only; capacity 5 to 20 |
| 1 | A database error looked like a logout and sent people to a sign-in that also fails | `requireUser` throws to the error page when the lookup itself failed |
| 1 | A reset link could finish for a deactivated account | `resetPassword` requires `isActive` |
| 1, 2, 3 | Unexpected errors returned an HTML 500 to `fetch().json()` callers | `src/server/http/errors.ts` (JSON 500, or 503 with Retry-After for connection, pool and timeout errors), used by 15 API routes and the lab wrappers |
| 2 | `HANDLERS[step]` resolved inherited keys such as `constructor` | `Object.hasOwn` |
| 2 | Upload route buffered the body before checking who was sending it | session and `Content-Length` checked first |
| 2 | Non-string `programSlug` / `questionId` reached the database | type-checked |
| 2 | A repeat Submit after a timeout read as a failure | `code: 'already-submitted'`, the form treats it as success |
| 2 | A date-only deadline closed at 05:30 or 17:30 IST that day | `deadlineInstant`: date-only values run to 23:59:59.999 IST; explicit times are honoured |
| 3 | Attended sessions dropped out of the weekly-hours cap | `completed` bookings count |
| 3 | Accepting a proposed time skipped the assistant rule, and told nobody | propose can name an assistant; accept requires one; heads are notified; audit rows written |
| 3 | A request could be approved into a time that had already passed | refused |
| 3 | IndexedDB that exists but will not open lost scans | `ResilientDeviceStore` falls back to memory and reports `persistent()` |
| 4 | Anonymous REST could ask for `limit=0` or a huge page | `edge-guard` rejects it (400) for visitors without a session; GraphQL disabled; `maxDepth` 3; media upload cap 10 MB |
| 4 | Search was unthrottled and fanned out five queries | per-address limit, 100-character cap |
| 4 | A database error read as "program not found" | only 404 and 403 become null |
| 5 | The first send attempt blocked the request; SES and SMTP had no timeouts | durable row, then a 4 s bounded wait; explicit client timeouts |
| 5 | A failed "mark sent" counted as a failed send and mailed the person twice | send and bookkeeping separated |
| 5 | Reset mail was retried for 24 h though its link lives 1 h | per-message TTL matches the token |
| 6 | Scanner timeout of 3 s refused ordinary documents | 20 s default |
| 6 | One S3 client built per call, no timeouts | cached client with timeouts |
| 6, 8 | A missing scanner or a lost document object was silent | boot and upload log lines, plus alarms (below) |
| 7 | The app role could rewrite the audit trail | `UPDATE` and `DELETE` revoked on `app.audit_logs` |
| 1, 7 | Expired sessions, tokens and rate-limit buckets were never removed | `src/server/maintenance/cleanup.ts`, daily |
| 8 | Missing alarms | `app.yaml`: EC2 system-status auto-recovery, RDS credit balance, connections and memory, scanner missing, document object missing, email retries, session lookup failures. `origin.yaml`: target 5xx and slow responses |
| 9 | 27 of 58 pages had no error boundary | `error.tsx` for `(auth)`, `(public)`, `(member)`, `(staff)` and `lab-device` |
| Hackathons | `getTeamSubmission(teamId)` returned any team's submission, drafts included, to any caller (every export of a `'use server'` file is a public endpoint) | requires sign-in and team membership (or hackathon staff) |
| Hackathons | A direct address showed draft hackathons; the gallery ignored `galleryPublic` | draft hidden from non-staff; private gallery returns nothing |
| Hackathons | A community vote trusted the caller's `hackathonId`, never checked the event's status, and shared a rate-limit key with other actions | the vote's hackathon comes from the submission; only `submitted` projects, event in `judging` or `completed`, public gallery; own namespaced limit; duplicate click safe |
| Hackathons | Judge scores accepted any criterion id, any notes length, any event status | criteria must belong to the event, notes capped, scoring only in `judging` |
| Hackathons | Registration allowed in any non-draft status; submission drafts and text unbounded | registration only while `open` and inside its window; drafts only in `open`/`building`; text and list sizes clipped |
| Hackathons | Webhook addresses were fetched as typed (server-side request to any host); Telegram messages interpolated raw text; emoji in messages; no size limits | Discord address must be a real Discord webhook, Telegram token and chat id validated at save and at send, HTML escaped, sizes cut, redirects refused, emoji removed |
| Hackathons | Editing a hackathon overwrote its organiser; missing authorisation threw a plain `Error` (500); no input validation | organiser kept on edit, 403, slug/title/team size/window/webhook validation, duplicate slug reported |
| 3 | Scan batches asked the database about the same keys and roles for every event | key and role lookups remembered for the request (bookings deliberately are not) |
| 3 | Closing dates said nothing about bookings already inside them | `addBlackout` returns how many live bookings fall inside, so the screen can tell the head |
| 7 | No way to erase a person, and the foreign keys conflicted with five-year retention | `src/server/members/anonymise.ts` and `POST /api/admin/members/[id]/anonymise` (super administrator, confirm by typing the address): the account row stays as "Former member" with every identifier, credential, session, linked identity, notification and contact-form text removed, device keys revoked; applications and the audit trail stay. `scrubApplicationContent` also replaces answers and deletes documents. Default keeps them for the retention period: **that default is the policy decision to confirm**. Tested end to end (`tests/integration/51-anonymise-member.test.ts`) |
| 5 | SES could be paused by a high bounce or complaint rate with nobody told | `app.yaml`: alarms on SES `Reputation.BounceRate` (5 percent) and `Reputation.ComplaintRate` (0.1 percent) |
| 8 | A backup that has never been restored | `scripts/ops/restore-drill.sh` (dry-run mode, uses only the operator policy's drill permissions) and `docs/delivery/RESTORE-DRILL.md`. Syntax-checked; **not run against AWS** |
| Hackathons | Admin functions with no caller and no checks | leaderboard restricted to organisers; judge assignment checks the judge is active and every submission belongs to the event; announcements validate length and no longer claim e-mail was sent |
| 1 | **Found by the load test:** `bcryptjs` at cost 12 is about 0.5 s of CPU on the request thread. Ten sign-ins started together kept the event loop busy for about 7 s (6 turns where about 560 were due); sixty timed out past 30 s. A class signing in at once would freeze the whole site | `src/server/auth/password-work.ts`: password hashing and checking run one at a time with a bounded queue (40) and refuse past it with a retryable 503 that charges nobody; used by sign-in, sign-up, verify, reset and Google link. Queue of 20 (about ten seconds). Measured with `tests/integration/90-load-smoke.test.ts` (`TEST_LOAD=on`), 60 simultaneous sign-ins on a shared laptop: before, every request timed out past 30 s and the site froze; after, 24 probe requests made during the burst all returned 200 (slowest 1.7 s), 21 sign-ins were answered and 39 got the retryable 503, none hung |
| 3 | Content readers hit the database on every public visit | `src/server/content/cache.ts`: shared cache of published reads, expired at once by any CMS save (`src/payload/revalidate-hooks.ts`); proved against a real server by `tests/integration/48-content-cache.test.ts` (run with `TEST_CONTENT_CACHE=on`) |
| 3 | The lab desk code and the student's pass refreshed only if a timer tick landed in the first second of a step, so a backgrounded tab showed an expired code | refresh by comparing steps |
| 7 | Nothing stopped a migration from breaking the previous release (rollback runs the old image on the new schema) | `src/db/migration-safety.test.ts` fails on drop, rename, type change, SET NOT NULL, and NOT NULL without default, unless marked `knest:contract-ok` |

## Operator actions (cannot be done from the repo)

1. **Document uploads do not work in production.** The deployed environment never sets `MALWARE_SCANNER_URL`
   and defines no scanner, so every upload is refused (by design, fail closed). Either merge the GuardDuty
   pipeline from the `phase1-release` worktree or provide a scanner and set the variable. The new
   `malware_scanner_not_configured` line and `ScannerMissingAlarm` will fire until then.
2. The new alarms need no IAM change: the CloudFormation service role (`infra/s1/teardown-roles.json`) already has
   `ec2:*` and `cloudwatch:PutMetricAlarm` in `ap-south-1`, and `logs:*` on the stack's log group. The first EC2 alarm
   action in an account may need AWS to create its service-linked role; if the change set reports that, allow
   `iam:CreateServiceLinkedRole` once.
3. Run the restore drill: `bash scripts/ops/restore-drill.sh` (see `docs/delivery/RESTORE-DRILL.md`) and record the time.
4. Set the enquiry inbox: `aws ssm put-parameter --name /knest-ENV/config/enquiry-notify-email --type String --value <address>`
   (already read by the deploy script); without it nobody is told a contact message arrived.
4a. Once a scanner exists, point the app at it with `/knest-ENV/config/malware-scanner-url` (and optionally
   `/knest-ENV/config/malware-scanner-timeout-ms`); the deploy script now passes both through. Likewise
   `/knest-ENV/config/container-memory-mb` sets a hard memory ceiling on the app container; leave it unset until a
   normal run has been observed.
5. The SES reputation alarms are in the template. Per-address bounce suppression still needs a configuration set with an
   SNS destination, which the account owner creates.

## Decisions needed

- **Erasure and retention.** The anonymise routine now exists and keeps applications and the audit trail. Confirm the
  default for the applicant's own typed answers and uploaded documents (kept for the retention period unless
  `scrubApplicationContent` is set), and whether a request to erase must override retention. `applications.user_id`
  is still `CASCADE`, so a hard delete of a user row would remove their applications; the anonymise path never does that.
- **Deploy downtime.** Health-check timings are tightened (load balancer 30 s to 10 s interval, container 30 s to 10 s),
  which by arithmetic cuts the per-deploy gap from about 75 s to about 35 s; measure it on the first production deploy.
  Reaching zero needs two slots or a second instance and an AWS test bed: the design and the reasons it is not built
  blind are in `docs/delivery/ZERO-DOWNTIME-DEPLOY.md`. Say whether about 35 s per deploy is acceptable meanwhile.

## Follow-up (larger changes)

- Public pages are still rendered per request (the layout reads the session), but their database reads are now
  cached. Moving the signed-in header into a client island would let CloudFront cache whole pages.
- Zero-downtime deploys and a deploy gate that requests real pages (including a Payload page). The migration
  guard is in place; a CI step that boots the previous image against the new schema is not.
- Integration caveat found during this work: the suite starts `next start` on whatever `.next` build exists. It
  does not rebuild, so run `next build` first or the server under test is stale.
- Container memory limit and swap on the 2 GB host, and a host memory and disk alarm (needs the CloudWatch agent).
- Cap the staff review queue (200) with pagination; separate read and write budgets for `labScan`.
- Reviewed in the second pass with no further findings: `decide.ts`, `reports.ts`, `sitemap.ts`, event actions,
  member actions. Reviewed and fixed: hackathon actions, admin and webhooks; `manage.ts`.
- Still not reviewed: the lab-device UI panels, the remaining content readers, the hackathon judge console UI,
  `hackathons/admin.ts` announcement and judge-assignment paths beyond what is listed above. No load test was made.
- Verification: typecheck, lint of `src` and `tests`, the secret scan, 76 unit files (715 tests) and every
  integration file (including axe accessibility and the browser journeys) pass against a production build made
  from the changed code, plus the content-cache test run with `TEST_CONTENT_CACHE=on`. Nothing was deployed, so
  the CloudFormation changes are checked by the template unit test only.
- Load figures (60 concurrent public requests, 240 total, shared laptop with a throwaway database): all 240 returned
  200; p95 1.9 s with the content cache off and 3.9 s with it on. The cache did not help in this test: the data set
  is tiny and the cache starts cold, so 60 simultaneous first requests all miss together. Its benefit is database
  load at real volume, which this test does not measure. It is not a capacity test of the production host.
- Process note: an earlier set of integration passes ran against a stale `.next` build and proved nothing about the
  server changes; they were repeated after `next build`. That rerun caught one bad change of mine (refusing to
  remove a lab assistant who has upcoming bookings), which contradicted the designed behaviour and was reverted.

## Corrections made during the audit

- The upload body is capped at about 12 MB by `proxyClientMaxBodySize`, so the anonymous memory risk was lower
  than first stated; the pre-parse checks still close it.
- An ALB with every target unhealthy fails open, so the database-only `/api/health` is a Low issue, not High.
- The container runs with `--restart unless-stopped`, so a pool crash restarted rather than stayed down.
