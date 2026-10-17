# Implementation progress after audit

For the resumed 2026-10-17 state and validation, see `../delivery/CONTINUATION-2026-10-17.md`. This note records the initial implementation work on 2026-10-09.

2026-10-09. Candidate branch: `codex/production-v1`. This is a progress record, **not production certification**. The historical audit documents remain unchanged.

Implemented in this candidate:

- Removed accidental Server Action transport from six internal service modules; added session ownership checks to member application, notification and event readers.
- Selected minimal reviewer applicant fields and minimal application summaries; denied staff draft detail and document access.
- Validated upload question/type membership and actual byte length; removed replaced objects and files rejected by the draft lock after successful storage. Cleanup failure reconciliation remains open.
- Made password-reset token consumption, password replacement and session revocation atomic. Verification token consumption and email verification also commit together.
- Serialized account/role changes and rechecked actor privileges under the same lock to preserve an active super admin.
- Added bounded form network recovery without automatic write retries, honest resend/logout failure states, an explicit staff-role Apply button, repaired mobile drawer sizing/focus/resize cleanup, and repaired several contact/destination links.
- Failed closed for hosted production without origin verification and for cross-origin writes without an allowlist; remote production databases require verified TLS.
- Added a production HTTPS origin ALB template and closed direct production app ingress. The template remains unprovisioned and requires budget/account/DNS acceptance.
- Required exact-SHA CI and completed ECR vulnerability scans before release digests are accepted.
- Preserved the received staff logout, walkthrough, lab service and journey-test changes; repaired ambiguous selectors, analytics test isolation, the migration command exit check and inherited mail transport.

Validation so far:

- Production build succeeds; TypeScript succeeds. The build still emits the pre-existing dynamic-render analytics diagnostic.
- Unit and infrastructure checks pass in the runs completed so far; final candidate totals will be recorded after all changes finish.
- Lint has zero errors, with the existing warnings retained.
- The production Server Action table contains only the two intended Payload handlers; internal service registrations are absent.
- Browser verification at 375×900: drawer rectangle x=0, y=72, width=375, height=828. At 1280×900 it is removed and body overflow is restored.
- Full integration acceptance is in progress. New concurrency and fault-injection checks must pass before this candidate can be accepted.

Unchanged launch blockers include institutional privacy approval, AWS/DNS access, runtime/migration least privilege, durable delivery and reconciliation, real provider acceptance, populated upgrade/restore/rotation/alarm drills, capacity and hosted acceptance. No AWS resources, production DNS or persistent student records have been changed. No cloud task exists until a repository environment is connected; see `docs/delivery/CLOUD-CONTINUATION.md`.
