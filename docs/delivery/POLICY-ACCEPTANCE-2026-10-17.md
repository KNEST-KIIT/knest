# Policy acceptance and publication candidate

> **Update 2026-10-28: read this first.** This record describes the owner's confirmation of 2026-10-17 and what was published then. Two later instructions in the 2026-10-27 release brief change what is live, so this file is amended where it would otherwise mislead; its history is kept.
>
> - **Retention is now five years, then transfer to an approved backup and archive.** The ten-year wording described below was replaced in `/privacy` (Retention and deletion), whose version label is now **27 October 2026**. The engineering assessment is [RETENTION-ASSURANCE-2026-10-17.md](RETENTION-ASSURANCE-2026-10-17.md).
> - **`/terms` is now the KIITNEST Terms and Conditions** (stakeholder file `02_Terms_and_Conditions.docx`, 15 sections, version 27 October 2026). The mentorship and facility terms this record calls `/terms` are kept, unchanged, at `/terms/facilities`. Line-by-line traceability and the four editorial adjustments (A1-A4) are in [STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md](STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md).
>
> Current published counts (`src/content/policies.ts`): privacy 11 sections / 25 paragraphs, Terms and Conditions 15 / 34, facility terms 5 / 14, disclaimer 8 / 18. The source hashes below are for the 2026-10-17 originals and remain accurate for those files.

The owner confirmed on 2026-10-17 that the documents sent by Charanjeet in the KIITNEST web team WhatsApp group are final: **“what eveer they have sent is final”**. This direction supersedes the privacy file's retained draft footer for publication. It is an owner confirmation of the supplied documents, not an invented institutional signature or public-launch acceptance.

## Source and fidelity

The originals were downloaded through WhatsApp to the owner's local `Downloads/KNEST-policy-evidence-2026-10-17` folder. Original DOCX files are preserved outside this public repository. Body paragraphs, headers, footers and review markup were inspected; no tracked insertions/deletions or comments were present. This was a content inspection, not a Word layout certification.

| Source | SHA-256 | Application route |
|---|---|---|
| `01_Privacy_Policy.docx` | `a88bce1cb023a5d6343929f18abf0c8dbff3e955e558e3a0e7b47ce3afef2be5` | `/privacy` |
| `03_Disclaimer_and_Third_Party_Content.docx` | `e44de3543ff232eeeb0fbed91f7cbc06e494a961f86519dd7b0a552c984a6666` | `/disclaimer` |
| `Lab & Mentor facility.docx` | `0326d0d700da59edd9b0aec38213a4e120e85cb2240fdd9910836390ff900f60` | `/terms/facilities`, labelled mentorship and facility terms (it was `/terms` until 2026-10-27) |

`src/content/policies.ts` preserves all body sections and paragraphs: privacy 11 sections/24 paragraphs, disclaimer 8/18, service terms 5/14. The body is rendered as escaped React text with semantic headings, contents links, related-policy links and mail links. No arbitrary HTML is interpreted.

Publication adjustments are limited to:

- Excluding the superseded draft footer and page-number machinery.
- Adding a page title to the untitled facility document and using the actual service scope for its title, rather than claiming a separate general Terms and Conditions document was delivered.
- Completing the privacy document's unfinished incident-reporting recipient with `contact@kiitnest.com`, the same address already supplied for grievances/support and repeated in all three files.
- Showing 2026-10-17 as the application policy version; this is the implementation/version date, not a backdated institutional signature.

**Superseded on 2026-10-27.** On 2026-10-17 the written privacy policy's ten-year retention followed by controlled archiving was the publication source; the earlier WhatsApp answer had said five years, and the owner's confirmation to use the documents as final resolved which supplied text was implemented then. The 2026-10-27 release brief states that retention is **five years then backup**, superseding the older ten-year language, and the privacy text, its version label and the delivery documents were changed to match (see the update at the top). The change was made on that instruction, not silently: it is recorded here, in the retention assessment and in the traceability matrix, and tests fail if ten-year wording returns.

## Effect on release work

Policy text is now available and owner-confirmed. Do not continue to report it as unwritten or ask the owner to reconfirm these files. The public routes, footer, signup notice and sitemap use the supplied policies. Global indexing/private-preview controls and lab/QR feature flags remain in force.

This content change does not execute a retention/archiving programme, provision a mail responder, certify legal compliance or prove infrastructure safeguards. As of 2026-10-28 the infrastructure template keeps application logs in CloudWatch for 1827 days (five years) and moves applicant documents to S3 Glacier Deep Archive at 1827 days without ever deleting them, but CloudWatch only expires logs, no log export pipeline exists, and no archive destination has been approved. The five-year transfer to an *approved* backup and archive must be mapped to an accepted operating procedure before claiming the deployed system meets that obligation. Archive destination, backup treatment, restoration and deletion exceptions need operating acceptance; the open items are listed in [RETENTION-ASSURANCE-2026-10-17.md](RETENTION-ASSURANCE-2026-10-17.md).

The group answer names operational contacts, accepts Mumbai hosting, and identifies a go-live approver, while saying public content approval will be shared and the go-live date is undecided. Those remaining content/operating/cutover decisions are distinct from the owner's acceptance of these three policies. No missing approver signature, content approval or separate general Terms and Conditions document has been fabricated. The cutover preflight is unchanged and no launch evidence file was manufactured to satisfy it.

## Verification

Source hashes and all section/paragraph counts were checked against the local originals. Updated existing integration checks assert the policy content, contact links, preserved global noindex control, sitemap inclusion and absence of obsolete draft placeholders. The disclaimer is included in the existing desktop/phone accessibility sweep. Build, lint, type and integration results are recorded in the continuation checkpoint after they complete.
