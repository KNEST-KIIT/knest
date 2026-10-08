# Findings register (KN-01 ... KN-34, NF-01 ... NF-16)

Dispositions use the mandate vocabulary. `Delivery` uses the tracker vocabulary. Evidence for Phase 1 items is in `TRACKER.md` and `EVIDENCE/`. Anything not touched in Phase 1 is `NOT_STARTED` with its target phase from the blueprint.

| ID | Disposition | Delivery | Phase 1 result / remaining work |
|---|---|---|---|
| KN-01 Fabricated content | CONFIRMED_OPEN | IMPLEMENTED | Code fixed and gated by tests. **The live Vercel deployment still serves fabricated `/blog` content until redeployed** (D-00). |
| KN-02 Public booker PII | CONFIRMED_OPEN | IMPLEMENTED | Read restricted to `lab_admin`/`super_admin`; identity fields have field-level access. Latent on the live deployment (Payload not initialising). |
| KN-03 Vulnerable dependencies | PARTIALLY_RESOLVED | IMPLEMENTED | 0 critical, 1 high, 1 moderate remain: `braces` (no patch exists; `sass -> chokidar` file watching) and `esbuild` (dev server, via drizzle-kit). Both ACCEPTED_RISK. |
| KN-04 No Payload migrations | CONFIRMED_OPEN | NOT_STARTED | P2 / F-04 |
| KN-05 Email / storage config | CONFIRMED_OPEN | NOT_STARTED | P2 / F-03, F-06, F-07 |
| KN-06 Hosting contradiction | CONFIRMED_OPEN | NOT_STARTED | Live deployment is on Vercel; contract names AWS. Needs S-1 + ADR-001r + HD-22. |
| KN-07 Seed credentials | CONFIRMED_OPEN | IMPLEMENTED | Policy module + guards; D-00 owner answer: no shared DB was seeded. |
| KN-08 Lab booking out of scope | CONFIRMED_OPEN | IMPLEMENTED | Containment only (flag default off, dev fake-success removed). Contracted rebuild is P3B. |
| KN-09 Dev auth bypass | CONFIRMED_OPEN | VERIFIED | Removed; fails closed. |
| KN-10 `isActive` not enforced | CONFIRMED_OPEN | NOT_STARTED | P3A / R-03 |
| KN-11 Forgeable analytics | CONFIRMED_OPEN | IMPLEMENTED | Endpoint locked (allow-list, bounds, rate limit). Funnel redesign is P6. |
| KN-12 Program delete breaks applications | PARTIALLY_RESOLVED (lookup throws; the "delete guard" never existed) | NOT_STARTED | P3A / R-04 |
| KN-13 Race conditions | CONFIRMED_OPEN | NOT_STARTED | P3A / R-05 |
| KN-14 Lost onboarding intent | CONFIRMED_OPEN | NOT_STARTED | P3A / R-01 |
| KN-15 Google button always shown | CONFIRMED_OPEN | NOT_STARTED | Lint now reports the unused `googleEnabled` prop. P3A / R-02 |
| KN-16 Dead links / missing pages | CONFIRMED_OPEN | NOT_STARTED | Blog removed from the nav only. `/privacy`, `/terms`, contact anchors remain. |
| KN-17 Fake dashboard progress | CONFIRMED_OPEN | IMPLEMENTED | Removed from both dashboards. |
| KN-18 Unapproved claims | CONFIRMED_OPEN | IMPLEMENTED | Unsupported claims removed; remaining copy follows the official brochure or CONTENT_SPEC. HD-04 sign-off still required. The named contact on `/about` is from the brochure and was kept. |
| KN-19 Accessibility | CONFIRMED_OPEN | NOT_STARTED | Only side effect: the offer section is now an `h2`. P4 / X-10 |
| KN-20 CI / lint / tests | CONFIRMED_OPEN | IMPLEMENTED | Lint works, 173 tests. **No CI yet** (F-10). |
| KN-21 Monitoring | CONFIRMED_OPEN | NOT_STARTED | Only the false "we've been told" copy was removed. P5 |
| KN-22a login timing | CONFIRMED_OPEN | IMPLEMENTED | Valid dummy hash. |
| KN-22b signup enumeration | CONFIRMED_OPEN | NOT_STARTED | P3A / R-08 |
| KN-22c spoofable rate-limit key, no per-account bucket | CONFIRMED_OPEN | NOT_STARTED | Needs the real topology (S-1). |
| KN-22d unthrottled verify / reset confirm | CONFIRMED_OPEN | NOT_STARTED | P3A / R-08 |
| KN-22e open redirect | CONFIRMED_OPEN | IMPLEMENTED | `safeNext()` in both forms; no other redirect sink exists. |
| KN-22f upload buffering / `questionId` | CONFIRMED_OPEN | NOT_STARTED | P2 / F-06 |
| KN-22g Origin check | CONFIRMED_OPEN | NOT_STARTED | P3A / R-09 |
| KN-22h CSP / HSTS / Permissions-Policy | CONFIRMED_OPEN | NOT_STARTED | P5 / Q-05. Note: the Vercel platform currently adds HSTS. |
| KN-22i plaintext tokens | CONFIRMED_OPEN | NOT_STARTED | P3A / R-08 |
| KN-22j media write by any staff | CONFIRMED_OPEN | IMPLEMENTED | Content area only; SVG/XML dropped. |
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
| KN-31 Submit validates presence only | CONFIRMED_OPEN | NOT_STARTED | P3A / R-06 |
| KN-32 Mislabelled dashboard counts | CONFIRMED_OPEN | NOT_STARTED | P3A / R-14 |
| KN-33 Never staged | CONFIRMED_OPEN | NOT_STARTED | P7 |
| KN-34 Notification links / timeouts / deadlines | PARTIALLY_RESOLVED | NOT_STARTED | P2/P3A |
| NF-01 Transitive advisories | CONFIRMED_OPEN | IMPLEMENTED | Overrides for undici, fast-uri, dompurify, source-map-js, fast-copy. Two un-patchable remain (see KN-03). |
| NF-02 Internal fields publicly readable | CONFIRMED_OPEN | IMPLEMENTED | `metrics.source` restricted. `testimonials.consentGiven` deliberately left public: it is a required boolean that reveals nothing, and restricting it would block a public query that filters on consent. |
| NF-03 SVG / media | CONFIRMED_OPEN | IMPLEMENTED | |
| NF-04 Infrastructure writes locked to a role that cannot exist | CONFIRMED_OPEN | NOT_STARTED | Needs the `lab_admin` migration (F-04). |
| NF-05 ... NF-07, NF-09 ... NF-16 | CONFIRMED_OPEN / NOT_YET_VERIFIED | NOT_STARTED | See blueprint Part C3. |
| NF-08 No root `not-found` / `global-error` | CONFIRMED_OPEN | NOT_STARTED | Added `/blog` error boundary only. |
| NF-10 No audit row on submit | CONFIRMED_OPEN | NOT_STARTED | P3A / R-06 |
| NF-11 `roles.test.ts` omits `lab_admin` | CONFIRMED_OPEN | NOT_STARTED | |

## Defects found and fixed while doing Phase 1 (not in the audit)

- `getSessionUser()` caught Next's own "this render is dynamic" signal, so pages that read the session could be prerendered as signed-out. It now re-throws Next control-flow errors (`35bf0ca`). Side effect: `/`, `/about`, `/ecosystem` are rendered per request.
- `/blog` was prerendered at build time, freezing whatever the CMS (or the invented fallback) held. It is now dynamic.
- The blog card read `category` and `readTime`, fields that exist only on the invented articles.
- `seedCms()` overwrote staff-edited homepage copy on every run.
