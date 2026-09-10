# Commercial documents

Two client-facing documents for KNEST, generated from a single source so the
arithmetic is never typed by hand.

| File | What it is |
|---|---|
| `knest-development-invoice.{html,pdf}` | Invoice for the build — 53 modules, ₹1,23,200 gross less a ₹25,000 concession = **₹98,200** |
| `knest-amc-proposal.{html,pdf}` | Annual maintenance proposal — 28 coverage areas, **₹96,000/year** |

Scope covers the KNEST ecosystem platform *and* the KIIT lab booking platform,
delivered as one installable PWA on AWS (Amplify, RDS, S3, CloudFront, SES,
Secrets Manager, CloudWatch) behind Cloudflare with Turnstile.

## How the pricing is built

Every module is priced as **estimated hours × a flat ₹200/hour**, the same rate on
all 81 line items. The generator throws if any amount is not a whole number of
hours at that rate, so the effort story can never drift from the prices.

That gives 616 hours on the build and 480 hours a year on maintenance, which is
what the market comparison anchors against — ₹1,000/hr is the floor of the
prevailing Indian agency band, so the headline saving is the conservative one.

Amounts in words are generated (Indian numbering), not typed.

**The AMC is deliberately not a percentage of the build price.** At ₹96,000 it is
78% of the ₹1,23,200 build scope, well outside the customary 15–40% convention.
The proposal meets that objection directly rather than hoping nobody does the
division: the build carries a student rate and a concession, so a percentage of it
would price maintenance by an accident of who built it. Keep that section if you
change the fee — deleting it leaves an easy line of attack open.

## Pricing knobs

All in `generate.mjs`, near the top:

| Constant | Effect |
|---|---|
| `RATE` | The flat hourly rate. Changes every line, both documents, and every derived figure. |
| `DEV_DISCOUNT` | The concession. Set to `0` to invoice the full ₹1,23,200 scope. |
| `MARKET_LOW` / `MARKET_HIGH` | The agency band the comparison anchors to. |
| `FREELANCE_LOW` | Senior freelance floor used in the comparison table. |
| `INHOUSE_YEAR` / `INHOUSE_MONTHS` | The in-house hire comparison. |
| `CLOUD_Y2` / `CLOUD_Y3` | AWS + Cloudflare estimates in the 3-year TCO table. |
| `AMC_HOURS` | Enhancement hours bundled into the AMC fee. |
| `AMC_HOURLY` | Rate charged beyond those hours. |

Every total, subtotal, line count, hour count, saving and percentage in both
documents is derived — change a line amount and everything downstream follows.

## A caution on the comparison figures

The market rates, the in-house salary and the cloud estimates are **indicative,
and labelled as such in the documents**. They are defensible as ranges, not as
quotations. Do not tighten them into specific claims about specific vendors, and
be ready to say where they came from if KNEST asks — the documents invite them to
test the rates against two vendors, which only works if you mean it.

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
