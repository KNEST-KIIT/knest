# Stakeholder DOCX Requirements Traceability Matrix

**Date**: 2026-10-29  
**Authority**:
1. Stakeholder Document 1: `KNEST Website changes.docx` (`C:\Users\anand\Documents\Codex\2026-10-23\referenced-chatgpt-conversation-this-is-an\outputs\KNEST Website changes.docx`)
2. Stakeholder Document 2: `02_Terms_and_Conditions.docx` (`C:\Users\anand\Documents\Codex\2026-10-23\referenced-chatgpt-conversation-this-is-an\outputs\02_Terms_and_Conditions.docx`)
3. Stakeholder Direct Message: Data retention policy established at **5 years then backup** (superseding legacy 10-year retention references).

---

## Part 1: KNEST Website Changes Traceability

| Ref # | Stakeholder Requirement | Authoritative Source Text | Implemented Route / Source File | Technical Resolution | Test Evidence |
|---|---|---|---|---|---|
| **WC-01** | Subdomain migration | `1. Change the subdomain from sld.kiit.ac.in to siel.kiit.ac.in` | `src/app/(public)/about/page.tsx` (Lines 68, 182) | Replaced `https://sld.kiit.ac.in/mba` with `https://siel.kiit.ac.in/mba` across institutional role data and MBA program CTA. | `vitest run tests/integration/31-public-pages.test.ts` |
| **WC-02** | Institutional naming: SLD -> SIEL | `2. Change from SLD (School of Leadership) to SIEL (School of Innovation & Entrepreneurial Leadership)` | `src/app/(public)/about/page.tsx`, `src/app/(public)/admissions/page.tsx`, `src/payload/collections/infrastructure.ts` | Reconciled all institutional references to "School of Innovation & Entrepreneurial Leadership" (SIEL). No unapproved legacy "School of Leadership" strings remain in user-facing content. | `vitest run src/content-integrity.test.ts` |
| **WC-03** | Homepage & About Leadership / Dean designation | `Leadership Messages – “Dean, School of Leadership”`, `About Page: Dean's designation - SLD`, `Dr. Pinaki Nandan Pattnaik – Dean, School of Leadership` | `src/app/(public)/about/page.tsx`, `src/content/policies.ts` | Dean's administrative anchor correctly reflects SIEL. Responsible entity is registered as Dr. Pinaki Nandan Pattnaik at KIITNEST Incubation Forum. | `vitest run src/content-integrity.test.ts` |
| **WC-04** | Deduplicate Brochure CTA | `3. Admission Page Changes: 1. Remove “Request a Brochure by Email” CTA (at the bottom), as it is already downloadable in the topmost CTA.` | `src/app/(public)/admissions/page.tsx` | Topmost CTA provides direct download of the official brochure; bottom duplicate "Request a Brochure by Email" form/CTA is omitted. | `vitest run tests/integration/31-public-pages.test.ts` |
| **WC-05** | Real Brochure Asset & Link | `No brochure in the link` | `public/knest-brochure.pdf`, `src/app/(public)/admissions/page.tsx`, `src/app/(public)/about/page.tsx` | Deployed official high-resolution brochure asset `KNEST (1).pdf` (14.6 MB) to `public/knest-brochure.pdf`. Added direct download links with proper `download="KNEST-Official-Brochure.pdf"` attributes. | `vitest run tests/integration/31-public-pages.test.ts` |
| **WC-06** | Cohort Start Date | `Admissions at a Glance: Cohort Start – 13 July 2027` | `src/app/(public)/admissions/page.tsx` | Displayed `13 July 2027` as the official cohort commencement date in the "Admissions at a Glance" schedule. | `vitest run tests/integration/31-public-pages.test.ts` |
| **WC-07** | Application Deadline Outdated Notice | `Application Deadline – Outdated date: 16 February 2027` | `src/app/(public)/admissions/page.tsx` | Published an honest `Awaiting Confirmation · TBD` state, explicitly noting that 16 February 2027 is outdated and awaiting institutional schedule confirmation. | `vitest run tests/integration/31-public-pages.test.ts` |

---

## Part 2: Terms and Conditions Traceability (`02_Terms_and_Conditions.docx`)

| Clause # | Heading | Requirements Summary | Target Implementation | Route & Component | Test Evidence |
|---|---|---|---|---|---|
| **TC-01** | 1. Acceptance and scope | Governs access to website, accounts, profiles, applications, programmes, mentors, lab bookings, and events. | `POLICIES["terms"].sections[0]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-02** | 2. Platform operator and contact | Registered Office of KIITNEST INCUBATION FORUM at Plot-386, Sub Plot-1, Sai Anandam, Bhubaneswar 751024, Campus 15B. | `POLICIES["terms"].sections[1]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-03** | 3. Registration, eligibility and accounts | Accurate data, eligibility checks, credential confidentiality, and prompt reporting to contact@kiitnest.com. | `POLICIES["terms"].sections[2]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-04** | 4. Acceptable use | Prohibits impersonation, malware, scraping, harassment, attendance falsification; mandates safety compliance. | `POLICIES["terms"].sections[3]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-05** | 5. Applications and submissions | Submitter responsibility for pitch decks/IP; right of KIITNEST to verify, diligence, and reject ineligible drafts. | `POLICIES["terms"].sections[4]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-06** | 6. Incubation, mentoring and funding | No guaranteed incubation, funding, or commercial outcome unless in signed separate contract; mentor opinions are individual. | `POLICIES["terms"].sections[5]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-07** | 7. Bookings, attendance and facilities | Slot durations, cancellation rules, check-in verification, QR pass anti-falsification, and cancellation for safety. | `POLICIES["terms"].sections[6]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-08** | 8. User content and permissions | Users retain IP ownership; grant limited royalty-free operational license to KIIT; no unauthorized promotional publication. | `POLICIES["terms"].sections[7]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-09** | 9. Intellectual property | Platform source code, designs, and brand owned by KIITNEST; user invention ownership governed by law and institutional policy. | `POLICIES["terms"].sections[8]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-10** | 10. Third-party links and services | Third-party services operate under own terms; disclaimer of external site content. | `POLICIES["terms"].sections[9]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-11** | 11. Suspension and termination | Right to restrict, suspend, or terminate accounts for security, safety, policy violation, or fraud. | `POLICIES["terms"].sections[10]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-12** | 12. Availability and disclaimers | Services subject to maintenance, upgrades, and connectivity; no guarantee of uninterrupted availability. | `POLICIES["terms"].sections[11]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-13** | 13. Liability and indemnity | Non-excludable statutory rights preserved; limits consequential damages; user accountability for unlawful conduct. | `POLICIES["terms"].sections[12]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-14** | 14. Changes, governing law and disputes | Revisions published with effective date; continued use constitutes acceptance where lawful. | `POLICIES["terms"].sections[13]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |
| **TC-15** | 15. Contact | Support mailbox: contact@kiitnest.com; full legal registered office address included. | `POLICIES["terms"].sections[14]` | `/terms` (`PolicyDocument`) | `tests/integration/31-public-pages.test.ts` |

---

## Part 3: Retention Policy Reconciliation

- **Legacy Claim**: 10 years log retention.
- **Authoritative Stakeholder Instruction**: **5 years retention then backup** (per DPDP Act 2023 alignment and stakeholder direct communication).
- **Implementation**:
  - `src/content/policies.ts`: Updated retention policy to 5 years, explicit transfer to approved backup archive, DPDP Act 2023 legal basis, Ms. Charanjit Kaur designated data officer.
  - `scripts/ops/retention-evidence.mjs`: Updated baseline constant to `FIVE_YEAR_LOG_DAYS = 1827`.
  - `infra/cfn/retention.test.ts`: Updated CloudFormation log retention floor tests to 1827 days.
  - `tests/integration/31-public-pages.test.ts`: Asserted `5-year retention period` text on `/privacy`.
