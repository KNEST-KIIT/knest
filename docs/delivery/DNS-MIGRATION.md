# DNS migration runbook: GoDaddy to Route 53 (kiitnest.com, kiitnest.in)

**Status: prepared, no delegation executed.** No staging subdomain is used (owner decision, 2026-10-09). The owner reconfirmed Route 53 DNS, canonical `.com` and redirect-only `.in` on October 18. The live Google Workspace mail on `kiitnest.com` must not be interrupted. Current inventory and rollback reference: [October 18 inventory](EVIDENCE/dns-snapshot-2026-10-18.md), including the original mail snapshot. Templates: `infra/cfn/dns.yaml` (zones and records), `infra/cfn/cert.yaml`, `infra/cfn/edge.yaml`. Tools: `scripts/dns-compare.mjs` and `scripts/ops/dns-cutover-check.mjs`.

Every step marked **[approval]** needs the owner's explicit yes to that exact change. Nothing before step 6 changes anything a visitor or a mail server can see.

## Phase A: prepare (no live effect)

1. **Re-read GoDaddy** immediately before starting (records change). Update the snapshot file if anything differs. For `kiitnest.in` read its records the same way (not yet viewed; public lookups showed none).
2. **Create the zones**: deploy `dns.yaml` with `CloudFrontDomainName` empty. Supply the current `knest-production-origin` output `LoadBalancerDnsName` as `OriginDnsName`, plus the full regional origin ACM CNAME as `OriginValidationName` and `OriginValidationValue`. This creates two hosted zones and preserves mail, SPF, DKIM, DMARC, verification and origin TLS records. Read the eight nameservers from the stack outputs. A zone that nobody delegates to is inert. Resolve the `.in` registrar hold/WHOIS verification before attempting its delegation; an undelegated zone does not resolve that hold.
3. **Prove the copy is exact.** For each Route 53 nameserver:
   `node scripts/dns-compare.mjs kiitnest.com ns43.domaincontrol.com <route53-ns> --ignore kiitnest.com|A,www.kiitnest.com|A,www.kiitnest.com|CNAME,NS`
   This is a manual comparison example, not full acceptance. Before cutover run `AWS_PROFILE=<verified-scoped-role> node scripts/ops/dns-cutover-check.mjs`; it requires current issued ACM/SES/origin metadata, proves both registrar source pairs agree, then checks all eight Route 53 nameservers for both exact public zones, including positive origin/renewal/mail answers and AWS-derived CNAME targets. The ignored lines are only the web A/AAAA/www records that cutover replaces; registrar-source comparisons ignore none. Save reviewed output under `EVIDENCE/`. A comparison of matching absent answers alone cannot establish preservation. Both preflight/apply entry points reject the documented root profile before any AWS command.

## Phase B: certificate and mail identity, before the cutover (additive records at GoDaddy) **[approval]**

4. Deploy `cert.yaml` in us-east-1. Read the validation CNAMEs with `aws acm describe-certificate` (four names: apex and www of each domain). **Show the owner the exact names and values**; on approval add exactly those CNAME records at GoDaddy. They are additive: no existing record is edited or removed. Certificate status becomes ISSUED. Add the same records to Route 53 through `dns.yaml` parameters `AcmCom*` and `AcmIn*` so renewal keeps working after the move.
5. Create the SES domain identity with Easy DKIM. Show the owner the three DKIM CNAMEs (`<token>._domainkey.kiitnest.com` to `<token>.dkim.amazonses.com`); on approval add them at GoDaddy and to Route 53 (`SesDkimToken1..3`). **The SPF record is not edited**: DMARC passes when DKIM aligns, and SES signs with the `kiitnest.com` domain. Whether to also add an SES include to SPF is a separate decision with a before-and-after shown first. Send a test message to a controlled mailbox and read its headers (`dkim=pass`, `dmarc=pass`).

## Phase C: release gate

The application passes its release gate (private production verification with `scripts/verify-production.mjs`, authentication and CMS checks, synthetic accounts only, privacy notice approved, owner approval of the release manifest). Only then:

## Phase D: cutover **[approval of the exact manifest]**

6. **A day before:** lower the TTL of the apex and `www` records at GoDaddy to 300 seconds. (Do not touch other TTLs.)
7. **Immediately before:** re-run step 3 against all four nameservers for both zones, and confirm the distribution answers on its aliases (`--connect-to <cloudfront-ip>` with `--alt`). Record the GoDaddy nameservers (`ns43.domaincontrol.com`, `ns44.domaincontrol.com`) as the rollback target.
8. **Apply the web records in Route 53:** redeploy `dns.yaml` with `CloudFrontDomainName` set. The aliases for `@` and `www` of both domains point at the distribution. Still invisible to the world until step 9.
9. **Change the nameservers** at GoDaddy for `kiitnest.com` to the four Route 53 nameservers, then for `kiitnest.in`. This is the moment of change.
10. **Watch** from several resolvers (`nslookup -type=MX kiitnest.com 8.8.8.8` and `1.1.1.1`, `9.9.9.9`) until all answer from Route 53; send and receive a test e-mail on the Google mailbox in both directions; run `scripts/verify-production.mjs --url https://kiitnest.com --alt www.kiitnest.com,kiitnest.in,www.kiitnest.in --waf --origin <origin>` and keep the output as evidence.
11. Remove the access gate (redeploy `edge.yaml` with `AccessHash` empty) only when the release manifest says so.

## Rollback

| Problem | Action | Time |
|---|---|---|
| Site wrong or down after step 9, mail fine | Point the distribution's aliases back, or restore the GoDaddy nameservers (`ns43`, `ns44.domaincontrol.com`); GoDaddy's zone was left untouched and still holds the old records | Resolvers pick up within the NS TTL (1 h at GoDaddy) |
| Mail affected | Restore GoDaddy nameservers immediately, then compare the Route 53 zone to the snapshot | Same |
| Certificate or alias problem | Restore the previous TTL records; the old GoDaddy parked page is the previous state | Minutes (300 s TTL) |

The GoDaddy zone is kept unchanged, and the domains remain registered at GoDaddy, for at least a week after cutover. Registrar transfer to Route 53 is not part of this plan and would be its own decision.

## What is not claimed

No Route 53 delegation or live scoped-AWS DNS acceptance has been performed in this continuation. Both registrar zones were inventoried on October 18 (IST); `.in` is blocked by WHOIS verification/Registrar Hold. Local fixtures and template tests do not prove live AWS readiness.
