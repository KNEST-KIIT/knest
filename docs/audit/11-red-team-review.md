# Independent challenge and reconciled disposition

Reviewer: native subagent /root/red_team, independent of product/frontend, architecture/data, security/SRE and QA reviewers. It challenged source claims, then reviewed root's fresh-build/browser/test evidence and estimates. Root executed runtime tests. The reviewer performed an additional installed-Next-source check when evidence contradicted F02.

## Highest-risk findings challenged

| Finding | Challenge / counterevidence | Final disposition |
|---|---|---|
| F01 identity-trusting readers | Source alone and stale manifests cannot prove reachability; matching page workers matter | Fresh matching-page POSTs anonymously returned synthetic private notification/application-note data. P0, locally reproduced; no production breach claim |
| F02 alleged auth bypass | Auth exports have API-route workers only; global manifest presence is insufficient | **P0 withdrawn.** Page probe returned JSON {} and no session. P2 latent regression risk, B22, outside core totals |
| F01 reviewer hash/draft | Applications-staff guard exists; never call this anonymous hash dumping | Reviewer synthetic action serialized passwordHash and draft. Minimize DTO and enforce submitted-only visibility in B02 |
| F03 origin TLS | HTTPS-only configured but container has no TLS endpoint; no deployed plaintext observation | P0 deployment gate; complete host TLS or ALB/regional ACM, networking, health and cost design |
| F06/F07 credentials/recovery | Runtime master-secret use is confirmed. Deploy already creates and waits for pre-migration snapshot at app.yaml:548–552 | Reject old no-snapshot claim. Least privilege/rotation and measured restore still required; image fallback does not roll schema/data back |

## F02 correction: independent framework evidence

Installed Next manifests-singleton.js:269–315 resolves the action module map using the current request worker. Lines 328–341 forward when that worker lacks the action. action-handler.js:494–503 forwards before execution; lines 134–235 return JSON {} when the forwarded result is not RSC.

Fresh auth entries contain only app/api/auth/password/*/route workers. The initial /login probes forwarded to API workers rather than proving action execution. Missing internal CAPTCHA checks therefore did not establish the alleged second auth transport. The reviewer explicitly required withdrawal of the P0 claim. Ordinary server-only functions and a manifest regression guard are optional B22 hardening.

F01 is different: its sampled readers have page workers. Direct matching-page probes returned RSC containing the synthetic markers/hash field. This correction strengthens evidence discipline; it does not weaken the separately reproduced access-control issue.

## Highest-impact V1 gaps challenged

| Gap | Challenge | Required disposition |
|---|---|---|
| F18 authoritative scope | Generated 53-module commercial document is not proof of a received signed agreement; original booking deferral conflicts with later expansion | Approve versioned V1/variation; do not silently erase QR/PWA obligations |
| F21 release-candidate proof | Existing E2E tests are substantive; green committed CI does not cover dirty source/untracked journeys | Current suite remains failed despite selector/fixture explanations; rerun exact candidate after repair |
| F13 notifications | Application in-app notices often commit atomically; not every notice is lost | Minimal DB delivery retry/outbox and real SES proof; avoid a distributed platform |
| F04/F17 institutional/usability acceptance | Engineering completion differs from privacy approval, support ownership and manual accessibility | Named approvers and actual acceptance; separate approval waiting from engineering days |
| F15/F16 labs | Default-off makes flaws conditional; proposal acceptance checks future time and DB overlap | Repair specific assistant/quota/head/expiry/occupancy issues only before enabling labs |

## Missing dependencies and false-completion claims

- Full DNS/mail record export and control are required. Certificate validation can use the current DNS provider; Route53 nameserver cutover is not inherently prerequisite.
- Respect one production environment and no permanent staging. Private synthetic validation and disposable S-1 supply the verification path.
- Restore requires a replacement endpoint/credentials, application reconnect and consistency checks. Snapshot existence cannot pass recovery.
- OIDC/digest syntax cannot prove external Environment reviewers, image scan disposition or exact-SHA promotion enforcement.
- LOCAL-COMPLETENESS labels are expressly local. Budget already admits TLS addition. Preserve those qualifications.
- Template shape tests do not establish CloudFormation acceptance, IAM sufficiency, origin connectivity or delivered alarms.
- HTTP 200 does not establish a functioning product or successful action invocation. The F02 counterexample demonstrates this directly.

## Test and visual evidence challenge

Original current-disk integration: 308 passed, 3 failed, 1 expected failure. Failure explanations are duplicate/hidden text selectors and a shared analytics baseline, not confirmed broken domain behavior. The suite still fails the release gate.

Final focused audit suite: 4 passed, comprising three security reproductions plus one auth-bypass counterexample. Passing exploit-demonstration tests mean defects were reproduced, not fixed.

At 375×900, root measured menu height 0 (top/bottom 72, header height 73); resize to 1280 leaves body overflow hidden. These bounded local observations confirm F17. They do not establish full device or accessibility compliance.

## Estimate and cost challenge

Application effort 24/44/76 person-days and manual labs addition 6/11/20 reconcile to backlog tasks. Operations 8/15/26 is included. The 24-day low case leaves 16 days for everything outside operations and is optimistic.

One developer 6/11/19 weeks includes contingency/rounding. Three people 4/6/10 weeks acknowledges serial integration, provider, recovery and acceptance tasks. Skills, allocation, holidays and approval waits can extend elapsed time. No unconditional release date is justified.

USD 50–70/month host TLS or 75–110 ALB are planning ranges, requiring regional calculator/sizing proof. Include IPv4, secrets, snapshots, logs and plan compatibility. Do not assume credits or purchase commitments before measuring capacity.

## Overengineering rejected and remaining uncertainty

No evidence warrants microservices, Kubernetes, Redis, a full UI rewrite or multi-region failover. A single application, managed PostgreSQL and S3 fit the provisional pilot. Scoped admin throttles are P1 decisions rather than indiscriminate P0 findings.

Unresolved matters: received commercial scope/variation, selected TLS topology, accepted RPO/RTO/support hours, lab reservation/privacy policy, persistent historical data and actual cloud ownership. These remain explicit gates or investigations.

**Final verdict: NO-GO for public real-user production.** Repair confirmed boundaries and core defects, prove hosted services/recovery, obtain institutional acceptance, then seek a separately authorized release.