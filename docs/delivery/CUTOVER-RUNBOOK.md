# Public cutover runbook (prepared, NOT executed)

Date: 2026-10-11. Status: ready to run once the hard gates below are met. Nothing in this file has changed public DNS or removed the preview gate.

## Hard gates (the scripts refuse to run without them)

| Gate | Needed from | Checked by |
|---|---|---|
| G1 HD-06 approval evidence at `docs/delivery/EVIDENCE/hd-06-approval.md` with `APPROVED-BY:` and `APPROVED-ON:` lines written by the institution | KIIT approver | `scripts/ops/cutover-preflight.sh` |
| G2 Real Turnstile site and secret keys | Operator (Cloudflare dashboard) | preflight |
| G3 ACM certificate ISSUED for the four hostnames | DNS validation records | preflight |
| G4 SES identity verified | DKIM records | preflight |
| G5 Runtime DB role in use | release with `runtime-role.ts` deployed | preflight + deploy log |
| G6 Alert recipient confirmed | owner clicks SNS confirmation mail | preflight |
| G7 Route 53 mirrors GoDaddy mail records | `dns.yaml` deployed, `dns-compare.mjs` | preflight |

## Why Route 53 and not GoDaddy records

GoDaddy cannot point an apex name (`kiitnest.com`) at CloudFront (no apex CNAME or alias). The agreed design (`DNS-MIGRATION.md`) delegates both zones to Route 53 with every mail and verification record reproduced first. This cannot be skipped by adding records at GoDaddy alone.

## Records to add at GoDaddy now (additive, owner approves with the emailed one-time code)

ACM certificate validation, `kiitnest.com` zone (type CNAME, TTL 1 hour). At GoDaddy enter only the part before `.kiitnest.com`:

| Host | Points to |
|---|---|
| `_9d00150114ab3f176eeab79ac14b4e2b` | `_921e73907963d85f8fe047b2b04658f4.wzccmgtwzk.acm-validations.aws.` |
| `_d721c4f0fc713e7f3b5278f02db39781.www` | `_7eb402675b1b2d4c2514bd1952458ea9.wzccmgtwzk.acm-validations.aws.` |

For `kiitnest.in` (only if its DNS is also at GoDaddy; its records were never inventoried):

| Host | Points to |
|---|---|
| `_285581ad8bb8ed9bf32fd6d059c04ddc` | `_dd53760225e247d423cc2d0a2da4449b.wzccmgtwzk.acm-validations.aws.` |
| `_ce6cbac051ec2ffc056c68a84694e5be.www` | `_332b7f428ce3baa36b26055dec35664d.wzccmgtwzk.acm-validations.aws.` |

SES Easy DKIM, `kiitnest.com` (CNAME, TTL 1 hour):

| Host | Points to |
|---|---|
| `75ohff4pzwitcmydihb7jklo7qyfukfc._domainkey` | `75ohff4pzwitcmydihb7jklo7qyfukfc.dkim.amazonses.com` |
| `5mexvr7dqa5u54x3agljcb5ybnozwzqq._domainkey` | `5mexvr7dqa5u54x3agljcb5ybnozwzqq.dkim.amazonses.com` |
| `otzkgqkxkv3e5f3y5qy5kuddmwn2hvdl._domainkey` | `otzkgqkxkv3e5f3y5qy5kuddmwn2hvdl.dkim.amazonses.com` |

Do not edit or delete any existing record (MX, SPF and DMARC TXT, Google DKIM, `_domainconnect`). All of the above are new names.

## Order

1. Add the records above at GoDaddy. Wait for `aws acm describe-certificate` status `ISSUED` and SES `VerifiedForSendingStatus` true.
2. Deploy `infra/cfn/dns.yaml` as `knest-production-dns` (us-east-1 or any region; Route 53 is global) with `CloudFrontDomainName` empty and the ACM and SES values from this file. Run `dns-compare.mjs` against all four Route 53 nameservers (`DNS-MIGRATION.md` step 3).
3. `bash scripts/ops/cutover-apply.sh aliases`. Attaches certificate and aliases; the site is still gated and DNS unchanged.
4. Institution evidence (G1) and real Turnstile keys (G2) arrive. `bash scripts/ops/cutover-preflight.sh` must print `PREFLIGHT PASSED`.
5. Lower the apex and `www` TTL to 300 s at GoDaddy a day earlier.
6. `bash scripts/ops/cutover-apply.sh public`: SiteUrl and indexing, redeploy, Route 53 web records (inert), then the manual nameserver change at GoDaddy, mail test, gate removal.
7. Verify: `node scripts/verify-production.mjs --url https://kiitnest.com --alt www.kiitnest.com,kiitnest.in,www.kiitnest.in --waf`, keep the output under `EVIDENCE/`.

## Rollback

| Step | Undo |
|---|---|
| Aliases attached | Redeploy edge with `Aliases` and `AcmCertificateArn` set back to their previous values (empty). No visitor effect. |
| SiteUrl or indexing | Set back to the preview address and `off`, redeploy via `knest-production-deploy`. |
| Route 53 web records | Redeploy `dns.yaml` with `CloudFrontDomainName` empty (inert until nameservers move). |
| Nameservers at GoDaddy | Restore `ns43.domaincontrol.com` and `ns44.domaincontrol.com`; the GoDaddy zone was never edited and still holds the old records. Resolvers recover within the 1 hour NS TTL. |
| Gate removal | Redeploy edge with `AccessHash` set to the SHA-256 kept by the operator (the password file; the hash is `echo -n "knest:<password>" | sha256sum`). |

Record before starting: current edge parameters (`describe-stacks`), the GoDaddy nameservers and the `dns-compare` output.
