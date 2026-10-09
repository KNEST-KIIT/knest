# DNS snapshot: kiitnest.com, 2026-10-09 (read-only)

Source: the GoDaddy DNS Records table for `kiitnest.com`, read from the owner's signed-in browser (all 12 records over two pages), cross-checked against public DNS answers. **Nothing was changed.** This is the rollback reference for any nameserver change: if Route 53 ever has to be abandoned, GoDaddy's zone (untouched) still holds exactly this.

| # | Type | Name | Data | TTL |
|---|---|---|---|---|
| 1 | A | `@` | Parked (GoDaddy parking; public answers 15.197.148.33 and 3.33.130.190) | 600 s |
| 2 | NS | `@` | `ns43.domaincontrol.com.` | 1 h |
| 3 | NS | `@` | `ns44.domaincontrol.com.` | 1 h |
| 4 | CNAME | `www` | `kiitnest.com.` | 1 h |
| 5 | CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com.` | 1 h |
| 6 | SOA | `@` | primary nameserver `ns43.domaincontrol.com.` (managed by GoDaddy) | 1 h |
| 7 | MX | `@` | `smtp.google.com.` priority 1 | 600 s |
| 8 | TXT | `@` | `google-site-verification=NOi-FDQrbPNRT_bpSyd4YYUg1tP0vjeu1m7jFJdqfQE` | 600 s |
| 9 | TXT | `@` | `v=spf1 include:dc-bdaca08905._spfm.kiitnest.com ~all` | 1 h |
| 10 | TXT | `dc-bdaca08905._spfm` | `v=spf1 include:_spf.google.com ~all` | 600 s |
| 11 | TXT | `google._domainkey` | the Google Workspace DKIM public key (below) | 600 s |
| 12 | TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | 1 h |

Record 11, value (a public key, safe to record; 2048-bit RSA, 408 characters, so a DNS provider that limits one string to 255 characters stores it as two strings that resolvers join):

```
v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo7CB7qgcpUUOBPI7F+4+Sik9xd0mPtlo+cqwikQVGyaJh6vMnaL5kC6ECZqU9GxPrP8qRN4g6ap9rDmQT+5wJOSSib2FyrS+g+277PQ1fWy0L/gDlF9jDds85QqDq8++Hew8mM6SEGY4GXgipUA6cuZwLmDQG3iFJlNzard8EV5pIwMJdotjkBMKMpL8iAD8zCHoIarUbn+nL3ZpUIqPKQmibVP5ZU0MZHH+EW3SpVaypY0S6hncAKdcY8kcOc/oaY06CjDewqauUQlC35AOwF4EDKVB1g9fKqYnl5wp7OEVEch7LiWJ7wa0WgL/7EsYEGAEp4AloR3Jgyz9wi4mpQIDAQAB
```

## What a nameserver move must reproduce (everything except NS and SOA, which Route 53 supplies itself)

Records 5 and 7 to 12 exactly as above; records 1 and 4 (the parked apex and `www`) are replaced by aliases to CloudFront at the final cutover, not copied. Two points a naive copy would break:

1. **Two TXT records at the same name** (`@`: Google verification and SPF) are one record set in Route 53 with two values, with one TTL (600 s here). Both values must be present.
2. **The DKIM value exceeds 255 characters**; Route 53 requires it as two quoted strings in one value.

`kiitnest.in`: public DNS lookups returned no records on 2026-10-09. Its GoDaddy records were not viewed; before its zone is built they must be read the same way.

## Verification to run before any nameserver change

`node scripts/dns-compare.mjs kiitnest.com <godaddy-ns> <route53-ns>` queries both servers directly for every record above and fails on any difference. The result is part of the cutover manifest.
