# KNEST delivery tracker

System of record for the R1-approved blueprint. Status vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `DEFERRED`.

**IMPLEMENTED is not VERIFIED.** A task is VERIFIED only when every closing check named for it has passed and the evidence is in `EVIDENCE/`. "Verified" here means **verified locally**: on an ephemeral PostgreSQL 16, against the production build, in a real browser. It does not mean verified on staging or in production; neither exists. Per-task evidence and what each check does not cover: `EVIDENCE/phase1-verification-matrix.md`.

Branch: `delivery/p1-containment` (from `00181d4`). Nothing is pushed, deployed or merged. The CI workflow has never run on GitHub.

## Phase 0

| Task | Status | Evidence | Notes |
|---|---|---|---|
| D-00 live-exposure check | VERIFIED | `EVIDENCE/live-deployment-2026-10-08.md` | A Vercel deployment is live; Payload and Auth.js are failing on it; invented content is public; no PII retrievable. Owner action pending. |
| D-01 tracker | IMPLEMENTED | this directory | |
| D-05 donor-branch map | IMPLEMENTED | `DONOR-MAP.md` | |
| D-06 contract traceability | IMPLEMENTED | `CONTRACT-TRACEABILITY.md` | Contract status is UNVERIFIED until the document KIIT holds is supplied. |

## Phase 1

| Task | Status | Commits | Closing evidence | Not covered |
|---|---|---|---|---|
| C-01 lint harness | VERIFIED | `a1ff0b9` | `pnpm lint` 0 errors; CI-order pipeline passes | |
| C-02 honesty containment | VERIFIED (technical) | `35bf0ca` | Empty CMS served by the production build shows each honest empty state; 11 pages scanned for 20 invented strings; repository gate; 38 content-layer tests | **HD-04 copy sign-off** (institutional); screenshots/visual review |
| C-03 lab-bookings lock | VERIFIED | `e95cef5` | Real REST + real rows: anonymous and 5 staff roles + student refused, super_admin/lab_admin allowed; hidden fields not probeable by filter; **mutation test: the original code leaks the e-mail** | The live deployment is unchanged |
| C-04 dev auth bypass | VERIFIED | `80fd8ad`, `35bf0ca` | Guard tests in 3 environments | |
| C-05 seed safety | VERIFIED | `80fd8ad` | Against a real DB: default password allowed locally only; existing admin hash unchanged on re-run; reset only with the opt-in; production refused; staff-edited homepage copy preserved | |
| C-06 dependency upgrades | IMPLEMENTED | `899a65f` | Audit 0C, 1H + 1M both ignored by id; build; admin UI loads for 3 roles; sharp resize; nodemailer over SMTP; sign-up -> verify -> apply -> submit -> review -> audit -> notification | **Document upload** (needs S3, F-06); real SMTP/SES; interactive admin editing; staging |
| C-07 media + unlock | VERIFIED | `afb0887` | REST upload by every role; SVG/HTML/XML refused; non-content roles cannot patch or delete; unlock refused | |
| C-08 redirect / timing / analytics | VERIFIED | `9b53040` | Real-browser redirect tests (mutation test: original follows `//evil`); timing within 0.6x-1.7x of a known account; forged events never stored; flood dropped | **KN-22c open**: the limiter's key is spoofable (documented `it.fails`) |

## Next-batch items (done on this branch; authorised in the 2026-10-08 message)

| Item | Status | Commits | Notes |
|---|---|---|---|
| CI foundation | IMPLEMENTED | `858a8e7` | Workflow valid YAML; its commands pass locally in the same order; **has not run on GitHub** (needs a push). |
| Integration harness | VERIFIED | `0ba85a7` | Ephemeral PG16, migrate-from-zero, production build, stub SMTP, real browser |
| KN-04 migrations | IMPLEMENTED | `e604737`, `0a0e187` | Payload baseline + Drizzle `lab_admin`; migrate-from-zero and re-run verified locally; drift check in the suite. **Upgrade rehearsal on a populated DB not done.** |
| NF-04 / NF-11 `lab_admin` | VERIFIED | `0a0e187` | |
| KN-14 return path | VERIFIED | `d58d0af` | Real browser |
| KN-15 Google button | VERIFIED (disabled state) | `d58d0af` | The enabled state needs real Google credentials and is untested |
| KN-31 submit validation / KN-13 submit race | VERIFIED (these two parts) | `a18121a` | Draft-on-view and the other races remain open |
| NF-08 not-found / global-error | IMPLEMENTED | `0b90153` | 404 verified; `global-error` is not exercised by any test |

## Standing gates

| Item | Status |
|---|---|
| A. Commercial document KIIT received | **BLOCKED on the owner** (Gmail needs re-authentication; supply the document) |
| B. S-1 hosting/memory gate | Specified (`S-1-SPEC.md`); not started; not authorised |
| C. QR / offline threat model | Draft (`LAB-ATTENDANCE-THREAT-MODEL.md`); LB-07, LB-08, LB-10 blocked until validated |
| D. Pilot-A (applications) and Pilot-B (labs) | Separate. Pilot-A needs P2, P3A, P4a, P5-core, P7-A; Pilot-B additionally P3B, HD-16 and the threat-model sign-off |
| E. Tests do not equal "secure / complete / production-ready" | Applied: see "Not covered" column |
