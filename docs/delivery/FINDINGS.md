# Findings register (KN-01 ... KN-34, NF-01 ... NF-16)

Reconciled 2026-10-12 against the git log and CI of `codex/production-v1` at `b5ca498` (CI run 38171899823, success), plus the branch `agent/hardening`. The earlier version of this table was written on 2026-10-08 and had not been updated for the work of 2026-10-09 to 2026-10-11; that is what this pass corrects.

Vocabulary. `Disposition`: `CONFIRMED_OPEN` (still true), `PARTIALLY_RESOLVED`, `RESOLVED` (fixed in code), `ACCEPTED_RISK` (decided). `State` says how far it is proven:

- `VERIFIED (local+CI)`: a test that passes on the production build against a real PostgreSQL, in CI.
- `IMPLEMENTED`: built; evidence is thinner (unit test, stub, or reading) and the gap is named.
- `OPEN`: not done. `DEFERRED`: decided not to do now.

Nothing here is verified on staging or in production. No staging exists by decision (`DECISIONS-2026-10-09.md`); a password-gated preview runs on AWS (reported in `V1-DEPLOYMENT-REPORT.md`, not re-checked by this pass). Commit ids are in `git log`; test names are in `tests/integration/`.

| ID | Disposition | State | Current truth and what remains |
|---|---|---|---|
| KN-01 Fabricated content | RESOLVED | VERIFIED (local+CI) | Gone from every rendered page against an empty CMS; gate in the unit suite (`src/content-integrity.test.ts`). Production served only the maintenance page after containment (`aa725f4`), so the invented content is not served (reported). Approved real copy is still missing (HD-04). |
| KN-02 Public booker PII | RESOLVED | VERIFIED (local+CI) | The CMS lab-bookings collection is retired by migration; bookings live in `app` (`1427180`). |
| KN-03 Vulnerable dependencies | RESOLVED for fixable alerts | VERIFIED (CI gate) | `pnpm audit --prod --audit-level=moderate` is a CI step. Installed Next 16.4.0, nodemailer 10.0.16, undici 7.30.0, fast-uri 3.1.8, Payload 3.90.2 are all above their fixed versions; the 23 GitHub alerts are stale (`DEPENDENCY-TRIAGE.md`). Two advisories (braces, esbuild) accepted by id. |
| KN-04 No Payload migrations | RESOLVED | VERIFIED (local+CI) | Committed baseline; migrate-from-zero and drift check run in CI. **Not done:** upgrade rehearsal of the latest migrations on a populated database. |
| KN-05 Email / storage config | RESOLVED in code | IMPLEMENTED | SES and SMTP transports, durable outbox with retry, S3 storage with orphan reconciliation, validated production environment (`7798fe9`, `adc903b`). Exercised only against stubs; real SES and S3 untested. |
| KN-06 Hosting contradiction | DECIDED | IMPLEMENTED | AWS-native, one production environment (`AWS-NATIVE-ARCHITECTURE.md`). A preview exists on AWS (reported). Contract variation record (HD-22) still open. |
| KN-07 Seed credentials | RESOLVED | VERIFIED (local+CI) | `50-seeds.test.ts`. |
| KN-08 Lab booking out of scope | RESOLVED | VERIFIED (local+CI) | Rebuilt as a module behind `FEATURE_LAB_BOOKING` (off by default). Not enabled anywhere real until the lab policy (HD-16) is answered. |
| KN-09 Dev auth bypass | RESOLVED | VERIFIED | Guard tests in three environments; `getSessionUser` fails closed. |
| KN-10 `isActive` not enforced | RESOLVED | VERIFIED (local+CI) | `25-account-deactivation.test.ts`; sessions deleted on deactivation and role change; staff console screens exist (`4cc8fbb`). |
| KN-11 Forgeable analytics | RESOLVED | VERIFIED (local+CI) | `40-analytics.test.ts`. Table-derived counts shown beside recorded events (`5da08a8`). Funnel redesign not done. |
| KN-12 Program delete breaks applications | RESOLVED | VERIFIED (local+CI) | Lookup non-throwing; Payload refuses to delete a program with applications (`3ce052c`, `753028e`). |
| KN-13 Race conditions | RESOLVED for the listed paths | VERIFIED (local+CI) | Answers, uploads, submit, review transitions, event capacity (`26-concurrency`), last administrator (`24`), booking exclusion constraint (`34`). |
| KN-14 Lost onboarding intent | RESOLVED | VERIFIED (local+CI) | Real browser (`30-auth-and-redirects`). |
| KN-15 Google button always shown | RESOLVED | VERIFIED (disabled state) | The enabled state needs real Google credentials and is untested. |
| KN-16 Dead links / missing pages | PARTIALLY_RESOLVED | IMPLEMENTED | `/privacy`, `/terms`, blog detail, search, contact exist (`4cc8fbb`). Privacy and terms text is the "being finalised" placeholder (HD-06 unapproved). |
| KN-17 Fake dashboard progress | RESOLVED | VERIFIED (local+CI) | Both dashboards render real state. |
| KN-18 Unapproved claims | RESOLVED in code | IMPLEMENTED | Gate plus scan. Needs HD-04 sign-off to close. |
| KN-19 Accessibility | PARTIALLY_RESOLVED | IMPLEMENTED | axe-core across every public, member and staff screen at two widths, plus keyboard, skip link, labels, focus and reflow checks, in CI (`35-accessibility`). `agent/hardening` adds scans of the open menu, an error state and the slot picker. **No human or assistive-technology review has been done**; script in `docs/handover/ACCESSIBILITY-MANUAL-TEST.md`, source review in `ACCESSIBILITY-REVIEW.md`. |
| KN-20 CI / lint / tests | RESOLVED | VERIFIED | `.github/workflows/ci.yml`: static job (lint, typecheck, unit, audit, secret scan) and integration job. Green on `b5ca498`; the run before the fix (`b2bf9fe`) failed and was fixed by `acf04c8` (see `EVIDENCE/ci-runs.md`). Lint warnings remain (no errors). |
| KN-21 Monitoring | PARTIALLY_RESOLVED | IAC | Alarms and budget written as templates; reported deployed. No alarm recipient confirmed; no drill has shown an alarm reaches a person (`DRILLS.md`). |
| KN-22a login timing | RESOLVED | VERIFIED (local+CI) | Dummy hash comparison; timing test. |
| KN-22b signup enumeration | ACCEPTED_RISK | IMPLEMENTED | Success versus refusal is still distinguishable; bounded by Turnstile and 5 per hour. `SECURITY-REVIEW.md` S-09. Sign-in and reset are uniform. |
| KN-22c spoofable rate-limit key, no per-account bucket | RESOLVED | VERIFIED (local+CI) | Address from `CloudFront-Viewer-Address` only in production (`client-ip.ts`, origin secret required, `7798fe9`); per-account throttle on failed sign-ins (`99ba3a4`, `42-account-login-throttle`). The old `it.fails` marker is gone. |
| KN-22d unthrottled verify / reset confirm | RESOLVED | VERIFIED (local+CI) | `tokenConfirm` and `verifySend` limits per address and per e-mail. |
| KN-22e open redirect | RESOLVED | VERIFIED (local+CI) | `safeNext` plus real-browser test. |
| KN-22f upload buffering / `questionId` | RESOLVED | VERIFIED (local+CI) | Size checked before buffering, magic-number sniffing, question must be a file question (`27-document-upload`); `agent/hardening` restricts the extension in the object key. |
| KN-22g Origin check | RESOLVED | VERIFIED (local+CI) | Same-origin writes enforced in `src/proxy.ts` for every route (`edge-guard.ts`, `29-edge-controls`). `agent/hardening` also refuses a cross-site write with no Origin header (Sec-Fetch-Site). |
| KN-22h CSP / HSTS / Permissions-Policy | PARTIALLY_RESOLVED | IMPLEMENTED | App sends CSP, nosniff, frame, referrer, no-store on private paths; `agent/hardening` adds Permissions-Policy and COOP. HSTS is set by CloudFront (`infra/cfn/edge.yaml`), not the app. **CSP still allows `'unsafe-inline'` for script and style** (`SECURITY-REVIEW.md` S-01). Header behaviour at the real edge is not verified. |
| KN-22i plaintext tokens | RESOLVED | VERIFIED (local+CI) | Only a SHA-256 digest is stored; atomic consume (`c51da1f`, `28-token-hygiene`). Session tokens themselves remain stored in clear (S-10, Auth.js design). |
| KN-22j media write by any staff | RESOLVED | VERIFIED (local+CI) | `20-roles-and-media`. |
| KN-22k admin note unvalidated | RESOLVED | VERIFIED (local+CI) | Length limit tested (`26-concurrency`). |
| KN-22l `'use server'` helpers trust `userId` | RESOLVED | VERIFIED (local+CI) | Internal services are server-only; authority derives from the session (`1a79403`, `01-server-action-boundary`). |
| KN-23 Connection pools | PARTIALLY_RESOLVED | IMPLEMENTED | Single shared pool, `max: 10`, TLS verified in hosted production; a separate runtime role with least privilege exists (`adc903b`). No connection-count test under load (`DRILLS.md` D7 not run). |
| KN-24 Design-system bypass | CONFIRMED_OPEN | OPEN | Hardcoded values remain; hardcode lint is being wired in CI by CONTENT. |
| KN-25 Image weight / render-path tracking | CONFIRMED_OPEN | OPEN | No image pipeline or performance budget yet. |
| KN-26 sitemap / robots / not-found | RESOLVED | IMPLEMENTED | `sitemap.ts`, `robots.ts`, root not-found and global-error exist; noindex until `SITE_INDEXING=on`. |
| KN-27 Hygiene | RESOLVED | IMPLEMENTED | `patch_seed.mjs` deleted; overrides live in `pnpm-workspace.yaml`; README status and deployment sections reconciled on this pass. |
| KN-28 `next-auth` beta / eslint 8 | PARTIALLY_RESOLVED | IMPLEMENTED | ESLint 9. `next-auth` stays on `5.0.0-beta.32` (ACCEPTED_RISK: no GA exists). |
| KN-29 Raw search text stored | CONFIRMED_OPEN | OPEN | `src/app/(public)/search/page.tsx:23` still records the query text in analytics; no retention job. Privacy input for HD-06. |
| KN-30 Indexes / N+1 | NOT_YET_VERIFIED | OPEN | Not re-examined. |
| KN-31 Submit validates presence only | RESOLVED | VERIFIED (local+CI) | Submit re-validates against the frozen snapshot; starting an application is an explicit action (`2ee4a13`). |
| KN-32 Mislabelled dashboard counts | RESOLVED | IMPLEMENTED | Table-derived counts shown beside recorded events (`5da08a8`). |
| KN-33 Never staged | DEFERRED | DECIDED | No staging environment by owner decision; verification runs in CI, the S-1 spike, and a private production preview. |
| KN-34 Notification links / timeouts / deadlines | PARTIALLY_RESOLVED | IMPLEMENTED | Absolute links and IST dates (`258da21`). Deadlines and timeouts not re-examined. |
| NF-01 Transitive advisories | RESOLVED | VERIFIED (CI gate) | Overrides in `pnpm-workspace.yaml`. |
| NF-02 Internal fields publicly readable | RESOLVED | VERIFIED (local+CI) | `metrics.source` hidden. |
| NF-03 SVG / media | RESOLVED | VERIFIED (local+CI) | Raster only. |
| NF-04 `lab_admin` missing from the enum | RESOLVED | VERIFIED (local+CI) | Migration 0006. |
| NF-05 ... NF-07, NF-09, NF-12 ... NF-16 | NOT_YET_VERIFIED | OPEN | Not individually re-examined by this pass; see the forensic audit (`docs/audit/2026-10-08-forensic-audit.md`). |
| NF-08 No root `not-found` / `global-error` | RESOLVED | IMPLEMENTED | 404 page tested (`80-error-pages`). |
| NF-10 No audit row on submit | RESOLVED | VERIFIED (local+CI) | `application_submitted` row (`2ee4a13`). |
| NF-11 `roles.test.ts` omits `lab_admin` | RESOLVED | VERIFIED | Test covers every enum value. |

## New findings since the register was written

| ID | Severity | Finding | State |
|---|---|---|---|
| S-01 to S-14 | see file | `SECURITY-REVIEW.md`: ASVS review of the code. Fixed on `agent/hardening`: S-02 to S-07. Open: S-01, S-08 to S-14. | See that file |
| H-01 | Low | Staff opening an applicant document left no audit row | Fixed on `agent/hardening` (S-04) |
| H-02 | Info | The 23 Dependabot alerts are open although the lockfile is above every fixed version | Triaged, `DEPENDENCY-TRIAGE.md` |

## Defects found and fixed while doing this work (not in the audit)

- `getSessionUser()` caught Next's own "this render is dynamic" signal, so pages that read the session could be prerendered as signed-out. It now re-throws Next control-flow errors (`35bf0ca`). Side effect: `/`, `/about`, `/ecosystem` are rendered per request.
- `/blog` was prerendered at build time, freezing whatever the CMS (or the invented fallback) held. It is now dynamic.
- The blog card read `category` and `readTime`, fields that exist only on the invented articles.
- `seedCms()` overwrote staff-edited homepage copy on every run.
- Payload's generated baseline migration does not create the `cms` schema, so migrating an empty database failed with `schema "cms" does not exist`; fixed by hand in the baseline.
- Payload's interactive dev-mode schema push hangs forever in a non-interactive run (a hard blocker for CI), which is why schema creation now goes through committed migrations.
- `NEXT_PUBLIC_SITE_URL` is inlined at build time, so the absolute links in e-mails carried the build machine's value, not the runtime one (F-03; link construction later moved to a runtime `siteUrl()`, `258da21`).
- The streamed pages answer HTTP 200 even when they then render not-found; tests assert on rendered content for that reason.
- Event cards widened `/events` by 8 px at phone width (`8eb349b`).
- The CI run on `b2bf9fe` failed because the CMS audit test user lacked a staff role; fixed in `acf04c8`.

## Still open, found while testing

- **Preview address versus origin check.** `V1-DEPLOYMENT-REPORT.md` records that `SiteUrl` is still `https://kiitnest.com` on the preview, so same-origin writes from the CloudFront address are refused by the origin check. That is the control working, not a bug; set `SITE_URL` (or `ALLOWED_ORIGINS`) to the address in use.
- **`/admin` returns 404 for a visitor who is not signed in as staff.** By design (README, "One account, one login"); not a defect.
