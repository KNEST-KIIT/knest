# Findings register (KN-01 ... KN-34, NF-01 ... NF-16)

Dispositions use the mandate vocabulary. `Delivery` uses the tracker vocabulary. Evidence for Phase 1 items is in `TRACKER.md` and `EVIDENCE/`. Anything not touched in Phase 1 is `NOT_STARTED` with its target phase from the blueprint.

| ID | Disposition | Delivery | Phase 1 result / remaining work |
|---|---|---|---|
| KN-01 Fabricated content | CONFIRMED_OPEN | VERIFIED (local) | Gone from every rendered page of the production build against an empty CMS; gate in the unit suite. **The live Vercel deployment still serves the invented content until redeployed** (`EVIDENCE/live-deployment-2026-10-08.md`). |
| KN-02 Public booker PII | CONFIRMED_OPEN | VERIFIED (local) | Anonymous and every non-lab role refused over real REST with real rows; hidden fields not probeable; the original code leaks (mutation test). **Latent on the live deployment**: Payload is failing there, so nothing was retrievable. |
| KN-03 Vulnerable dependencies | PARTIALLY_RESOLVED | IMPLEMENTED | 0 critical; 1 high + 1 moderate ignored by id (no patch; build/dev paths). Dependency regression suite passes; **document upload path unexercised (needs S3)**. |
| KN-04 No Payload migrations | CONFIRMED_OPEN | IMPLEMENTED | Payload baseline + Drizzle `lab_admin` migrations; empty-DB migrate and re-run verified locally; schema-drift check in the suite. **Not yet run in CI; no upgrade rehearsal on a populated database.** |
| KN-05 Email / storage config | CONFIRMED_OPEN | NOT_STARTED | P2 / F-03, F-06, F-07 |
| KN-06 Hosting contradiction | CONFIRMED_OPEN | NOT_STARTED | Live deployment is on Vercel; contract names AWS. Needs S-1 + ADR-001r + HD-22. |
| KN-07 Seed credentials | CONFIRMED_OPEN | VERIFIED (local) | Verified against a real database (no overwrite, production refused, opt-in reset only). |
| KN-08 Lab booking out of scope | CONFIRMED_OPEN | IMPLEMENTED | Containment verified (flag off renders none of the booking UI). The contracted rebuild is P3B; the interim code is still in the tree. |
| KN-09 Dev auth bypass | CONFIRMED_OPEN | VERIFIED | Guard tests in three environments. |
| KN-10 `isActive` not enforced | CONFIRMED_OPEN | NOT_STARTED | P3A / R-03 |
| KN-11 Forgeable analytics | CONFIRMED_OPEN | IMPLEMENTED | Endpoint verified (forged events never stored, flood dropped). The funnel redesign is P6. |
| KN-12 Program delete breaks applications | PARTIALLY_RESOLVED (lookup throws; the "delete guard" never existed) | NOT_STARTED | P3A / R-04 |
| KN-13 Race conditions | CONFIRMED_OPEN | IN_PROGRESS | Submit race fixed and verified (10 parallel submits -> 1). Answers/uploads/review/event capacity/booking races still open (R-05). |
| KN-14 Lost onboarding intent | CONFIRMED_OPEN | VERIFIED (local) | Real browser: sign-up with a return path lands on the application; failure shows the error and does not navigate. |
| KN-15 Google button always shown | CONFIRMED_OPEN | VERIFIED (local, disabled state) | Absent when unconfigured. The enabled state is untested without real Google credentials. |
| KN-16 Dead links / missing pages | CONFIRMED_OPEN | NOT_STARTED | Blog removed from the nav only. `/privacy`, `/terms`, contact anchors remain. |
| KN-17 Fake dashboard progress | CONFIRMED_OPEN | VERIFIED (local) | Both dashboards render without the invented progress. |
| KN-18 Unapproved claims | CONFIRMED_OPEN | IMPLEMENTED | No banned claim in any rendered page or source (gate + scan). **Needs HD-04 sign-off to close.** |
| KN-19 Accessibility | CONFIRMED_OPEN | NOT_STARTED | Only side effect: the offer section is now an `h2`. P4 / X-10 |
| KN-20 CI / lint / tests | CONFIRMED_OPEN | IMPLEMENTED | Lint, typecheck, unit, integration all pass locally in CI order. **The workflow has never run on GitHub.** |
| KN-21 Monitoring | CONFIRMED_OPEN | NOT_STARTED | Only the false "we've been told" copy was removed. P5 |
| KN-22a login timing | CONFIRMED_OPEN | VERIFIED (local) | Timing on the real login route within 0.6x-1.7x for known vs unknown e-mail. |
| KN-22b signup enumeration | CONFIRMED_OPEN | NOT_STARTED | P3A / R-08 |
| KN-22c spoofable rate-limit key, no per-account bucket | CONFIRMED_OPEN | NOT_STARTED | Needs the real topology (S-1). |
| KN-22d unthrottled verify / reset confirm | CONFIRMED_OPEN | NOT_STARTED | P3A / R-08 |
| KN-22e open redirect | CONFIRMED_OPEN | VERIFIED (local) | Real browser follows no hostile `next`; the original code does. |
| KN-22f upload buffering / `questionId` | CONFIRMED_OPEN | NOT_STARTED | P2 / F-06 |
| KN-22g Origin check | CONFIRMED_OPEN | NOT_STARTED | P3A / R-09 |
| KN-22h CSP / HSTS / Permissions-Policy | CONFIRMED_OPEN | NOT_STARTED | P5 / Q-05. Note: the Vercel platform currently adds HSTS. |
| KN-22i plaintext tokens | CONFIRMED_OPEN | NOT_STARTED | P3A / R-08 |
| KN-22j media write by any staff | CONFIRMED_OPEN | VERIFIED (local) | Role matrix over real REST. |
| KN-22k admin note unvalidated | CONFIRMED_OPEN | NOT_STARTED | P3A |
| KN-22l `'use server'` helpers trust `userId` | CONFIRMED_OPEN | NOT_STARTED | P3A / R-09 |
| KN-23 Connection pools | CONFIRMED_OPEN | NOT_STARTED | P2 / F-08 |
| KN-24 Design-system bypass | CONFIRMED_OPEN | NOT_STARTED | P4. 28 lint warnings are the starting list. |
| KN-25 Image weight / render-path tracking | CONFIRMED_OPEN | NOT_STARTED | P4 / P6 |
| KN-26 sitemap / robots / not-found | CONFIRMED_OPEN | NOT_STARTED | P4 / X-12 |
| KN-27 Hygiene | PARTIALLY_RESOLVED | IMPLEMENTED | `patch_seed.mjs` deleted; pnpm overrides moved to `pnpm-workspace.yaml`. README status and deploy sections still stale (F-12). |
| KN-28 `next-auth` beta / eslint 8 | PARTIALLY_RESOLVED | IMPLEMENTED | ESLint is on 9. `next-auth` stays on `5.0.0-beta.32` (ACCEPTED_RISK: no GA exists). |
| KN-29 Raw search text stored | CONFIRMED_OPEN | NOT_STARTED | P6 |
| KN-30 Indexes / N+1 | CONFIRMED_OPEN | NOT_STARTED | |
| KN-31 Submit validates presence only | CONFIRMED_OPEN | IN_PROGRESS | Submit-time re-validation verified. Draft creation on page view remains open. |
| KN-32 Mislabelled dashboard counts | CONFIRMED_OPEN | NOT_STARTED | P3A / R-14 |
| KN-33 Never staged | CONFIRMED_OPEN | NOT_STARTED | P7 |
| KN-34 Notification links / timeouts / deadlines | PARTIALLY_RESOLVED | NOT_STARTED | P2/P3A |
| NF-01 Transitive advisories | CONFIRMED_OPEN | IMPLEMENTED | Overrides for undici, fast-uri, dompurify, source-map-js, fast-copy. Two un-patchable remain (see KN-03). |
| NF-02 Internal fields publicly readable | CONFIRMED_OPEN | VERIFIED (local) | `metrics.source` absent from REST output and not probeable by filter. |
| NF-03 SVG / media | CONFIRMED_OPEN | VERIFIED (local) | SVG/HTML/XML rejected; non-content roles cannot create, patch or delete media. |
| NF-04 Infrastructure writes locked to a role that cannot exist | CONFIRMED_OPEN | VERIFIED (local) | Migration 0006; a `lab_admin` user can be stored; unit test ties code roles to the enum. |
| NF-05 ... NF-07, NF-09 ... NF-16 | CONFIRMED_OPEN / NOT_YET_VERIFIED | NOT_STARTED | See blueprint Part C3. |
| NF-08 No root `not-found` / `global-error` | CONFIRMED_OPEN | IMPLEMENTED | 404 page verified; `global-error` has no test. |
| NF-10 No audit row on submit | CONFIRMED_OPEN | NOT_STARTED | P3A / R-06 |
| NF-11 `roles.test.ts` omits `lab_admin` | CONFIRMED_OPEN | VERIFIED | `roles.test.ts` now covers every enum value. |

## Defects found and fixed while doing this work (not in the audit)

- `getSessionUser()` caught Next's own "this render is dynamic" signal, so pages that read the session could be prerendered as signed-out. It now re-throws Next control-flow errors (`35bf0ca`). Side effect: `/`, `/about`, `/ecosystem` are rendered per request.
- `/blog` was prerendered at build time, freezing whatever the CMS (or the invented fallback) held. It is now dynamic.
- The blog card read `category` and `readTime`, fields that exist only on the invented articles.
- `seedCms()` overwrote staff-edited homepage copy on every run.
- Payload's generated baseline migration does not create the `cms` schema, so migrating an empty database failed with `schema "cms" does not exist`; fixed by hand in the baseline.
- Payload's interactive dev-mode schema push hangs forever in a non-interactive run (a hard blocker for CI), which is why schema creation now goes through committed migrations.
- `NEXT_PUBLIC_SITE_URL` is inlined at build time, so the absolute links in e-mails carry the build machine's value, not the runtime one. Harmless if the production build sets it, but it must be set when building (F-03).
- The streamed pages answer HTTP 200 even when they then render not-found; tests assert on rendered content for that reason.

## Still open, found while testing

- **KN-22c**: the rate-limit key is the first `X-Forwarded-For` hop, which a caller controls; rotating it bypasses every limit. Documented by a test marked `it.fails` that flips to passing when fixed.
