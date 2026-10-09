# HD-06: privacy notice and terms: inputs, gaps and draft status

**Status: BLOCKED on a named KIIT owner. Nothing in this file is approved policy and none of it is legal advice.** The `/privacy` and `/terms` routes will ship as pages that say the policy is being finalised. Draft text, if shown at all, appears only in a non-production preview and is labelled "DRAFT, NOT APPROVED". The platform must not collect real student data until a notice approved by KIIT is live (blueprint gate: Pilot-A).

## 1. Facts the notice has to be built from (from the code, verified 2026-10-08)

Personal data the system stores, by table (`src/db/schema`):

| Table | Data | Source of the data |
|---|---|---|
| `users` | e-mail, name, password hash (bcrypt), photo URL, platform role, staff role, bio, organisation, school, graduation year, LinkedIn and website URLs, skills, interests, goals, expertise, years of experience, mentor availability, journey stage, profile visibility, onboarding completion time, active flag | sign-up, onboarding, Google sign-in |
| `accounts` | Google account link, OAuth tokens | Google sign-in (only if enabled) |
| `sessions` | session token, expiry (cookie `authjs.session-token`, 30 days) | login |
| `verification_tokens` | e-mail verification and password-reset tokens (currently stored in plaintext; hashing is planned, R-08) | sign-up, reset |
| `applications`, `application_answers` | which program, status, submission and decision times, decision note, every free-text answer | applying |
| `application_documents` | file name, type, size, storage key; the file itself in S3 | uploads (PDF/Office) |
| `event_registrations` | which events a person registered for | events |
| `notifications` | in-app notices and the e-mails sent (subject/body kept as in-app rows) | system |
| `audit_logs` | staff actions with before/after values | staff actions |
| `analytics_events` | event name, anonymous session id, optional user id, small props | site use |
| `rate_limits` | counters keyed by IP address and by user (abuse prevention) | all requests to limited routes |

Not yet built but contracted (so the notice will need amending): lab bookings, attendance records, QR credentials, device keys, enquiries (`/contact`), Cloudflare Turnstile (a third party sees the visitor's browser signals), e-mail sending through Amazon SES, document storage in Amazon S3 (ap-south-1), hosting in AWS Mumbai.

Cookies: one first-party session cookie; one anonymous analytics cookie (`knest_sid`, 180 days, currently often not persisted). No third-party analytics or advertising scripts.

## 2. Facts only KIIT can supply (all UNKNOWN today)

1. **Who is the data fiduciary**, and the name and contact of a privacy/grievance officer. (The only person named in the brochure and on `/about` is the KNEST coordinator; whether she is the right contact is not established.)
2. **Whether the Digital Personal Data Protection Act 2023 applies as KIIT reads it**, and under what rules the university already operates (an existing KIIT privacy policy to adapt is the recommended route).
3. **Minors:** some first-year students may be under 18. Does KIIT require verifiable parental consent, or treat enrolled students as adults for this purpose?
4. **Lawful basis and consent text:** what the sign-up checkbox must say and whether separate consent is needed for photographs, mentor profiles published in the directory, or testimonials.
5. **Retention periods** for: rejected and accepted applications, uploaded documents, accounts that never verify, analytics events (proposed 12 months), rate-limit rows (7 days), audit logs, lab attendance.
6. **Deletion and access requests:** who receives them, the response time, and who in staff may perform a deletion (there is no deletion workflow yet; building it needs the answer to this and to 5).
7. **Sharing:** are application data shared with anyone outside KNEST staff (mentors, partners, investors, other KIIT units)? The code shares nothing today.
8. **Cross-border processing:** the plan keeps data in Mumbai; Cloudflare and Turnstile process requests globally. Is that acceptable?
9. **Terms:** governing law and jurisdiction, acceptable-use rules, who owns content applicants submit, what happens to accounts at graduation, and the lab-booking rules (cancellation, damage, no-shows; HD-16).
10. **Language:** English only, or also Odia/Hindi?

## 3. What will ship without those answers

- `/privacy` and `/terms`: real routes, `noindex`, a plain statement that the policy is being finalised and a contact route, **no policy text**. A footer link that returns 404 is a defect; a page that says nothing false is not.
- A non-production preview flag may render the reviewable draft below, with a banner on every section.
- Sign-up keeps working only for test/synthetic accounts until HD-06 is closed; the notice link is placed next to the sign-up button now so approving text is a content change, not a code change.

## 4. Reviewable draft outline (structure only, to be filled by KIIT legal)

1. Who we are and how to contact us *(KIIT to supply)*
2. What we collect and why *(use the table in section 1)*
3. Who can see it *(staff roles: reviewer, program manager, content admin, super admin; lab staff when built)*
4. Where it is stored and how it is protected *(Mumbai region, encryption at rest and in transit, role-based access, audit logging; avoid promises beyond what has been verified)*
5. How long we keep it *(KIIT to supply)*
6. Your choices and rights, and how to exercise them *(KIIT to supply)*
7. Children and minors *(KIIT to supply)*
8. Cookies
9. Changes to this notice

Each statement about security in the final text must be checked against `docs/delivery/EVIDENCE/` before publication; for example, "encrypted at rest" is true of AWS storage only after S-1/F-05 configure it.

## 5. Approval record

| Item | Owner | Status |
|---|---|---|
| Named approver for the privacy notice | KIIT | NOT NAMED |
| Privacy notice text | KIIT legal | NOT WRITTEN |
| Terms text | KIIT legal | NOT WRITTEN |
| Under-18 handling | KIIT legal | UNDECIDED |
| Retention and deletion policy | KIIT | UNDECIDED |
