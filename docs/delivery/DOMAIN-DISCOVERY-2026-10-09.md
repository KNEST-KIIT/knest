# Domain discovery, 2026-10-09 (read-only)

**Nothing was changed.** The GoDaddy panel was opened in the owner's own signed-in browser session (a delegate-access session, per the banner) and only viewed; the same facts were cross-checked with public DNS queries. No DNS record, nameserver, contact or setting was edited, no purchase or cart action was taken (a "Get kiitnest.net" banner is a GoDaddy upsell and was ignored).

## Domains in the GoDaddy portfolio (2)

| Domain | Expires | Auto-renew | Notes |
|---|---|---|---|
| `kiitnest.com` | 17 Sep 2028 | On | Registered 17 Sep 2026. **Taken as the official domain** (the owner asked for the .com). |
| `kiitnest.in` | 17 Sep 2028 | Off | Public DNS lookups returned no records for it. Confirm whether it should redirect to the .com. |

## Current DNS of `kiitnest.com` (GoDaddy nameservers `ns43.domaincontrol.com`, `ns44.domaincontrol.com`)

| Type | Name | Value | TTL | What it is |
|---|---|---|---|---|
| A | `@` | "Parked" (15.197.148.33, 3.33.130.190) | 600 s | GoDaddy parking page. **This is what an app cutover replaces.** |
| CNAME | `www` | `kiitnest.com.` | 1 h | www follows the apex. **Replaced or kept at cutover.** |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com.` | 1 h | GoDaddy auto-configuration helper. Leave. |
| MX | `@` | `smtp.google.com.` (priority 1) | 600 s | **Live e-mail through Google Workspace.** Must not be touched. |
| TXT | `@` | `google-site-verification=...` | 600 s | Google ownership proof. Leave. |
| TXT | `@` | `v=spf1 include:dc-bdaca08905._spfm.kiitnest.com ~all` | 1 h | SPF (GoDaddy-managed include chain). Amazon SES will need to be added here later without breaking Google. |
| TXT | `dc-bdaca08905._spfm` | `v=spf1 include:_spf.google.com ~all` | 600 s | SPF include for Google. |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | | DMARC already enforcing (quarantine). SES mail must align (DKIM) or it will be quarantined. |

## What this means for the plan

1. **The domain already carries working e-mail.** Pointing the site at AWS or Vercel must change only the `@` A record and the `www` record. MX, SPF, DKIM, DMARC and the Google verification are not to be edited as part of a site cutover. Any SES records are added alongside (SPF include and DKIM CNAMEs), reviewed one by one.
2. **Nameservers stay at GoDaddy for now.** Moving to Cloudflare means changing nameservers, which must be preceded by an export of every record above (so e-mail does not break) and needs its own approval (D1). The simplest safe route for the first release is to keep GoDaddy DNS and only edit `@`/`www`; Cloudflare can follow when staging validates it.
3. **Cutover mechanics (for the later approval):** lower the TTL of `@` and `www` to 300 s a day before; add the new target; verify the site over HTTPS (certificate issued) on the new target by its hostname before switching; switch `@` and `www`; keep the previous values written down for an immediate rollback (they are listed above).
4. **Until a production target exists there is nothing correct to point the domain at.** The only live target is the Vercel maintenance page. Attaching the domain to the Vercel project (so `kiitnest.com` shows the maintenance notice) is possible, but it is a live DNS change and needs the owner's explicit yes for that specific change.

## Decisions needed from the owner for the domain

| # | Decision |
|---|---|
| DOM-1 | Confirm `kiitnest.com` is the official domain and what `kiitnest.in` should do (redirect to the .com, or stay unused). |
| DOM-2 | Option A: keep GoDaddy DNS and edit only `@` and `www` at cutover (recommended for the first release). Option B: move nameservers to Cloudflare first (needs a record export and a separate approval). |
| DOM-3 | Whether to attach `kiitnest.com` to the Vercel maintenance page now (a live DNS change: `@` A and `www` CNAME to Vercel, previous values recorded above for rollback), or wait until the AWS target is validated. |
| DOM-4 | The e-mail sending plan: confirm that the platform's mail should come from an address on `kiitnest.com` through Amazon SES, which means adding SES SPF/DKIM records beside the existing Google ones. |
