# Registrar DNS inventory, October 18, 2026 (IST)

Read through the existing KNEST delegate session in Charanjit Kaur's GoDaddy account. No record, nameserver, registration contact or account setting was changed. Both domains remain registered at GoDaddy. The owner's confirmed design is Route 53 authoritative DNS, `kiitnest.com` canonical and `kiitnest.in` redirect only; registrar transfer is not requested.

## kiitnest.com: 14 records

The twelve records in [the October 9 snapshot](dns-snapshot-kiitnest.com-2026-10-09.md) are unchanged, including the Google Workspace MX, both SPF records, Google DKIM, DMARC and verification TXT. Two existing records were added before this continuation:

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `origin` | `knest--loadb-cffsb5xoobmh-1422523069.ap-south-1.elb.amazonaws.com.` | 1 hour |
| CNAME | `_2fc54a75632784d6d56647aa6079e50e.origin` | `_68b3b3f9b78af8698c85ec6117ae91e0.wzccmgtwzk.acm-validations.aws.` | 1 hour |

These are the HTTPS origin connection and regional ACM certificate-renewal record. Both must survive delegation; omitting `origin` can break CloudFront even when the four public aliases exist. Read fresh origin-stack outputs and ACM validation metadata before provisioning; this inventory is not a substitute for current AWS metadata.

Registrar nameservers remain `ns43.domaincontrol.com.` and `ns44.domaincontrol.com.`. Apex remains Parked (600 seconds) and `www` remains a CNAME to `kiitnest.com.` (1 hour). No public-site ACM or SES DKIM CNAMEs were present in the fourteen-record table.

## kiitnest.in: 7 records

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | Parked | 600 seconds |
| NS | `@` | `ns23.domaincontrol.com.` | 1 hour |
| NS | `@` | `ns24.domaincontrol.com.` | 1 hour |
| CNAME | `www` | `kiitnest.in.` | 1 hour |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com.` | 1 hour |
| SOA | `@` | Primary nameserver `ns23.domaincontrol.com.` | 1 hour |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | 1 hour |

No MX, SPF, Google DKIM or verification TXT is present in this zone. Reproduce `_domainconnect` and DMARC, and replace only parked apex/www with CloudFront aliases at cutover. Route 53 supplies its own NS/SOA.

GoDaddy displays **Domain Status: IDLE**, **pending WHOIS verification**, and **Registrar Hold**, with DNS editing disabled. Its Overview says to contact customer support for the hold. The registered owner must resolve verification/hold using the registered contact channel; routing DNS through Route 53 does not remove a registrar hold. Do not change registration contact information or disable protections as a workaround. No verification email was sent by this agent, and no notice for this domain was found in the KNEST mailbox. A held domain must not be treated as ready merely because its undelegated Route 53 zone can be created.

## Cutover verification

The updated `dns.yaml` requires `OriginDnsName`, `OriginValidationName` and `OriginValidationValue`; it preserves the two origin records and the existing `.in` verification/DMARC records before aliases are enabled. Supply fresh AWS metadata, not assumed historical values.

G7 now uses `scripts/ops/dns-cutover-check.mjs`: an explicit scoped assumed-role profile, exact public hosted zones, all four nameservers per zone, and current origin/ACM/SES metadata. It first requires both registrar nameservers to agree for each domain, then runs all eight Route 53 comparisons (ten comparisons in total). It compares all mail and verification names, requires positive answers for critical records, and checks AWS-derived CNAME targets. Matching empty answers or a matching obsolete origin target cannot pass. Web apex/www A/AAAA and replaced www CNAME differences are the intended cutover changes; they are not ignored when comparing the two registrar sources.

Both `cutover-preflight.sh` and `cutover-apply.sh` invoke the shared scoped-identity guard before their first AWS command. Offline subprocess tests use a harmless AWS stub to prove the documented root profile makes no AWS invocation from either entry point. The Node guard separately proves other root/direct-user/wrong-account identities stop after the identity read. The scripts use relative Node entry paths from their own directory so Git Bash's disabled AWS path conversion does not break Windows Node paths.

Local metadata fixtures and template/DNS tests are engineering evidence only. No live scoped-AWS collection, Route 53 provisioning, delegation, certificate issuance, email sending or hosted acceptance occurred in this inventory.
