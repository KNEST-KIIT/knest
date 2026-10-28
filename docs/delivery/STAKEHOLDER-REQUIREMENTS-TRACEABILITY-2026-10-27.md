# Stakeholder and release requirements: traceability to routes, files and tests

Written 2026-10-27, revised 2026-10-28. Covers the two stakeholder files, the retention decision, the malware-protection brief, and the legal text. Each row says where the requirement lives (route or file), how it is proved (test), or, when it cannot be satisfied in this repository, exactly what is handed off and what is still needed from the owner. Nothing here has been deployed, pushed or run in AWS.

Status words: **IMPLEMENTED** (in this repository, with a test) · **GUARDED** (cannot occur in this repository; a test stops it appearing) · **EXTERNAL** (belongs to another website; handoff text given) · **OWNER FACT** (cannot be completed without information only the owner has).

## 0. Sources, and how they were treated

| Source | Path | SHA-256 | Bytes |
|---|---|---|---|
| `KNEST Website changes.docx` | `C:\Users\anand\Documents\Codex\2026-10-23\referenced-chatgpt-conversation-this-is-an\outputs\` | `cd1ace98b1a8a7e8594f4c63e4ee8e875b3df0acdea39ffa88bc4018df99499e` | 17,462 |
| `02_Terms_and_Conditions.docx` | same folder | `1a3ab6b961f06bc6ae9510216f4a412131dd9d1543e1cd318076a5f1a8ce5406` | 36,645 |

Hashes were recomputed on 2026-10-28 and match the values pinned in `src/content/siel.ts` and `src/content/policies.test.ts`. Both files were opened as archives, their text extracted as plain data, and treated as product and legal requirements. Nothing in them was executed, and no link, field or macro in them was followed. The release brief that accompanied them (2026-10-27) also fixes: retention is **five years then backup**, the **16 February 2027** deadline is outdated, cohort start is **13 July 2027**, the school name and address change to **SIEL / siel.kiit.ac.in**, and a real brochure or an honest unavailable state is required.

## 1. `KNEST Website changes.docx`: every line

The document lists changes to pages of the school's own website (the one at `sld.kiit.ac.in`, moving to `siel.kiit.ac.in`). This repository is the KNEST platform at kiitnest.com. Before this work its only contact with that website was two links to `https://sld.kiit.ac.in/mba` on `/about`, and it had no brochure call to action, no admissions panel, no Vice-Chancellor or Dean message, no learner stories and no "Learn from leaders" section (checked in `src/` on 2026-10-28; none of the quoted phrases exist here). Rows are therefore split between what this repository can and must do and what belongs to the other site.

| # | Line in the document | Status | Where in this repository | Proof |
|---|---|---|---|---|
| W1 | "Change the subdomain from sld.kiit.ac.in to siel.kiit.ac.in" | **IMPLEMENTED** | `src/content/siel.ts` (`SIEL.origin`, `SIEL.programmeUrl`); both links on `/about` are built from it, open in a new tab with `rel="noopener noreferrer"` | `src/content/siel.test.ts` (16), `src/content/stakeholder-facts.test.ts` (no `sld.kiit.ac.in` anywhere in `src/`), `tests/integration/48-stakeholder-content.test.ts` "links every reference to siel.kiit.ac.in over https" |
| W2 | "Change from SLD (School of Leadership) to SIEL (School of Innovation & Entrepreneurial Leadership)" | **IMPLEMENTED** where this repository names the school; **GUARDED** elsewhere | `/about` names the school from `SIEL.name` = "School of Innovation & Entrepreneurial Leadership" (`src/app/(public)/about/page.tsx`, `siel-admissions.tsx`) | `siel.test.ts` ("uses the full school name"), `stakeholder-facts.test.ts` ("never calls the school the School of Leadership, or SLD"), `48` "leaves no trace of the old address, the old school name, or the SLD abbreviation" |
| W2.H1 | Homepage, Leadership Messages: "Dean, School of Leadership" | **EXTERNAL** | none; no such block exists here | handoff list in section 6 |
| W2.H2 | Homepage, "Learn from leaders, not just lecturers": "At the School of Leadership, you learn from people who do the work every day…" | **EXTERNAL** | none | section 6 |
| W2.H3 | Homepage, "A vibrant campus in Bhubaneswar": "The School of Leadership is part of KIIT Deemed to be University…" | **EXTERNAL** | none | section 6 |
| W2.H4 | Homepage, "Stories from our learners": "Here's how learners from the School of Leadership are using what they learned…" | **EXTERNAL** | none | section 6 |
| W2.H5 | Homepage, Learner Stories, Sangeeta testimonial: repeated introductory quote mentioning "School of Leadership" | **EXTERNAL** | none | section 6 |
| W2.A1 | About page: Dean's designation "SLD" | **EXTERNAL** | none (this repository's `/about` has no Dean block) | section 6 |
| W2.A2 | About, Message from Founder, first paragraph: "I welcome you to the School of Leadership." | **EXTERNAL** | none | section 6 |
| W2.A3 | …second paragraph, second line: "The School of Leadership represents…" | **EXTERNAL** | none | section 6 |
| W2.A4 | …last paragraph: "As you embark on your own journey at the School of Leadership…" | **EXTERNAL** | none | section 6 |
| W2.V1 | Vice-Chancellor's Message, first paragraph: "Welcome to the School of Leadership at KIIT Deemed to be University!" | **EXTERNAL** | none | section 6 |
| W2.V2 | …first paragraph, fourth line: "The School of Leadership stands…" | **EXTERNAL** | none | section 6 |
| W2.V3 | …first paragraph, second line from the end: "School of Leadership" | **EXTERNAL** | none | section 6 |
| W2.V4 | …second paragraph, 13th line: "At the School of Leadership, we strive to…" | **EXTERNAL** | none | section 6 |
| W2.V5 | …second paragraph, second line from the end: "Welcome to the School of Leadership—where…" | **EXTERNAL** | none | section 6 |
| W2.C1 | Message from CEO, KIIT-TBI, ninth line: "Through our close collaboration with the School of Leadership…" | **EXTERNAL** | none | section 6 |
| W2.D1 | Message from Dean, main title and designation: "Dr. Pinaki Nandan Pattnaik – Dean, School of Leadership" | **EXTERNAL** | none | section 6 (the name is unchanged; only the designation changes) |
| W2.D2 | Message from Dean, last line, name and designation: "Dean, School of Leadership" | **EXTERNAL** | none | section 6 |
| W3.1 | Admission page: remove the "Request a Brochure by Email" call to action at the bottom, because the brochure is already downloadable in the topmost call to action | **GUARDED** here, **EXTERNAL** on the school's page | This repository never had that call to action (base commit `27534a3` has none). The admissions panel on `/about` (`siel-admissions.tsx`) has at most **one** brochure call to action, the download at its top, and nothing below repeats it | `stakeholder-facts.test.ts` ("no second brochure call to action asking for the brochure by email"), `48` "offers exactly one brochure call to action at most, and says so honestly when there is no brochure" |
| W3.2 | Admissions at a Glance, Cohort Start: 13 July 2027 | **IMPLEMENTED** | `SIEL.cohortStart = '2027-07-13'`, rendered on `/about` as `<time datetime="2027-07-13">13 July 2027</time>` | `siel.test.ts` "starts the cohort on 13 July 2027", `48` "states the cohort start of 13 July 2027 as a machine-readable date" |
| W3.3 | Admissions at a Glance, Application Deadline: "Outdated date: 16 February 2027" | **IMPLEMENTED** (not published) · **OWNER FACT** (the new date) | `SIEL.applicationDeadline = null`; `/about` shows "Awaiting confirmation" and "The date will be shown here once SIEL confirms it" (`applicationDeadlineState()`); a date appears only when set to a well-formed ISO date from written confirmation | `siel.test.ts` ("is awaiting confirmation…", "shows a deadline only when a well-formed confirmed date is supplied"), `stakeholder-facts.test.ts` ("does not publish 16 February 2027", any common spelling), `48` "does not publish the outdated 16 February 2027 deadline; it says the date is awaiting confirmation" |
| W3.4 | "No brochure in the link" | **IMPLEMENTED** (honest unavailable state) · **OWNER FACT** (the brochure) | `SIEL.brochureUrl = null`; `/about` says "The brochure is not available yet. It will be linked here once it is published." and links nothing; `brochureLink()` accepts only an `https` URL or a PDF served from this site | `siel.test.ts` ("is unavailable until a real file or address is supplied", "accepts only an https address or a PDF served from this site", and nine refused forms), `48` brochure test |

**Owner facts that close this section:** (1) the confirmed application deadline for the 13 July 2027 cohort; (2) the brochure file (a PDF to place under `public/`) or its public address. Setting either is a one-line change in `src/content/siel.ts` and the tests already cover both states.

## 2. `02_Terms_and_Conditions.docx`: every section

Published at **`/terms`** as "KIITNEST Terms and Conditions", policy version **27 October 2026**, from `src/content/policies.ts` (`POLICIES.terms`), rendered by `src/components/content/policy-document.tsx` with numbered sections, a contents list that links to each, and "Policy version: …". The earlier mentorship and facility terms, which previously occupied `/terms`, are unchanged at **`/terms/facilities`** and reachable from the policy navigation. The footer (`site-footer.tsx`), the sign-up notice (`signup-form.tsx`, "Terms and Conditions" link) and the sitemap (`sitemap.ts`) point to `/terms`.

| Source § | Published heading | Paragraphs | SHA-256 of the section text (first 16 hex) pinned in `policies.test.ts` |
|---|---|---|---|
| 1 | Acceptance and scope | 2 | `d2be2b94bb21ff8a` |
| 2 | Platform operator and contact | 1 | `9746aa88644a1069` |
| 3 | Accounts and eligibility (A1) | 4 | `4d93679542bf6320` |
| 4 | Acceptable use | 2 | `be9b979746878c65` |
| 5 | Applications and submissions | 2 | `a867a07cf4cc35b5` |
| 6 | Incubation, mentoring and funding | 3 | `a28e622bbceaf7e4` |
| 7 | Bookings, attendance and facilities | 3 | `daecd4fcaf336723` |
| 8 | User content and permissions | 4 | `027ae5d52fa8c7de` |
| 9 | Intellectual property | 3 | `1c823c35a9a2d2ea` |
| 10 | Third-party links and services | 1 | `bc20a67c7beea6dd` |
| 11 | Suspension and termination | 2 | `0141ae991c47de48` |
| 12 | Availability and disclaimers | 1 | `62fa1ad2fb4bc097` |
| 13 | Liability and indemnity | 4 | `1aa4661e53922839` |
| 14 | Changes, governing law and disputes | 1 | `da2001741b79470e` |
| 15 | Contact | 1 | `c7294f87d4326113` |

Total 15 sections, 34 paragraphs. The full 64-character hashes are in `src/content/policies.test.ts`; each section has its own test ("section N … is reproduced word for word"), so a changed word, dropped paragraph or reordered section fails. Rendering, order, ids and contents links: `tests/integration/48-stakeholder-content.test.ts` (4 tests for `/terms`, plus "sitemap lists both terms documents"). Route availability and the title: `tests/integration/31-public-pages.test.ts` (`/terms`, `/terms/facilities`). Desktop and phone accessibility scans: `tests/integration/35-accessibility.test.ts`.

**Editorial adjustments (the only departures from the source, each pinned by a test):**

- **A1.** The source's section 2 holds two groups: paragraph 1 is the operator and contact notice; paragraphs 2 to 5 concern registration, eligibility and account credentials. The source has no heading 3, so the second group is published under the engineering-supplied heading "Accounts and eligibility". This keeps the source numbering of sections 4 to 15 intact. *Needs an editor's confirmation of the heading wording.*
- **A2.** The last paragraph of that group ends mid-sentence in the source ("…will be published on KIITNEST "). A full stop is added; nothing else.
- **A3.** Leading and trailing whitespace of each paragraph is trimmed.
- **A4.** Two no-break spaces (U+00A0), both in the repeated address, become ordinary spaces. They are invisible; no wording changes.

Everything else is reproduced character for character, including the source's spelling and punctuation (for example "Kalinga Institute of Industrial technology"); an editor may wish to correct such things in the source and re-supply the file, and the pins will then be updated deliberately.

**Not supplied, therefore not invented:** section 14 carries no governing law, jurisdiction or venue; the test asserts none is present. **OWNER FACT: the governing law and the courts or arbitration venue.**

**Related change to the privacy policy:** `/privacy` "Retention and deletion" now reads five years then transfer to an approved backup and archive (section 3), and its version label moved from 17 to **27 October 2026** because the text changed that day. The disclaimer and the facility terms are unchanged and keep 17 October 2026. Tests: `policies.test.ts` ("dates the privacy policy from the day its retention text changed…"), `48` "is dated from the day that wording went on the site".

## 3. Retention: five years, then backup

| Requirement | Where | Proof |
|---|---|---|
| Published wording is five years then transfer to an approved backup and archive; no ten-year language in any published document | `src/content/policies.ts` `POLICIES.privacy` "Retention and deletion" (4 paragraphs) | `policies.test.ts` ("states five years followed by transfer…", "no longer contains any ten-year retention language in any published document"), `48` "says five years, then transfer to an approved backup and archive, with no ten-year wording", `infra/cfn/malware-protection.test.ts` "no longer mentions a ten-year policy anywhere" |
| Application logs kept five years | `infra/cfn/app.yaml` `LogRetentionDays` default 1827 (was 7), `Retain` on stack deletion | `malware-protection.test.ts` "keeps application logs five years by default…", `retention.test.ts` |
| Applicant documents kept five years, then archived, never deleted | clean bucket lifecycle: `archive-after-five-years` → Deep Archive at `ArchiveDocumentsAfterDays` (1827); no `Expiration`; superseded versions 90 days; `TransitionDefaultMinimumObjectSize: varies_by_storage_class` so files under 128 KB are archived too | `malware-protection.test.ts` ("keeps documents five years and then moves them to the archive tier, without ever deleting them", "archives small files too…", "lets the disposable S-1 variant expire everything quickly…") |
| Operator can measure it | `scripts/ops/retention-evidence.mjs` (five-year floor, archive-rule recognition, small-file gap, never reads content); operator policy allows each call it makes | `infra/cfn/retention.test.ts` (23), `infra/iam/iam-policies.test.ts` "lets the retention evidence script make every call it makes" |
| Delivery documents agree | `RETENTION-ASSURANCE-2026-10-17.md` (rewritten), `POLICY-ACCEPTANCE-2026-10-17.md`, `HD-06-PRIVACY-INPUTS.md`, `CONTINUATION-2026-10-17.md` (marked superseded, history kept), `AWS-DEPLOYMENT-COST-PLAN-2026-10-27.md` §5-§6, `COMMERCIAL-MODULE-INVENTORY-2026-10-27.md` | review; `grep` for ten-year wording finds only the tests that forbid it and the superseded-history notes |

**Found and fixed while tracing this (2026-10-28):** (a) S3 does not archive objects under 128 KB by default, so small applicant files would have stayed in S3 Standard past five years; (b) the draft operator policy listed the plural `cloudformation:DescribeStackResources` but the evidence script needs the singular `DescribeStackResource`, so it would have failed under the scoped role; (c) the earlier cost plan proposed *expiring* records at day 1,827, which contradicts "then backup".

**OWNER FACTS:** the approved archive destination (the in-account Deep Archive rule is a proposal); the retention clock (creation, last activity or decision); who may retrieve archived records and under what legal-hold procedure; whether and how logs must also be archived before they expire from CloudWatch at day 1,827 (no export pipeline exists); whether a replaced or removed *draft* file counts as an "uploaded document" (today it is kept recoverable for 90 days and then permanently removed); and a rehearsed restore.

## 4. Fail-closed malware protection: brief to control to test

Design, limits and costs: [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md). The pipeline is proven locally against test doubles and **not yet in AWS**; the doubles are never presented as protection.

| Requirement in the brief | Control | Proof |
|---|---|---|
| Isolated, non-public, versioned S3 quarantine | `QuarantineBucket`: Block Public Access, `BucketOwnerEnforced`, TLS-only, versioned, KMS | `malware-protection.test.ts` (8 quarantine tests) |
| Unreadable until scanned clean | bucket policy denies `GetObject(Version)` unless the version's tag is `NO_THREATS_FOUND` (GuardDuty's role exempt); only GuardDuty may write tags; SSE-C uploads denied | same file; `27` "refuses every read while pending" |
| GuardDuty Malware Protection | `AWS::GuardDuty::MalwareProtectionPlan` on the quarantine bucket, tagging on, own role trusted only by the service | `malware-protection.test.ts` (3 plan tests); hosted drill (Phase 2) |
| EventBridge to the app | `ScanResultRule` → SQS (SSE, 14-day retention, dead-letter queue); only the rule may send | `malware-protection.test.ts` (results tests) |
| Exact key and version binding | verdict matched on bucket + key + versionId, then ETag, scan tag, size, SHA-256; clean copy made from that version with checksum proof | `scan-processor.test.ts` (42: "does nothing for another version of the same key", "…another key", "fails the document closed when the verdict names a different ETag", tag/size/ETag/checksum conflicts), `27` "ignores a verdict for a different version of the same key, then accepts the right one" |
| Database-owned scan state | `application_documents.scan_status`, compare-and-set, CHECK constraints (`clean` needs version, clean copy, result, event id, time) | `27` "cannot mark a document clean without a bound version, a clean copy, GuardDuty's result and the event that said so" |
| HTTP 423 while pending | `document-response.ts`; submit refuses 423 / 422 | `27` "holds the submission with 423 while a file is waiting, and releases it once the verdict is clean", "refuses every read while pending" |
| Idempotent processing | compare-and-set from `pending`; replays and duplicates are acknowledged and change nothing; lost race withdraws the orphan copy | `scan-processor.test.ts` ("replays and duplicates change nothing", 6 tests), `27` "treats three deliveries of the same event as one: a single clean copy, no change on replay" |
| Skipped, unscannable and error results rejected | `decideVerdict`: clean for one combination only; `UNSUPPORTED` → `unscannable`; everything else, including values AWS adds later → `scan_error` | `scan-verdict.test.ts` (36), `scan-processor.test.ts` ("every non-clean verdict rejects, tells the applicant and promotes nothing", 7 tests), `27` (three rejection kinds + replace/remove) |
| Separate clean storage | `DocumentsBucket`; promotion by version-pinned copy | `documents.test.ts` (22), `27` "promotes exactly the scanned version" |
| KMS | one customer-managed rotating key; key-policy deny for all but the app role and GuardDuty's role | `malware-protection.test.ts` ("encryption key" 2 tests) |
| Least privilege | app, scan and operator roles; operator cannot read objects, tag, receive messages or use the key | `malware-protection.test.ts` ("what the application host may do", 4 tests), `iam-policies.test.ts` (10) |
| Lifecycle cleanup | quarantine 14 days / 1 day (S-1); noncurrent 1 day; aborted uploads; clean: superseded 90 days, archive at five years | `malware-protection.test.ts` ("cleans itself up…", documents-bucket tests) |
| Alarms | 7 CloudWatch alarms + 2 EventBridge rules to the alert topic | `malware-protection.test.ts` (alarms, 11 tests) |
| Cost controls | volume alarm (`ScanVolumeAlarmBytesPerDay`), 10 MB limit, one plan, 14-day quarantine, no detector | `malware-protection.test.ts` "ScanVolumeAlarm…"; cost plan §3 and §5 |
| Fail closed when unconfigured | server refuses to start without the four settings; retired `MALWARE_SCANNER_URL` is reported; CI starts a container without them and requires refusal | `env.test.ts` (19), `scan-config.test.ts` (7), `.github/workflows/ci.yml` job `image` |
| A retry never outlives the queue's patience | worker doubles the delay per receive; template `maxReceiveCount` 12 ≥ needed + 2 | `scan-retry.test.ts` (11), `scan-worker.test.ts`, `malware-protection.test.ts` "lets a message live through the longest wait…" |
| Never present a test stub as protection | stand-ins live under `tests/support/` and say so in their headers; stub endpoints are refused for a hosted `SITE_URL`; the architecture document states the limit first | `env.test.ts` (hosted production refuses `S3_ENDPOINT` / `SQS_ENDPOINT` / http queue), architecture §2 |
| Real detection | hosted drill puts EICAR and a benign PDF, checks eight things, defaults to a dry run | `infra/verify/malware-drill.test.ts` (19: pass/fail logic, plan, wrapper); **the drill itself is Phase 2** |

### Old scanner assertions → their replacements

The previous design (a synchronous HTTP scanner called before storing) and its tests were removed in commit `acd176e`. Nothing was weakened silently; each old assertion either moved or no longer applies, as follows.

| Old assertion (`malware-scan.test.ts` / old `27`) | Now |
|---|---|
| strict positive verdict required; `{}`, unknown schema, HTTP 500, malformed JSON, oversize body, timeout all fail closed | `scan-verdict.test.ts` (strict parse; clean only for COMPLETED + NO_THREATS_FOUND; unknown or malformed → rejected) and `scan-processor.test.ts` (unusable events are never acknowledged) |
| "rejects when threat string is present even if clean claimed true" | `scan-verdict.test.ts` (a threat anywhere in the result is `infected`) |
| fails closed in production if the scanner URL is absent | `env.test.ts` (each of the four settings missing → refuse), `scan-config.test.ts`, CI container-refusal step |
| quarantined file written with metadata and hash | `documents.test.ts` (quarantine put with SHA-256 and version id), `27` "stores the bytes in quarantine only, bound to the exact version" |
| local heuristics: EICAR, disguised ELF/PE, weaponised PDF launch, VBA macro | **No longer done by this application.** Detection is GuardDuty's. EICAR is checked end to end by the hosted drill; the local simulator only decides verdicts from marker strings so the application's logic can be exercised. Local type checks that remain: allow-list and magic-byte sniffing (`27` "refuses a file whose bytes are not what its type claims") |
| "refuses an uploaded document containing malware/EICAR signature and quarantines it" | `27` "EICAR (THREATS_FOUND) ends as infected: nothing reaches clean storage, nothing is served, the applicant is told" |

## 5. 53-module matrix changes

Full matrix: [COMMERCIAL-MODULE-INVENTORY-2026-10-27.md](COMMERCIAL-MODULE-INVENTORY-2026-10-27.md) (revised 2026-10-28; counts regenerated from the repository: 54 pages, 53 route handlers, 118 test files: 81 unit and 37 integration).

| Module | Before | After |
|---|---|---|
| 34 Document handling | CODE COMPLETE (Hosted scanner unproved); synchronous scanner client | **CODE COMPLETE (Hosted proof pending Phase 2)**; quarantine → GuardDuty → clean pipeline |
| 42 Upload safety | VERIFIED (Pass) | **VERIFIED locally (Hosted detection pending)** |
| 43 Secrets, encryption & audit | CODE COMPLETE (Pending AWS IAM role) | same status, scope widened: document key, key-policy deny, TLS-only policies, operator drafts |
| 46 Amazon S3 & CloudFront | EDGE ACTIVE (Storage pending app stack) | same status; quarantine and clean buckets, lifecycle and archive described |

All other module rows are unchanged. Modules that depend on infrastructure that has not been deployed remain "specified" or "code complete" and are not claimed as live.

## 6. Handoff for the school's own website (EXTERNAL rows)

Apply on the school's website (`sld.kiit.ac.in`, moving to `siel.kiit.ac.in`), not in this repository. In every place below, replace "School of Leadership" with "School of Innovation & Entrepreneurial Leadership", and "SLD" with "SIEL"; do not change any person's name.

- Homepage: Leadership Messages ("Dean, School of Leadership"); "Learn from leaders, not just lecturers"; "A vibrant campus in Bhubaneswar"; "Stories from our learners"; the Sangeeta testimonial's repeated introductory quote.
- About page: the Dean's designation (SLD → SIEL); Message from Founder (first paragraph, second paragraph second line, last paragraph).
- Vice-Chancellor's Message: first paragraph (opening sentence, fourth line, second line from the end); second paragraph (13th line, second line from the end).
- Message from CEO, KIIT-TBI: ninth line.
- Message from Dean: main title and designation; last line.
- Admission page: remove the bottom "Request a Brochure by Email" call to action; cohort start 13 July 2027; replace the outdated application deadline (16 February 2027) with the confirmed date or "awaiting confirmation"; put the real brochure behind the top call to action.
- Subdomain: serve the school's site at `siel.kiit.ac.in`; consider a permanent redirect from `sld.kiit.ac.in` (a KIIT IT decision).

## 7. Owner facts still needed (consolidated)

1. Confirmed **application deadline** for the 13 July 2027 cohort (section 1).
2. The **brochure** file or public address (section 1).
3. **Governing law and venue** for the Terms and Conditions (section 2).
4. Confirmation of the **heading "Accounts and eligibility"** (A1) and any source corrections the editor wants.
5. The **approved archive destination**, retention clock, retrieval and legal-hold procedure, and whether logs must be archived (section 3).
6. The Mumbai **GuardDuty price** (published only for US East at the time of checking), observed at first deployment.
7. Items that predate this work and are tracked elsewhere: named go-live approver, public content approval, SES production access, Cloudflare Turnstile and Google OAuth credentials (`APPROVALS-REQUEST.md`, `S-1-APPROVAL-PACKET.md`).
