# Policy acceptance and publication candidate

The owner confirmed on 2026-10-17 that the documents sent by Charanjeet in the KIITNEST web team WhatsApp group are final: **“what eveer they have sent is final”**. This direction supersedes the privacy file's retained draft footer for publication. It is an owner confirmation of the supplied documents, not an invented institutional signature or public-launch acceptance.

## Source and fidelity

The originals were downloaded through WhatsApp to the owner's local `Downloads/KNEST-policy-evidence-2026-10-17` folder. Original DOCX files are preserved outside this public repository. Body paragraphs, headers, footers and review markup were inspected; no tracked insertions/deletions or comments were present. This was a content inspection, not a Word layout certification.

| Source | SHA-256 | Application route |
|---|---|---|
| `01_Privacy_Policy.docx` | `a88bce1cb023a5d6343929f18abf0c8dbff3e955e558e3a0e7b47ce3afef2be5` | `/privacy` |
| `03_Disclaimer_and_Third_Party_Content.docx` | `e44de3543ff232eeeb0fbed91f7cbc06e494a961f86519dd7b0a552c984a6666` | `/disclaimer` |
| `Lab & Mentor facility.docx` | `0326d0d700da59edd9b0aec38213a4e120e85cb2240fdd9910836390ff900f60` | `/terms`, labelled mentorship and facility terms |

`src/content/policies.ts` preserves all body sections and paragraphs: privacy 11 sections/24 paragraphs, disclaimer 8/18, service terms 5/14. The body is rendered as escaped React text with semantic headings, contents links, related-policy links and mail links. No arbitrary HTML is interpreted.

Publication adjustments are limited to:

- Excluding the superseded draft footer and page-number machinery.
- Adding a page title to the untitled facility document and using the actual service scope for its title, rather than claiming a separate general Terms and Conditions document was delivered.
- Completing the privacy document's unfinished incident-reporting recipient with `contact@kiitnest.com`, the same address already supplied for grievances/support and repeated in all three files.
- Showing 2026-10-17 as the application policy version; this is the implementation/version date, not a backdated institutional signature.

The written privacy policy's **ten-year retention followed by controlled archiving** is the publication source. The earlier WhatsApp answer said five years; the owner's confirmation to use the documents as final resolves which supplied text is implemented. No retention value was silently substituted in the original file.

## Effect on release work

Policy text is now available and owner-confirmed. Do not continue to report it as unwritten or ask the owner to reconfirm these files. The public routes, footer, signup notice and sitemap use the supplied policies. Global indexing/private-preview controls and lab/QR feature flags remain in force.

This content change does not execute a retention/archiving programme, provision a mail responder, certify legal compliance or prove infrastructure safeguards. In particular, the infrastructure template currently defaults CloudWatch log retention to seven days. The ten-year system/security-log requirement must be mapped to an accepted hosted retention/archive configuration before claiming the deployed system meets that obligation; no log deletion/expiry settings were changed here. Archive destination, backup treatment, restoration and deletion exceptions also need operating acceptance.

The group answer names operational contacts, accepts Mumbai hosting, and identifies a go-live approver, while saying public content approval will be shared and the go-live date is undecided. Those remaining content/operating/cutover decisions are distinct from the owner's acceptance of these three policies. No missing approver signature, content approval or separate general Terms and Conditions document has been fabricated. The cutover preflight is unchanged and no launch evidence file was manufactured to satisfy it.

## Verification

Source hashes and all section/paragraph counts were checked against the local originals. Updated existing integration checks assert the policy content, contact links, preserved global noindex control, sitemap inclusion and absence of obsolete draft placeholders. The disclaimer is included in the existing desktop/phone accessibility sweep. Build, lint, type and integration results are recorded in the continuation checkpoint after they complete.
