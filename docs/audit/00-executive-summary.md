# KNEST production V1 audit — executive summary
Audit date: 9 October 2026 (IST). Baseline: branch `delivery/p1-containment`, commit `27d3dcd242687aa4099e71b1f381d468054ee3d9`, plus the ten pre-existing modified/untracked paths listed in [10](10-evidence-and-verification-log.md). This audit applies to current disk; GitHub CI evidence applies to the committed revision only.

## Verdict
**NO-GO for a public release or real student data.** KNEST is KIIT's innovation/entrepreneurship front door and operating platform, with public discovery, accounts/onboarding, applications, events, staff review and CMS publishing. It is a substantial implemented application, not merely a scaffold. It is not a verified hosted product. The observed Vercel endpoint returns maintenance HTTP 503; the primary domain does not demonstrate KNEST content; AWS templates do not establish deployed services.

The most material findings are reproduced Server Action private-data exposure (F01), incomplete production origin TLS (F03), institutional privacy/content/scope holds (F04/F18), runtime database identity and credential rotation (F06), recovery/release gates (F07/F08), core workflow recovery and accessibility (F09/F17), and absence of tested operations (F10). Lab-specific correctness findings F15/F16 block enabling labs, not an applications-only release with the flag enforced off. The initial F02 auth-action bypass hypothesis was withdrawn after worker-level inspection and runtime counterevidence; it remains P2 latent hardening.

No percentage of completion is defensible: authoritative commercial scope remains unavailable and route/module counts do not measure accepted journeys.

## Health scorecard
| Area | Assessment | Evidence | Confidence |
|---|---|---|---|
| Product | Coherent core; V1 boundary provisional | Original journeys, current routes, Pilot-A/Pilot-B split | High |
| UX | Happy paths substantial; recovery/accessibility incomplete | F09/F17; source and named tests | High source, limited visual verification |
| Architecture | Suitable modular monolith; boundary discipline needs repair | One Next/Payload process, app/cms schemas; F01 | High |
| Code quality | Strict types and relevant checks; uneven invariants | Typecheck passes; lint 0 errors/31 warnings; F11/F15 | High |
| Data | Strong local concurrency controls; lifecycle/recovery gaps | Unique/row/advisory/exclusion locks; F07/F11/F12 | High static, persistent state unknown |
| Security | Release blocked | Anonymous synthetic private reads and reviewer hash-field/draft disclosure reproduced | High local runtime; production exposure not assessed |
| Testing | Substantive; current release gate fails | 349 unit tests; original current-disk integration: 308 passed, 3 failed, 1 expected failure; committed CI green | High within stated scope |
| CI/CD | CI verified; release gate incomplete | Exact HEAD CI green; manual release independent of CI | High |
| Deployment | Product hosting unverified/incomplete | Maintenance response; no complete origin TLS path | High |
| Operability | Templates/runbook exist; drills/owners absent | F06–F10 | High source; live state unknown |
| Documentation | Extensive, conflicting and stale in places | README Phase 0/no IaC vs existing source/templates | High |

## Release recommendation and estimates
Define **application-first V1**: approved truthful public content; password accounts and recovery; role-aware onboarding; discover/start/save/upload/verify/submit; member tracking; staff publishing/review/audit; notifications; functioning enquiries; basic events only if a named operator accepts them. Keep labs off. Obtain an explicit contractual variation before treating QR/PWA/offline as excluded from contracted delivery.

Recommended architecture remains one application, managed PostgreSQL and S3. Respect the latest recorded AWS-only, one-production-environment decision; use disposable S-1 and private-first synthetic verification rather than adding permanent staging. Prefer a complete ALB+ACM origin TLS design if host TLS renewal ownership cannot be proved.

Deduplicated application V1 engineering: **24 / 44 / 76 person-days (low / likely / high)**. One developer: **6 / 11 / 19 working weeks** including calendar contingency; practical three-person team: **4 / 6 / 10 weeks**, constrained by sequencing. Owner, identity, domain and SES approval delays are additional and unbounded. Lab booking with manual attendance adds **6 / 11 / 20 person-days**. QR/offline/PWA are not included and cannot be responsibly scheduled before scope/device/threat-model decisions.

Mumbai planning allowance at pilot usage: **USD 50–70/month with proved host TLS; USD 75–110 with ALB TLS**. Higher-memory/Multi-AZ planning envelope: **USD 100–160/month**. These are estimates before tax, domain renewals, support, labour, credits and account-specific allowances; see [09](09-estimates-roadmap-and-critical-path.md). The older USD 45–51 headline excludes required origin TLS and other small omissions.

## Decision package
- [01 Inventory and architecture](01-project-inventory-and-architecture.md)
- [02 Scope and requirements matrix](02-scope-and-requirements-matrix.md)
- [03 Product and UX](03-product-and-ux-audit.md)
- [04 Engineering and data](04-engineering-and-data-audit.md)
- [05 Testing and security](05-testing-and-security-audit.md)
- [06 Deployment and operations](06-deployment-and-operations-audit.md)
- [07 V1 definition and release gates](07-v1-production-definition.md)
- [08 Prioritized backlog](08-prioritized-backlog.md)
- [09 Estimates, roadmap and critical path](09-estimates-roadmap-and-critical-path.md)
- [10 Evidence and verification log](10-evidence-and-verification-log.md)
- [11 Independent challenge](11-red-team-review.md)

Application code, infrastructure configuration and persistent services were not changed. Audit-only test instrumentation, generated artifacts and synthetic fixtures were confined to a disposable copy. Implementation requires a separate explicit authorization.

