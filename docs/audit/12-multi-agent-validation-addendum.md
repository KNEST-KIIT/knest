# KNEST multi-agent validation addendum

Validation date: 9 October 2026 (IST). Repository: `delivery/p1-containment` at committed baseline `27d3dcd242687aa4099e71b1f381d468054ee3d9`, plus the received dirty working tree.

## Team and audit boundary

Four independent review streams were reconciled by the lead reviewer:

- Product and frontend/UX
- Architecture, backend, data and security
- QA, DevOps, SRE and release management
- Independent CTO/red-team challenge

This was an audit-only pass. No application, infrastructure, test, deployment, DNS, provider or persistent-data change was made. A diagnostic `pnpm audit` temporarily normalized `pnpm-workspace.yaml`; that tool-generated rewrite was identified and restored exactly. The final working tree retains the ten received product/test changes plus audit artifacts.

## Executive decision

**NO-GO for public production or real student data.**

KNEST is a substantial modular application rather than a prototype. Public discovery, accounts, onboarding, applications, staff review, events, enquiries, notifications and CMS operations are materially implemented. The architecture does not need a rewrite or microservices.

Release remains blocked by:

1. Locally reproduced anonymous cross-user Server Action reads.
2. Incomplete CloudFront-to-origin TLS topology.
3. An explicit institutional hold on collecting real student data until privacy/terms inputs are approved.
4. No accepted, clean, exact release candidate or verified public hosting.
5. Unproved provider integrations, recovery, alert delivery, capacity and operational ownership.

No production breach is alleged. The security reproductions used synthetic local data.

## Current-state assessment

| Area | Assessment |
|---|---|
| Product | Coherent application-first core; authoritative V1 boundary unresolved |
| Frontend/UX | Substantial happy paths; mobile overlay, recovery and accessibility gaps |
| Architecture | Strong modular-monolith foundation; keep it |
| Backend/data | Good transactional controls in important flows; several atomicity and lifecycle gaps |
| Security | Public release blocked by confirmed cross-user reads and excessive reviewer DTOs |
| Testing | 349 unit tests pass; current integration evidence is not a green release gate |
| CI | Exact committed HEAD is green; current dirty candidate is not certified |
| Deployment | Templates exist; no verified usable hosted product or complete origin TLS path |
| Operations | Recovery, rotation, alert, capacity and responder acceptance incomplete |
| Documentation | Extensive, but README/scope/completion claims conflict |

The 54-row traceability matrix remains the best scope measure: 35 PARTIAL, 7 IMPLEMENTED BUT UNVERIFIED, 7 BLOCKED and 5 NOT IMPLEMENTED. An overall completion percentage would be misleading until the commercial release boundary is approved.

## Highest-priority technical findings

### P0 release blockers

- `listNotificationsForUser` and `listApplicationsForUser` are exported from file-level `use server` modules, trust a caller-supplied user ID, and do not authenticate or check ownership. Matching-page runtime probes returned another synthetic user's notification and application/private note.
- Production CloudFront configuration requires an HTTPS origin, while the current container/origin serves plain HTTP on port 3000 and the templates contain no complete ALB/reverse-proxy/host-certificate path.
- `docs/delivery/HD-06-PRIVACY-INPUTS.md` explicitly prohibits real student data before an approved notice and related institutional decisions.

### P1 work required for selected V1

- Return minimal reviewer DTOs; do not serialize `passwordHash`; restrict review visibility to intended application states.
- Separate migration ownership from a least-privilege runtime database identity and prove rotation/reconnect behavior.
- Make last-super-admin and password-reset/token invariants atomic.
- Validate that an uploaded document belongs to a file question; authenticate before multipart parsing; define replacement, orphan, retention, deletion and malware policies.
- Add a minimal durable email outbox/retry mechanism.
- Repair the zero-height mobile drawer, focus containment, resize cleanup and background interaction.
- Add reliable `catch/finally` recovery to core forms and preserve return paths.
- Repair application/onboarding keyboard and screen-reader behavior, admin confirmations, dead conversion links and misleading CMS homepage controls.
- Require exact-SHA CI and image-scan evidence before deployment; protect the intended default branch and Production environment.
- Prove populated migration recovery, database/S3 restore, RPO/RTO, external synthetic monitoring, alert delivery and named incident response.

Labs remain default-off and require a separate policy/product acceptance. QR passes, scanning, PWA and offline behavior are not implemented.

## Security claim corrections

- The earlier login/authentication CAPTCHA-bypass hypothesis remains **withdrawn**. Auth exports had API-route workers only; the matching runtime probe returned `{}` and created no session.
- A separate application-submit control gap exists: `submitApplication` is a registered Server Action in matching page workers, but Turnstile is enforced only by the API wrapper. This is source/manifest-confirmed but was not runtime replayed. Classify it P1 when submit CAPTCHA is a release requirement, otherwise P2 defense-in-depth. The caller still needs an authenticated, verified account and a valid owned draft.
- Anonymous cross-user reads are P0. Staff-authenticated reviewer serialization of password hashes/drafts is P1 least-privilege/data-minimization work, not anonymous hash dumping.
- Opaque Server Action IDs are not authorization, but public action-ID discovery was not demonstrated in this audit.

## Verification snapshot

- `pnpm typecheck`: pass.
- `pnpm lint`: pass with 0 errors and 31 warnings.
- `pnpm test`: 33 files and 349 tests passed.
- `pnpm build`: pass for the Next 16.4 standalone production build; prerender logged database/fallback and dynamic-server warnings that need classification.
- Repository secret-pattern scan: no recognized secrets in 762 scanned files.
- Production dependency audit: exit 0 with one high and one moderate advisory explicitly ignored on documented build/dev paths; this is not zero vulnerabilities.
- Exact committed HEAD GitHub CI: all three jobs green, including build, migrate-from-zero, integration, image, non-root and health checks. It does not certify the dirty current candidate.
- Point-in-time hosting recheck: the Vercel URL returned 503; `kiitnest.com` returned a 114-byte HTTP 200 response that did not demonstrate KNEST; `www.kiitnest.com` failed TLS; `kiitnest.in` did not resolve.

The current integration suite is not a green release gate. Existing evidence records three failures: two selector defects and one shared-fixture contamination. Those failures do not prove the corresponding domain behavior is broken, but they must be corrected and rerun on the exact candidate.

## Provisional production V1

Use an **application-first V1** unless the signed commercial scope requires more:

- Approved public content and legal/privacy surfaces.
- Account creation, recovery and role-aware onboarding.
- Discover, start, save, upload, validate, submit and track applications.
- Staff publishing, submitted-application review, decisions and audit.
- Durable notifications and functioning enquiries.
- Basic events only if an operating owner accepts them.

Keep labs off. Defer QR, scanning, PWA, offline behavior and elaborate analytics pending explicit scope and acceptance. This is a product recommendation, not a contractual conclusion.

## Remaining effort and schedule

Core application-first V1 remains a rough-order-of-magnitude engineering envelope of **24 / 44 / 76 person-days** (low / likely / high). The red-team recommends planning from the likely-to-high range rather than presenting the low case as a launch commitment.

| Staffing | Planning range |
|---|---|
| Practical three-person team | **44–76 person-days; 6–10 engineering weeks** |
| One full-time developer | **11–19 weeks** |
| Manual labs included | **55–96 person-days; approximately 8–13 team weeks** |

External approval, AWS/account access, DNS, certificate and SES waiting time is additional and currently unbounded. Therefore the public-launch date is **TBD**, not a responsible fixed date.

Critical path:

1. Approve scope, privacy/content, owners and required access.
2. In parallel, repair Server Action boundaries, data invariants and frontend recovery/accessibility.
3. Complete TLS and least-privilege runtime identity; provision privately and prove real providers.
4. Enforce exact-candidate release controls and prove upgrade, restore, rotation and alert delivery.
5. Run hosted cross-browser/device/accessibility/capacity acceptance on the exact candidate.
6. Obtain explicit owner go/no-go and authorize public cutover separately.

## Release gates

No release until all are evidenced as PASS:

- Approved V1 scope, privacy/terms/content and named operating owners.
- Negative authorization tests for every exported action and minimal DTOs.
- Clean exact candidate with required CI, image and migration checks.
- Protected release branch/environment and exact-SHA/digest promotion.
- Complete origin TLS, private AWS provisioning and real S3/SES/Turnstile/DNS proof.
- Populated upgrade plus database/S3 restore and measured RPO/RTO.
- External synthetic monitoring, delivered alerts, budget controls and named responders.
- Accessible critical journeys, cross-browser/device checks, capacity evidence and final owner acceptance.

The existing reports `00` through `11` remain the detailed evidence pack. This addendum records the current multi-agent reconciliation and corrections.
