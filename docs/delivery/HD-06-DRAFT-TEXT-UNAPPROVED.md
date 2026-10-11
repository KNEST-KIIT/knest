# DRAFT, NOT APPROVED: privacy notice and terms text for institutional review

**Status: DRAFT, NOT APPROVED. This text is not policy. It was written by engineering from what the code does, so that the institution has something concrete to correct. It must not be shown to the public, and the platform must not collect real student data, until a named KIIT approver signs `docs/delivery/EVIDENCE/hd-06-approval.md`. Engineering authorization does not supply that approval.** Bracketed items are facts only KIIT can provide (see `HD-06-PRIVACY-INPUTS.md` section 2).

## Privacy notice (draft)

**Who we are.** KNEST is the startup and innovation platform of [KIIT legal entity name]. Questions and requests go to [privacy contact and address, to be named by KIIT].

**What we collect, and why.**
- Account: your name, email address and a password stored only as a salted hash. To let you sign in and to contact you about your account.
- Profile, if you add one: role, organisation, school, graduation year, links, skills and interests. To recommend programs and, if you choose, to appear in directories.
- Applications: your answers and any documents you upload (PDF or Office files up to 10 MB). To let staff review your application.
- Events: which events you register for.
- Messages you send through the contact form: name, email and message.
- Technical data: your IP address is used by abuse limits (login, sign-up, forms) and kept as counters for [7 days, to be confirmed]. An anonymous analytics identifier cookie (`knest_sid`) records which pages are used. We use no third-party advertising or analytics scripts.

**Who sees it.** KNEST staff according to role: reviewers see applications assigned to review; program, content and super administrators see what their role needs. Nothing is shared outside KNEST staff today [KIIT to confirm any sharing with mentors, partners, investors or other university units].

**Where it is stored.** In Amazon Web Services, Mumbai region (database, document storage, email sending). Cloudflare Turnstile checks that a form is submitted by a person and sees your browser signals when you use a form [KIIT to confirm cross-border acceptability]. Data is encrypted in transit and at rest. Staff actions on records are logged.

**How long we keep it.** [Retention for accounts, applications, documents, analytics, audit logs: KIIT to supply.]

**Your choices and rights.** You can ask to see, correct or delete your data by writing to [contact]. [Response time and who performs deletions: KIIT to supply.]

**Children.** [Handling of users under 18: KIIT to decide.]

**Cookies.** One session cookie that keeps you signed in, and one anonymous analytics cookie. No advertising cookies.

**Changes.** We will post changes here with the date.

## Terms of use (draft)

1. **Using KNEST.** You may use the platform to explore programs and events and to apply. Give accurate information. Do not share your password, try to reach other people's data, or disrupt the service.
2. **Your content.** Applications and documents you submit remain yours. You allow KNEST staff to use them to assess your application and run the program [KIIT to confirm ownership and reuse terms].
3. **Accounts.** We may suspend an account that breaks these terms. [What happens to accounts at graduation: KIIT to decide.]
4. **Applications.** Submitting an application does not guarantee a place. Decisions are made by program staff [appeal route: KIIT to supply].
5. **Availability.** The service is provided as is during the pilot and may be interrupted for maintenance.
6. **Governing law and disputes.** [KIIT to supply.]
7. **Lab booking** is not part of this release and has its own rules (HD-16) when enabled.

## Approval record (to be completed by the institution, not by engineering)

| Item | Name and role | Date | Signature or reference |
|---|---|---|---|
| Privacy notice text approved | | | |
| Terms text approved | | | |
| Content approved for publication | | | |

The cutover preflight (`scripts/ops/cutover-preflight.sh`, gate G1) fails until an evidence file with `APPROVED-BY:` and `APPROVED-ON:` lines exists and no longer contains the words "DRAFT, NOT APPROVED".
