# KNEST delivery tracker

System of record for the R1-approved blueprint. Status vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `DEFERRED`.

**IMPLEMENTED is not VERIFIED.** A task is VERIFIED only when every closing check named for it in the blueprint (Part I / Part J) has passed and its evidence is in `EVIDENCE/`. Where the closing check needs a database, staging or a live environment that does not exist yet, the task stays IMPLEMENTED.

Branch: `delivery/p1-containment` (from `00181d4`). Nothing is pushed, deployed or merged.

## Phase 0

| Task | Status | Commit / evidence | Notes |
|---|---|---|---|
| D-00 live-exposure check | VERIFIED | `EVIDENCE/D-00-live-exposure.md` | A Vercel deployment is live at `knest-kiit.vercel.app`. Payload fails to initialise there (HTTP 500), so KN-02 was not exploitable at probe time. The fabricated `/blog` content is publicly served. **Owner action pending**: see the report. |
| D-01 tracker | IMPLEMENTED | this directory | |
| D-05 donor-branch map | IMPLEMENTED | `DONOR-MAP.md` | |
| D-06 contract traceability | IMPLEMENTED | `CONTRACT-TRACEABILITY.md` | Baseline status of all 53 modules, as at `00181d4`. |

## Phase 1 (C-01 ... C-08)

| Task | Status | Commit | Closing evidence | What is still unproven |
|---|---|---|---|---|
| C-03 lab-bookings lock + flag | IMPLEMENTED | `e95cef5` | Access policy tests for all 16 collections (mutation-checked: restoring `read: () => true` fails 2 tests); flag tests | Anonymous REST denial against a real Payload + DB (no DB available) |
| C-04 dev auth bypass removed | VERIFIED | `80fd8ad`, `35bf0ca` | `guards.test.ts`: null on `auth()` failure in development, production and test; Next control-flow errors re-thrown | |
| C-05 seed safety | IMPLEMENTED | `80fd8ad` | 13 policy tests; four seed scripts executed under unsafe settings and each refused (`phase1-gate-report` section 3) | "Existing admin hash unchanged after reseed" needs a database |
| C-08 redirect / timing / analytics | IMPLEMENTED | `9b53040` | `safeNext` table (18 malicious inputs), dummy hash shape + work test, allow-list + route tests (forged `application_accepted` rejected) | Timing measured on the real login path; limiter against a real DB |
| C-06 dependency upgrades | IMPLEMENTED | `899a65f` | `pnpm audit --prod` 4C/21H/23M/7L -> 0C/1H/1M/0L (`EVIDENCE/audit-after.md`); build, typecheck, tests pass | Golden-path E2E after the upgrade (needs staging); one high (no patch exists) accepted |
| C-07 media + unlock hardening | IMPLEMENTED | `afb0887` | Role-matrix and mime-type tests | Behaviour through the Payload admin UI |
| C-02 honesty containment | IMPLEMENTED | `35bf0ca` | 38 content-layer tests; repository-wide gate (failed on the real offenders before the fix); production smoke test with no DB shows no fabricated content | Visual check of every list page against an empty CMS (needs a DB); HD-04 sign-off of the remaining copy |
| C-01 lint harness | VERIFIED | `a1ff0b9` | `pnpm lint`: 0 errors, 28 warnings; `pnpm check` exit 0 | |

## Gate verdict

See `EVIDENCE/phase1-gate-report.md`.
