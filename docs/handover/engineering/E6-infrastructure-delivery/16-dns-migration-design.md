# E6.16 DNS migration design: GoDaddy to Route 53

Sources: `docs/delivery/DNS-MIGRATION.md`, `CUTOVER-RUNBOOK.md`, `infra/cfn/dns.yaml`, `cert.yaml`, `scripts/dns-compare.mjs`, `scripts/ops/cutover-*.sh`. Status: designed and scripted; **nothing has been executed** against public DNS (`CUTOVER-RUNBOOK.md:3`, `DNS-MIGRATION.md:43-45`). The only live DNS facts: an ACM validation record and an `origin` CNAME for the preview were added at GoDaddy, "mail records untouched" (`V1-DEPLOYMENT-REPORT.md:19`); the comparison tool was run once against GoDaddy's two nameservers (identical, 2026-10-09; `DNS-MIGRATION.md:45`).

## 1. Why delegate to Route 53 at all

GoDaddy cannot point an apex name at CloudFront: no apex CNAME or alias (`CUTOVER-RUNBOOK.md:17-19`, decision 8 of `V1-DEPLOYMENT-REPORT.md:102`). `www` could be a CNAME, but the canonical host is the apex `kiitnest.com`, and `kiitnest.in` must also redirect from its apex. Route 53 alias A/AAAA records at the apex to the distribution solve it. The registrar stays at GoDaddy; only the nameservers change (`AWS-NATIVE-ARCHITECTURE.md:9`). A registrar transfer is explicitly not part of the plan (`DNS-MIGRATION.md:41`).

## 2. Constraints that shaped the design

- Live Google Workspace mail on `kiitnest.com` must not be interrupted (`DNS-MIGRATION.md:3`).
- No staging sub-domain (owner decision 2026-10-09).
- Changes at GoDaddy require a one-time code emailed to the account owner for each change (`V1-DEPLOYMENT-REPORT.md:43`), and the domain sits in an individual's account (`DELIVERY-AUDIT-2026-10-12.md:49`). Every GoDaddy-side step is human and slow, so the plan minimises their number and makes them additive.
- ACM DNS validation needs CNAMEs in the authoritative zone (GoDaddy before the move, Route 53 after).

## 3. Phases

| Phase | Action | Visible to the world? | Evidence of design |
|---|---|---|---|
| A. Prepare | Deploy `dns.yaml` with `CloudFrontDomainName` empty: two zones and the existing mail, SPF, DKIM, DMARC, verification records only. Run `dns-compare` against all four Route 53 nameservers. | No: a zone nobody delegates to is inert | `DNS-MIGRATION.md:7-13` |
| B. Certificate and mail identity | Deploy `cert.yaml`; add its four validation CNAMEs at GoDaddy (additive, values approved by owner); also put them in `dns.yaml` parameters so renewal continues. Deploy `ses.yaml`; add three DKIM CNAMEs at GoDaddy and in `SesDkimToken1..3`. SPF is not edited. | No: only new names | `:15-18`, `CUTOVER-RUNBOOK.md:21-45` |
| C. Release gate | Application passes private verification with `verify-production.mjs`, synthetic accounts, privacy notice approved, owner approves the manifest | No | `:20-22` |
| D. Cutover | Lower TTL of apex and `www` to 300 s a day earlier; re-run compare; set `CloudFrontDomainName` (web aliases appear in Route 53, still invisible); change nameservers at GoDaddy for `.com` then `.in`; watch resolvers; test mail both ways; run verification; remove the gate when the manifest says so | Yes | `:24-31`, `cutover-apply.sh:46-65` |

The two scripts split the risky parts: `cutover-apply.sh aliases` attaches the certificate and aliases to the distribution while DNS is unchanged and the gate is on; `public` performs steps up to the manual nameserver change and then, only on a typed `YES`, removes the gate (file 11).

## 4. The equivalence proof

`dns-compare.mjs` queries each nameserver directly, so an undelegated Route 53 zone can be compared with GoDaddy (`dns-compare.mjs:1-10`). For six names (apex, `www`, `_dmarc`, `google._domainkey`, `dc-bdaca08905._spfm`, `_domainconnect`) and types A, AAAA, CNAME, MX, TXT, NS it normalises and diffs. Expected differences are the parked web records that the cutover deliberately replaces: `kiitnest.com|A`, `www.kiitnest.com|A`, `www.kiitnest.com|CNAME`, and `NS` (`DNS-MIGRATION.md:12`). MX, every TXT (including the 408-character DKIM key split into two strings), and `_domainconnect` must match.

Two things make the proof weaker than it reads:

1. **Coverage is a name list, not a zone transfer.** DNS offers no portable enumeration for a hosted zone at a registrar's nameservers; the inventory is a human snapshot (`EVIDENCE/dns-snapshot-kiitnest.com-2026-10-09.md`) re-read "immediately before starting" (`DNS-MIGRATION.md:9`). A record at an unlisted name is not compared and not reproduced.
2. **`kiitnest.in` is not inventoried.** `DNS-MIGRATION.md:45`; `CUTOVER-RUNBOOK.md:30`. G7 of the preflight compares only `kiitnest.com` and only against the first Route 53 nameserver (file 11).

## 5. Design gaps found in review

| # | Gap | Effect | Where |
|---|---|---|---|
| D-08 | No record for `origin.kiitnest.com` (CNAME to the ALB) and no ACM validation record for the origin certificate in `dns.yaml`. They exist only at GoDaddy. | After nameservers move, `origin.kiitnest.com` no longer resolves; CloudFront cannot reach the origin; site down. Also the origin certificate stops renewing. | `V1-DEPLOYMENT-REPORT.md:19` (records added at GoDaddy); `dns.yaml` has no such resource (checked) |
| | The ACM records for the origin certificate are regional-certificate records; `dns.yaml` parameters `AcmCom*`/`AcmIn*` are labelled for the CloudFront certificate (two per domain). | An operator filling them with the origin record will have nowhere to put it (4 slots, all for the four CloudFront names). | `dns.yaml:19-26` |
| | `.in` zone inventory missing | possible loss of unknown records | above |
| | GoDaddy-hosted DMARC `rua=...@onsecureserver.net` is carried over | aggregate reports go to GoDaddy's mailbox, not KNEST; not a break, but unowned monitoring | `dns.yaml:112` |
| | DNSSEC deliberately off until stable (`AWS-NATIVE-ARCHITECTURE.md:45`) | none now | |
| | Four nameservers per zone; only one is compared by the preflight | a partial Route 53 failure would be missed | `cutover-preflight.sh:72-74` vs `DNS-MIGRATION.md:13` |
| | `cutover-apply.sh public` changes `SiteUrl`/`SiteIndexing` before the container is redeployed (file 11) | window where writes from `https://kiitnest.com` are refused | `cutover-apply.sh:48-52` |

## 6. Rollback (design)

| Problem | Action | Time | Source |
|---|---|---|---|
| Site wrong after nameserver change, mail fine | restore GoDaddy nameservers `ns43.domaincontrol.com`, `ns44.domaincontrol.com`; GoDaddy zone untouched | NS TTL, 1 hour at GoDaddy | `DNS-MIGRATION.md:37`, `CUTOVER-RUNBOOK.md:64` |
| Mail affected | restore GoDaddy nameservers immediately, then compare | same | `DNS-MIGRATION.md:38` |
| Alias or certificate problem | previous TTL records; old GoDaddy parked page is the previous state | about 5 minutes | `:39` |
| Gate removal regretted | edge stack with `AccessHash` = SHA-256 of `user:password` | stack update | `CUTOVER-RUNBOOK.md:65` |

The GoDaddy zone is kept for at least a week after cutover (`DNS-MIGRATION.md:41`). Rolling back after a week requires the GoDaddy zone to still exist, which depends on an individual's account.

Constraint that is easy to miss: after the nameserver change, **GoDaddy's copy of the zone becomes stale**. Any record changed in Route 53 after cutover is not reflected at GoDaddy, so a rollback within the week restores the pre-cutover state, not the current one. New records added at Route 53 (for example DKIM tokens, ACM renewals) would need to be mirrored to GoDaddy before a rollback.

## 7. Operational consequences after cutover

- ACM renewal for the four hostnames keeps working only if the `AcmCom*`/`AcmIn*` CNAMEs are in Route 53 (`dns.yaml:192-207`).
- SES DKIM CNAMEs must be in Route 53 (`SesDkim1..3`), otherwise mail stops authenticating when GoDaddy is retired.
- Zones are `Retain`; a stack delete will not delete them (`dns.yaml:43-58`). Deleting and recreating a zone changes its nameservers.
- Route 53 cost: two zones, USD 1.00 per month (`AWS-PRODUCTION-BUDGET.md:21`).
