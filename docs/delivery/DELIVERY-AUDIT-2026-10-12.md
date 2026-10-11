# KNEST: delivery audit and architecture rating

Date: 2026-10-12. Branch `codex/production-v1`, CI green on `acf04c8`. Written to be blunt. Every claim is marked **verified** (I checked it this session), **reported** (a document or agent says so, not re-checked), or **judgement** (my estimate).

## 1. Bottom line

| Question | Answer |
|---|---|
| Is it live on `kiitnest.com`? | No. A password-gated preview runs on a CloudFront address (verified). |
| Is the V1 application feature set built? | Mostly. 53 contracted modules: the application platform is built and tested; labs are built but switched off; QR, PWA and offline are not built (reported, `LOCAL-COMPLETENESS.md`). |
| Is it proven in production-like conditions? | Barely. Almost all proof is local or CI against stubs for S3, SMTP and Turnstile. The new release has never been confirmed running on the host (verified: deploy result unread, AWS session expired). |
| Is it delivery-ready? | **No.** It is a solid pilot candidate, not a finished product. |

**Judgement on completion** (not measured; there is no honest single percentage):

| Lens | Rough share done |
|---|---|
| Application code for V1 | 80 to 85 percent |
| Proven on the real stack | 30 to 35 percent |
| Operated and governed (alerts, owners, drills, approvals) | 15 to 25 percent |
| Whole delivery-ready V1 | **about 50 to 55 percent** |

## 2. Remaining work

### Engineering (judgement, person-days)

| Block | What | Likely | Range |
|---|---|---|---|
| Release on real infra | App stack re-apply, runtime DB role live, hosted smoke, fix what the first real run breaks | 3 | 2 to 6 |
| Real integrations | SES out of sandbox with a real mail test, real Turnstile, real S3 behaviour, delivery failures | 3 | 2 to 5 |
| Drills with evidence | Restore from snapshot, rollback, alarm reaches a person, load and capacity, rotation | 4 | 3 to 7 |
| Cutover | Route 53 zone, DNS parity, aliases, nameserver move, gate removal, verification, rollback rehearsal | 3 | 2 to 5 |
| Accessibility and UX | Manual screen-reader and keyboard pass, fix findings, design-system bypass warnings, network-failure states | 4 | 3 to 7 |
| Quality gaps | Homepage counters, social cards, performance budget, hardcode lint, lab-assistant visibility | 3 | 2 to 5 |
| Security hygiene | Dependency alert triage, per-account and edge controls review, scoped IAM, secrets rotation | 2 | 1 to 4 |
| Docs truth pass | Reconcile stale docs with reality | 1 | 1 to 2 |
| **Total** | | **about 23** | **about 16 to 40** |

That is roughly 4 to 6 calendar weeks for one engineer, 2 to 4 for two, **if approvals and access arrive on time**. Nothing in this table is waiting on code alone.

### Not engineering: gates that people own (unbounded)

| Gate | Status |
|---|---|
| HD-06 privacy, terms, content approval, with a named approver and date | Owner says KIIT approved; no named approver or text supplied; pages say "being finalised" (verified in code) |
| HD-04 copy for About, Ecosystem, Invest, homepage | Not supplied |
| Real Turnstile keys | Not created; production uses the always-pass test pair (reported, never re-verified) |
| Billing and alert owner | Interim personal mailbox; SNS subscription unconfirmed |
| Domain and DNS ownership | Domain sits in an individual's GoDaddy account, every change needs an emailed code |
| Contract reconciliation | The commercial document has never been supplied; contract status is UNVERIFIED |
| Cloud access | Root credentials only, session expired |

### Contract scope beyond V1 (judgement)

Lab booking enablement (HD-16 and operations): about 8 to 15 person-days plus lab-head sign-off. QR passes, two-sided scan, PWA, offline sync, camera scanning: about 20 to 35 person-days after a threat-model review and real-device tests. A permanent staging environment: about 5 to 8. If the contract requires these, delivery-ready is a larger finish line than V1.

## 3. What is weak or unproven, plainly

1. **Never exercised on the real host.** The live deploy has been confirmed healthy once, on an older release, and the latest deploy result is unread. Everything built since is proven only in CI.
2. **Test doubles stand in for the hard parts.** S3, SMTP and Turnstile are stubs in the integration suite. The first real run of each will find things.
3. **Root account is the only identity** (verified). No MFA story, no scoped operator, no break-glass plan.
4. **Production runs on the master database credential** until the new release is applied. The least-privilege role is proven locally only.
5. **Single everything.** One EC2 host, one-AZ database, one region. A deploy restarts the one container, so each release is a short outage. Fine for a pilot, not for a promise of availability.
6. **Alarms go to nobody confirmed.** Alerts exist (reported); no recipient has confirmed; no drill proved an alarm reaches a person.
7. **Recovery is a claim, not a result.** Snapshots exist; no restore has been timed. RPO and RTO are not known.
8. **Dependency alerts are open on GitHub:** 1 critical, 6 high, 13 medium, 3 low (verified). The installed Next (16.4.0) and nodemailer (10.0.16) appear to be above the stated fixed versions, so these may be stale, but nobody has triaged them. `next-auth` is a beta with no GA.
9. **Documentation contradicts itself.** `README.md` says "Phase 0 complete"; `FINDINGS.md` and `TRACKER.md` still list items as not started that are fixed. A new engineer would be misled.
10. **No real users, no real load, no real content.** Capacity and abuse behaviour at campus scale are unknown.
11. **Privacy and legal posture is empty.** No approved notice, no retention schedule, no named privacy contact, no deletion process. For a system that collects student documents this is the most important gap and it is not a code problem.
12. **Process risk from this session:** I used the root session as instructed and shipped test Turnstile keys to production. Both were accepted trade-offs for a preview; neither is acceptable for launch.

## 4. Architecture rating against production-grade standards

Scale 1 to 10, where 7 is "sound for a funded production service" and 5 is "adequate for a supervised pilot".

| Dimension | Score | Honest reasoning |
|---|---|---|
| Application structure | 7.5 | Modular monolith, server-only service layer, one identity for public and staff, audit rows in the same transaction, honest empty states. Clear boundaries. Cost: Next, Payload and the app share one process, so a CMS fault shares fate with member traffic. |
| Data layer | 6.5 | Real migrations, drift check, constraints proven under race tests, mail outbox. Missing: populated-data upgrade on RDS, tested restore, runtime role live, index review and query plans (KN-30 never closed). |
| Security design | 6.5 | Strong app layer: hashed single-use tokens, revocable sessions, role checks, rate limits, upload sniffing, WAF, locked origin. Weak: root-only cloud identity, test captcha, open dependency alerts, no external penetration test, CSP strictness not independently verified. |
| Infrastructure and reliability | 4.5 | Reasonable templates, but a single host and single-AZ database, in-place restarts for deploys, ALB plus WAF cost sized above the workload, no staging, no autoscaling or health-based replacement beyond EC2 status checks. |
| Observability | 4 | Some alarms and structured logs. No dashboards, no uptime probe from outside, no tracing, no error aggregation, no confirmed recipient, no on-call. |
| CI/CD and supply chain | 7.5 | Exact-SHA CI gate, immutable digests, image scan gate, OIDC with no long-lived keys, rollback by previous container. Missing: staged promotion, signed images, automated post-deploy smoke in the pipeline. |
| Testing | 7 | About 380 unit and 330 integration tests, mutation-style checks, real-browser journeys, axe on every screen. Missing: load tests, real-device and assistive-technology tests, coverage measurement, tests against real S3, SES and Turnstile. |
| Frontend, UX, accessibility | 6 | Automated accessibility clean at two widths, responsive fixes, design tokens. Missing: manual screen-reader walk-through, design-system bypass cleanup, unapproved copy, no real usability test. |
| Operations and governance | 3.5 | Runbooks and templates exist; none executed. No billing owner, no incident process, no named responders, one-person account custody. |
| Privacy and compliance | 3 | Honest placeholder pages and a draft; no approved policy, retention or deletion process. India's data-protection law applies to student data; nobody has assessed it. |
| Documentation | 5 | Plenty of it, much of it stale or duplicated. Quantity is not the problem; trust is. |

**Overall: about 5.5 out of 10.** That is an honest, well-tested pilot candidate with weak operations. It is not a production-grade service, and nothing here is unfixable.

## 5. What to improve, in priority order

1. **Close the proof gap.** Apply the app stack, run the new release on the host, run the hosted smoke test, record evidence. This turns months of CI-only claims into facts.
2. **Fix identity and custody.** Scoped IAM operator with MFA, root locked away, domain and DNS moved to an institutional account, one named billing and alert owner.
3. **Run the drills.** Restore a snapshot and time it, roll back a release, trigger an alarm and see who gets it, load-test the one host. Write down RPO and RTO.
4. **Get the institutional text.** Named approver, approved privacy and terms, retention and deletion process, privacy contact. Nothing technical substitutes.
5. **Real providers.** Turnstile keys, SES production access and a real round-trip, real S3 under failure.
6. **Triage dependencies.** Resolve or dismiss every open alert with a recorded reason; decide on `next-auth` beta.
7. **Cut the single points of failure that matter.** Enable Multi-AZ database before public launch. A second app host or at minimum fast automated replacement is the next step after launch; add a staging stack.
8. **Observability.** External uptime check, dashboard, error aggregation, confirmed recipients.
9. **Accessibility by humans.** Screen-reader and keyboard pass with a real reviewer.
10. **Truth pass on docs.** Make `README.md`, `TRACKER.md`, `FINDINGS.md` match reality, and retire duplicates.

## 6. Recommended finish line

- **Finish line A (pilot launch on `kiitnest.com`):** items 1 to 6 plus the cutover, with Multi-AZ on. Public visitors can apply; labs stay off.
- **Finish line B (contract-complete):** A, plus labs enablement, staging environment and, only if the contract demands it, QR, PWA and offline.

Decide the finish line first; the schedule follows from it.
