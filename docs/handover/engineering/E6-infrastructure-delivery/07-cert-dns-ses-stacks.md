# E6.07 `cert.yaml`, `dns.yaml`, `ses.yaml`

Sources: `infra/cfn/cert.yaml` (30 lines), `infra/cfn/dns.yaml` (247), `infra/cfn/ses.yaml` (46). None of these three templates changes anything a visitor or mail server can see on its own; each becomes live only when a person adds DNS records or moves nameservers.

## 1. `cert.yaml`: public certificate for CloudFront

- Single parameter `Environment`. One resource `Certificate` (`cert.yaml:18-25`): domain `kiitnest.com`, SANs `www.kiitnest.com`, `kiitnest.in`, `www.kiitnest.in`, DNS validation, tag `project`. Deployed in us-east-1 because CloudFront accepts certificates only from there (`:2-3`).
- The host names are literals, not parameters; a domain change is a template change.
- The stack stays `CREATE_IN_PROGRESS` until all validation CNAMEs exist at the authoritative DNS (GoDaddy before cutover; Route 53 after). The four CNAME name/value pairs, two per domain, are listed in `docs/delivery/CUTOVER-RUNBOOK.md:21-37` and must be added by the account owner with an emailed one-time code (`V1-DEPLOYMENT-REPORT.md:43`).
- Output `CertificateArn` is passed to `edge.yaml` as `AcmCertificateArn`.
- Renewal: ACM renews DNS-validated certificates automatically while the same CNAMEs exist. After the nameserver move they must be in the Route 53 zones, which is why `dns.yaml` takes `AcmCom*`/`AcmIn*` parameters (`dns.yaml:19-26`). If someone deploys `dns.yaml` without them the zone holds no validation records and the certificate silently fails renewal about 60 days later. The preflight gate G3 checks only that the certificate is ISSUED at that moment (`cutover-preflight.sh:41-50`).
- Hosted state: requested, `PENDING_VALIDATION`, as of 2026-10-11 (`V1-DEPLOYMENT-REPORT.md:115`). Not known to have been issued.

## 2. `ses.yaml`: sending identity

| Item | Detail |
|---|---|
| Parameter | `EmailDomain`, default `kiitnest.com`, lowercase domain pattern |
| Resource | `AWS::SES::EmailIdentity` with `DeletionPolicy`/`UpdateReplacePolicy: Retain` (`ses.yaml:19-31`) |
| DKIM | Easy DKIM, `RSA_2048_BIT`, signing enabled |
| Feedback | `EmailForwardingEnabled: true` |
| Outputs | `DkimName1..3`, `DkimValue1..3` (the three CNAMEs) |
| Region | ap-south-1, where the application sends from |

Design decisions:

- SPF and MX are untouched. DMARC passes when either SPF or DKIM aligns; SES signs with the `kiitnest.com` domain, so DKIM alignment carries DMARC (`ses.yaml:7-10`, `AWS-NATIVE-ARCHITECTURE.md:41-42`). The existing DMARC policy is `p=quarantine` with relaxed alignment (`dns.yaml:112`). If DKIM fails to align, SES mail will be quarantined by receivers, not rejected.
- The identity is retained because deleting it removes its signing keys and invalidates the DNS records.
- A new SES account is in the sandbox: only verified recipients receive mail. Leaving it is a separate account-level request (`EMAIL-SETUP.md` steps 5-6, lines 22-23). No evidence in the repository that the request was made.
- The IAM side: the instance role may send only when `ses:FromAddress == EmailFromAddress` (`app.yaml:411-415`). The application sends via the SES v2 SDK with `EMAIL_TRANSPORT=ses`; because `ses:SendEmail` is granted on `Resource: *`, any identity in the account verifies with the same condition.
- Mail durability: messages are stored in `app.email_outbox` before sending and retried with backoff up to 8 attempts or 24 hours (`EMAIL-SETUP.md:10`). An abandoned message fires `EmailDeadAlarm` (file 03).

Hosted state: stack created, three tokens issued, DNS records "not yet added" as of 2026-10-11 (`V1-DEPLOYMENT-REPORT.md:114`); `cutover-preflight.sh` G4 will fail until `VerifiedForSendingStatus` is true. SES delivery has never been exercised from AWS (`EMAIL-SETUP.md:40`, last line).

## 3. `dns.yaml`: Route 53 zones and the records to preserve

### Parameters (`dns.yaml:12-29`)

`CloudFrontDomainName` (empty or `^[a-z0-9]+\.cloudfront\.net$`), `AcmComName1/Value1`, `AcmComName2/Value2`, `AcmInName1/Value1`, `AcmInName2/Value2` (free strings), `SesDkimToken1..3` (`^([a-z0-9]{20,40})?$`). All default to empty; each record is created only when its inputs are present (conditions `HasCloudFront`, `HasAcmCom1/2`, `HasAcmIn1/2`, `HasSesDkim` at `:31-40`). `HasSesDkim` requires all three tokens.

### Resources

| Resource | Content | Reason |
|---|---|---|
| `ZoneCom`, `ZoneIn` | hosted zones `kiitnest.com`, `kiitnest.in`; `Retain` | Deleting and re-creating a zone issues a different set of nameservers; mail and site would be offline until the registrar is updated (`:43-44`). |
| `MailExchange` | MX `1 smtp.google.com.` TTL 600 | Google Workspace mail, reproduced from the GoDaddy inventory. |
| `ApexText` | TXT with two values: Google site verification and `v=spf1 include:dc-bdaca08905._spfm.kiitnest.com ~all` | GoDaddy held two apex TXT records; Route 53 requires one record set with several values. TTL becomes one value (600). |
| `SpfInclude` | TXT `dc-bdaca08905._spfm...` `v=spf1 include:_spf.google.com ~all` | |
| `GoogleDkim` | TXT `google._domainkey` as two 255-character strings | 408 characters exceed the single-string limit; resolvers join the strings. `templates.test.ts:253-258` proves the joined key equals the saved snapshot. |
| `Dmarc` | TXT `_dmarc` `p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | The reporting address belongs to GoDaddy's mail infrastructure (`onsecureserver.net`): DMARC aggregate reports continue to go to GoDaddy after the move. Not changed by this template. |
| `DomainConnect` | CNAME `_domainconnect` to `_domainconnect.gd.domaincontrol.com.` | GoDaddy-specific helper record, reproduced for parity. |
| `ComApexA/Aaaa`, `ComWwwA/Aaaa`, `InApexA/Aaaa`, `InWwwA/Aaaa` | alias A/AAAA to the CloudFront name, hosted zone `Z2FDTNDATAQYW2` (CloudFront's fixed zone id) | Created only with `CloudFrontDomainName`. `EvaluateTargetHealth: false`. |
| `AcmCom1/2`, `AcmIn1/2` | CNAME, TTL 300 | Validation records, added beside, never instead of, the existing set. |
| `SesDkim1..3` | CNAME `<token>._domainkey.kiitnest.com.` to `<token>.dkim.amazonses.com`, TTL 3600 | |

Outputs: `ComNameServers`, `InNameServers` (comma-joined), `ComZoneId`, `InZoneId`.

### Hazards

- **The `kiitnest.in` zone is a guess.** The `.in` records were never inventoried at GoDaddy (`DNS-MIGRATION.md:9`, `:45`; `CUTOVER-RUNBOOK.md:30` says the same). If `kiitnest.in` has MX or other records at GoDaddy that are missing here, delegating the zone drops them. The template contains nothing for `kiitnest.in` except web aliases and ACM records.
- **Origin certificate records.** `origin.kiitnest.com` (CNAME to the ALB) and the ACM validation record for it are not in this template (file 05, D-08). After delegation, `origin.kiitnest.com` ceases to resolve, CloudFront cannot reach the origin, and the site is down. The cutover runbook does not list this record. This is the most serious gap in the DNS design. Verification: `dns.yaml` text contains no `origin` record; `grep` over the file finds none.
- **Other GoDaddy records.** The inventory is one dated snapshot (`EVIDENCE/dns-snapshot-kiitnest.com-2026-10-09.md`); `dns-compare.mjs` checks only six default names plus `--names` extras (`scripts/lib/dns-compare-core.mjs:180-190`). A record at a name not in that list (for example a subdomain used for something else) is invisible to the comparison and lost on delegation.
- **TTL.** Mixed TTLs (600, 3600, 300) are retained per record but the NS delegation TTL at GoDaddy (1 hour) governs how fast a rollback propagates (`CUTOVER-RUNBOOK.md` rollback table).
- **Alias without health check.** If CloudFront is disabled the alias still resolves; failure is a CloudFront 403/404, not a DNS failure.
