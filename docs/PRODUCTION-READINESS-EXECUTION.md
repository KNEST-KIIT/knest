# KNEST consumer V1 — production-readiness execution contract

Owner intent recorded 27 October 2026: deliver a world-class, end-to-end consumer product and make the exact candidate ready to host. This document is the live acceptance contract; passing source tests alone is not a launch decision.

## Locked V1 scope

### Consumer journeys

- Approved public homepage, programs, events, startups, mentors, resources, search, contact and legal/privacy content.
- Password and optional Google sign-in, verification, recovery, safe return paths and account-state handling.
- Role-aware onboarding for students, founders, mentors, investors, alumni and partners.
- Program discovery → eligibility/open-state explanation → draft → save/resume → upload → validate → submit → track.
- Truthful role dashboards with next actions, compact notifications and safe resource destinations.

### Staff journeys

- Authorized CMS publishing for the selected public content types.
- Submitted-application queue, filters, detail review, decisions, notes, history and audit trail.
- Member administration, durable email delivery/dead-letter handling and enquiry ownership.
- Events only when an operating owner accepts publication, registration and support responsibility.

### Explicitly disabled unless separately accepted

- Lab booking and attendance operations.
- QR passes/scanning, device workflows, PWA installation and offline operation.
- Any workflow that depends on unresolved institutional policy, staffed operations or unproved provider behavior.

Disabled capabilities must have no navigation, callable write path, background write or misleading promise when their feature flags are off.

## Non-negotiable release gates

1. **Scope and truthfulness** — every visible promise has a working destination and owner; no fake progress, placeholder claims or dead conversion paths.
2. **Authorization and privacy** — anonymous/cross-user reads fail; staff DTOs are minimal; drafts/internal notes/password hashes never cross an unintended boundary; all mutation paths share the required verification/CAPTCHA/ownership controls.
3. **Data correctness** — application transitions, uploads, notifications, email delivery and admin invariants are atomic, idempotent where required and covered by negative/concurrency tests.
4. **Product quality** — mandatory journeys work at 390px and desktop; keyboard, focus, screen-reader announcements, zoom, loading, empty, offline/network-failure and retry states are accepted. Motion is purposeful and respects reduced-motion.
5. **Design coherence** — one restrained KNEST visual language, deliberate spacing/control-height tokens, readable hierarchy and touch targets of at least 44px where appropriate. No gratuitous gradients, glass, giant shadows, pill clutter, hover scaling or generic AI copy.
6. **Authentication** — password and Google flows work end to end with account linking, deactivation, recovery and redirect safety; login throttling is tested without being disguised by a workflow harness.
7. **Release candidate** — clean exact commit, secret scan, dependency/advisory disposition, typecheck, zero-error lint, unit/integration/build/image/health tests and trustworthy browser evidence all refer to the same SHA.
8. **Infrastructure** — HTTPS from consumer through CloudFront to origin, direct-origin restriction, least-privilege runtime database identity, S3/SES/Turnstile/Google/DNS proof, alarms and cost controls.
9. **Recovery and operations** — populated upgrade, database/S3 restore, credential rotation/reconnect, rollback, alert delivery, retention and incident ownership are rehearsed and evidenced.
10. **Launch authority** — approved legal/privacy content, named operators and an explicit owner go/no-go precede public traffic or real student data.

## Evidence rules

- Classify each item as `implemented`, `source-reviewed`, `regression-tested`, `browser-tested`, `hosted-provider-tested` or `owner-accepted`; do not collapse them into “verified”.
- Browser assertions must be capable of failing, record final URL/heading/state on failure, and must not evade security controls while claiming real-flow coverage.
- Preserve raw logs/screenshots in ignored evidence only; never commit credentials, sessions, private records or local fixture data.
- A green local candidate remains **not production ready** until infrastructure, recovery, provider and owner gates are completed.

## Execution order

1. Repair remaining P0/P1 security, auth-ownership, data-minimization and structured-error gaps.
2. Complete consumer/staff journey recovery, accessibility and responsive/design-system consistency.
3. Run exact local candidate checks and a trustworthy persona browser matrix.
4. Freeze scope; remove or hard-disable everything deferred.
5. Prepare a clean reviewable commit and exact-SHA release manifest, without deploying until separately authorized.
6. Complete private hosted provider/TLS/restore/rotation/alarm acceptance.
7. Obtain explicit owner go/no-go before DNS cutover or real consumer data.

## Current decision

**Not yet approved for public consumers.** Continue local implementation and verification. No public deployment, DNS cutover or real-data use is authorized by this document.
