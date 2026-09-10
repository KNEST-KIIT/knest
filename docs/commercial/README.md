# Commercial documents

Two client-facing documents for KNEST, generated from a single source so the
arithmetic is never typed by hand.

| File | What it is |
|---|---|
| `knest-development-invoice.{html,pdf}` | Invoice for the build — 53 modules, ₹1,23,200 gross less a ₹25,000 concession = **₹98,200** |
| `knest-amc-proposal.{html,pdf}` | Annual maintenance proposal — 18 coverage areas, **₹48,000/year** |

Scope covers the KNEST ecosystem platform *and* the KIIT lab booking platform,
delivered as one installable PWA on AWS (Amplify, RDS, S3, CloudFront, SES,
Secrets Manager, CloudWatch) behind Cloudflare with Turnstile.

## Pricing knobs

All in `generate.mjs`, near the top:

| Constant | Effect |
|---|---|
| `DEV_DISCOUNT` | The concession. Set to `0` to invoice the full ₹1,23,200 scope. |
| `AMC_HOURS` | Enhancement hours bundled into the AMC fee. |
| `AMC_HOURLY` | Rate charged beyond those hours. |

Every total, subtotal, line count and percentage in both documents is derived —
change a line amount and everything downstream follows.

## Before sending

`generate.mjs` carries placeholders in `«guillemets»`. Fill in every one:

- `VENDOR` — your name, address, email, phone, PAN, GSTIN
- `BANK` — account holder, bank, account number, IFSC, UPI
- `CLIENT.attn` — the KNEST contact the invoice is addressed to
- The KNEST point-of-contact fields in the AMC acceptance block

If you are registered under GST, delete the "not applicable" lines and add a
GST row to the totals block in both documents.

## Regenerating

```bash
node docs/commercial/generate.mjs        # rewrites both HTML files
```

The script prints the line-item count, the totals and the largest single line,
so a pricing edit is checked as soon as it is made.

To rebuild the PDFs:

```bash
cd docs/commercial
for f in knest-development-invoice knest-amc-proposal; do
  chromium --headless --no-pdf-header-footer \
    --print-to-pdf="$f.pdf" "file://$PWD/$f.html"
done
```

Any browser's Print → Save as PDF works too; the page CSS is set for A4.
