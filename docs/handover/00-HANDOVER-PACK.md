# KNEST handover pack

Date: 2026-10-12. Repository `KNEST-KIIT/knest`, branch `codex/production-v1`.

This pack is the single entry point to the documentation that describes the system as it is. It is written so that a KNEST staff member can find what they need and so that a new engineer can take over the system without the original team. Every volume says what is proven and what is not.

## How to read this pack

| If you are | Start with | Then |
|---|---|---|
| A KNEST director or approver | Volume A | Volume H (status) |
| A KNEST staff member or reviewer | Volume B | Volume C |
| A laboratory head or assistant | Volume C | Volume B |
| An engineer taking over | Volume D | Volumes E, F, G |
| An operator on call | Volume F | Volume G |

## Volumes

| Vol | Title | Contents | Document |
|---|---|---|---|
| A | Product and scope | What the platform is, surfaces, users, what is deliberately absent, contract module map | `docs/PRODUCT_ARCHITECTURE.md`, `docs/delivery/CONTRACT-TRACEABILITY.md`, `docs/delivery/V2-FULL-RELEASE-PLAN.md` |
| B | Staff and content operations | Running the review queue, editing content, publishing, enquiries, members | `docs/handover/STAFF-WALKTHROUGH.md`, `docs/handover/CONTENT-EDITING-GUIDE.md` |
| C | Laboratory operations | Labs, hours, closed dates, staff, booking approval, attendance, reports | `docs/handover/LAB-OPERATIONS-GUIDE.md`, `docs/delivery/LAB-BOOKING-DESIGN.md` |
| D | Architecture | Modular monolith, data split (cms and app schemas), identity, service layer, flags | `docs/handover/ARCHITECTURE.md`, `docs/delivery/AWS-NATIVE-ARCHITECTURE.md` |
| E | Reference | Routes and pages, environment variables, database schema and migrations, feature flags, rate limits | `docs/handover/REFERENCE-ROUTES.md`, `docs/handover/REFERENCE-ENVIRONMENT.md`, `src/db/schema`, `src/db/migrations` |
| F | Operations | Deploy, rollback, restore, alarms, cutover, DNS, mail, secrets | `docs/handover/RUNBOOK.md`, `docs/delivery/CUTOVER-RUNBOOK.md`, `docs/delivery/DRILLS.md`, `docs/delivery/EMAIL-SETUP.md`, `docs/delivery/DNS-MIGRATION.md`, `docs/delivery/OPERATOR-COMMANDS.md` |
| G | Security and quality | Security review, threat model, dependency triage, access model, accessibility, load test | `docs/delivery/SECURITY-REVIEW.md`, `docs/delivery/LAB-ATTENDANCE-THREAT-MODEL.md`, `docs/delivery/DEPENDENCY-TRIAGE.md`, `docs/delivery/IAM-OPERATOR-AND-SETTINGS.md`, `docs/handover/ACCESSIBILITY-REVIEW.md`, `docs/handover/ACCESSIBILITY-MANUAL-TEST.md`, `docs/handover/LOAD-TEST.md` |
| H | Status and evidence | What is built, what is proven, what is open, delivery audit | `docs/delivery/DELIVERY-AUDIT-2026-10-12.md`, `docs/delivery/LOCAL-COMPLETENESS.md`, `docs/delivery/FINDINGS.md`, `docs/delivery/TRACKER.md`, `docs/delivery/V1-DEPLOYMENT-REPORT.md` |
| I | Approvals and inputs | What KIIT must supply before public launch | `docs/delivery/KIIT-INPUTS-REQUEST.md`, `docs/delivery/HD-06-PRIVACY-INPUTS.md`, `docs/delivery/HD-16-LAB-POLICY-QUESTIONNAIRE.md` |

## System at a glance

| Aspect | Fact |
|---|---|
| Stack | Next.js 16 App Router, Payload CMS 3, PostgreSQL 16, Drizzle migrations, Auth.js v5 (database sessions) |
| Data | One PostgreSQL database, two schemas: `cms` (editorial content, owned by Payload) and `app` (operational data: users, applications, bookings, audit) |
| Hosting design | CloudFront and WAF at the edge, an Application Load Balancer, one EC2 host running the container image by digest, RDS PostgreSQL, S3 for documents and media, SES for mail, Secrets Manager and SSM for configuration |
| Release | GitHub Actions: exact-commit CI gate, image scan gate, OIDC roles with no long-lived keys, deploy through an SSM document that snapshots the database, migrates, starts, and rolls back if unhealthy |
| Feature flags | `FEATURE_LAB_BOOKING` (off by default), `FEATURE_LAB_ATTENDANCE_QR` (off by default, requires the first) |
| Tests | Unit tests, integration tests against a real PostgreSQL in CI with a production build and a real browser, automated accessibility scans, header and edge-control tests |

## What the platform does not do today

State this plainly to anyone relying on the system:

- It is not publicly launched on `kiitnest.com`. A gated preview exists.
- Privacy notice and terms text are not approved; the pages say so.
- Real-device behaviour of QR, camera, installation and offline operation is unproven.
- Restore, rollback and alarm drills have not been recorded as executed on the hosted stack.
- It runs on a single host and a single-zone database in the current design.

## Support and responsibilities

The maintenance and support arrangement (response times, release cadence, drills, on-call, escalation and renewal) is governed by the AMC. The responsibilities below are what the platform team provides under it, so that KNEST knows exactly what to expect and when to call.

| Area | Provided |
|---|---|
| Incident response | Priority-1 response within the AMC window, including failed lab check-in |
| Releases | Monthly release with notes, the exact commit, test evidence and rollback state |
| Security | Dependency triage on a schedule, patching of critical and high advisories, review of findings |
| Recovery | Periodic restore and rollback drills with dated evidence |
| Monitoring | Alarm review, capacity review, cost review |
| Change requests | Scoped, estimated and approved before work |

## Keeping this pack true

- Generated references (`REFERENCE-ROUTES.md`, `REFERENCE-ENVIRONMENT.md`) are rebuilt from the source tree; regenerate them after route or environment changes.
- Status documents are reconciled against the git history and CI on each release.
- Nothing in this pack claims verification in production that has not been recorded in `docs/delivery/EVIDENCE/`.
