# Requirement coverage matrix — in progress

No behavior is accepted from source presence or earlier reports. FAIL means a reproduced failure affects the requirement; it does not mean every other assertion was executed. NOT RUN can include partial execution, because complete requirement acceptance remains unproved. See the execution report and per-case ledgers for exact evidence.

| Requirement | Description | Implementation candidates | Existing test files | Status |
| --- | --- | --- | --- | --- |
| CON-01 | Project foundation | `package.json`, `next.config.ts`, `src/db`, `src/migrations`, `Dockerfile` | `00-boot.test.ts`, `50-seeds.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-02 | Data architecture | `package.json`, `next.config.ts`, `src/db`, `src/migrations`, `Dockerfile` | `00-boot.test.ts`, `50-seeds.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-03 | Schema, migrations & seed tooling | `package.json`, `next.config.ts`, `src/db`, `src/migrations`, `Dockerfile` | `00-boot.test.ts`, `50-seeds.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-04 | Design system & token pipeline | `src/components`, `src/styles`, `scripts/lint_hardcodes.py`, `docs/delivery/TOKEN-PIPELINE.md` | `35-accessibility.test.ts`, `36-header-fit.test.ts` | NOT RUN |
| CON-05 | Component library & application shell | `src/components`, `src/styles`, `scripts/lint_hardcodes.py`, `docs/delivery/TOKEN-PIPELINE.md` | `35-accessibility.test.ts`, `36-header-fit.test.ts` | FAIL |
| CON-06 | Authentication & session management | `src/server/auth`, `src/app/(auth)`, `src/app/api/auth`, `src/server/members` | `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `28-token-hygiene.test.ts`, `30-auth-and-redirects.test.ts`, `32-staff-console.test.ts`, `42-account-login-throttle.test.ts`, `44-account-network-failure.test.ts`, `45-accounts-modules.test.ts`, `46-google-enabled.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-07 | Account lifecycle flows | `src/server/auth`, `src/app/(auth)`, `src/app/api/auth`, `src/server/members` | `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `28-token-hygiene.test.ts`, `30-auth-and-redirects.test.ts`, `32-staff-console.test.ts`, `42-account-login-throttle.test.ts`, `44-account-network-failure.test.ts`, `45-accounts-modules.test.ts`, `46-google-enabled.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-08 | Roles & authorisation | `src/server/auth`, `src/app/(auth)`, `src/app/api/auth`, `src/server/members` | `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `28-token-hygiene.test.ts`, `30-auth-and-redirects.test.ts`, `32-staff-console.test.ts`, `42-account-login-throttle.test.ts`, `44-account-network-failure.test.ts`, `45-accounts-modules.test.ts`, `46-google-enabled.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-09 | Account screens | `src/server/auth`, `src/app/(auth)`, `src/app/api/auth`, `src/server/members` | `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `28-token-hygiene.test.ts`, `30-auth-and-redirects.test.ts`, `32-staff-console.test.ts`, `42-account-login-throttle.test.ts`, `44-account-network-failure.test.ts`, `45-accounts-modules.test.ts`, `46-google-enabled.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-10 | Payload CMS 3 staff console | `src/payload`, `src/server/content`, `src/app/(payload)` | `05-empty-cms.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `31-public-pages.test.ts`, `37-journey-staff.test.ts`, `43-cms-audit.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-11 | Programme & venture content types | `src/payload`, `src/server/content`, `src/app/(payload)` | `05-empty-cms.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `31-public-pages.test.ts`, `37-journey-staff.test.ts`, `43-cms-audit.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-12 | Editorial & site content types | `src/payload`, `src/server/content`, `src/app/(payload)` | `05-empty-cms.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `31-public-pages.test.ts`, `37-journey-staff.test.ts`, `43-cms-audit.test.ts`, `47-workflow-handoffs.test.ts` | FAIL |
| CON-13 | Content delivery layer | `src/payload`, `src/server/content`, `src/app/(payload)` | `05-empty-cms.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `31-public-pages.test.ts`, `37-journey-staff.test.ts`, `43-cms-audit.test.ts`, `47-workflow-handoffs.test.ts` | NOT RUN |
| CON-14 | Homepage | `src/app/(public)`, `src/server/content`, `src/components` | `05-empty-cms.test.ts`, `31-public-pages.test.ts`, `33-event-notifications.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | FAIL |
| CON-15 | Programme pages | `src/app/(public)`, `src/server/content`, `src/components` | `05-empty-cms.test.ts`, `31-public-pages.test.ts`, `33-event-notifications.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | FAIL |
| CON-16 | Ecosystem directories | `src/app/(public)`, `src/server/content`, `src/components` | `05-empty-cms.test.ts`, `31-public-pages.test.ts`, `33-event-notifications.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | NOT RUN |
| CON-17 | Events & resources | `src/app/(public)`, `src/server/content`, `src/components` | `05-empty-cms.test.ts`, `31-public-pages.test.ts`, `33-event-notifications.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | FAIL |
| CON-18 | About, Ecosystem & Invest pages | `src/app/(public)`, `src/server/content`, `src/components` | `05-empty-cms.test.ts`, `31-public-pages.test.ts`, `33-event-notifications.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | NOT RUN |
| CON-19 | Site-wide search | `src/app/(public)`, `src/server/content`, `src/components` | `05-empty-cms.test.ts`, `31-public-pages.test.ts`, `33-event-notifications.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | NOT RUN |
| CON-20 | Guided onboarding & recommendation | `src/server/onboarding`, `src/app/(member)/onboarding` | `36-journey-student.test.ts`, `47-workflow-handoffs.test.ts`, `70-core-journey.test.ts` | FAIL |
| CON-21 | Application engine | `src/server/applications`, `src/server/storage`, `src/app/(member)/apply`, `src/app/(member)/dashboard/applications`, `src/app/(staff)/admin/applications`, `src/app/api/applications`, `src/app/api/admin/applications` | `01-server-action-boundary.test.ts`, `26-concurrency.test.ts`, `27-document-upload.test.ts`, `32-staff-console.test.ts`, `36-journey-student.test.ts`, `37-journey-staff.test.ts`, `41-storage-reconcile.test.ts`, `70-core-journey.test.ts` | FAIL |
| CON-22 | Application lifecycle & review states | `src/server/applications`, `src/server/storage`, `src/app/(member)/apply`, `src/app/(member)/dashboard/applications`, `src/app/(staff)/admin/applications`, `src/app/api/applications`, `src/app/api/admin/applications` | `01-server-action-boundary.test.ts`, `26-concurrency.test.ts`, `27-document-upload.test.ts`, `32-staff-console.test.ts`, `36-journey-student.test.ts`, `37-journey-staff.test.ts`, `41-storage-reconcile.test.ts`, `70-core-journey.test.ts` | NOT RUN |
| CON-23 | Member dashboard & event registration | `src/server/events`, `src/server/notifications`, `src/server/email`, `src/app/(member)/dashboard` | `26-concurrency.test.ts`, `33-event-notifications.test.ts`, `36-journey-student.test.ts`, `38-journey-lab-booking.test.ts` | FAIL |
| CON-24 | Notification centre | `src/server/events`, `src/server/notifications`, `src/server/email`, `src/app/(member)/dashboard` | `26-concurrency.test.ts`, `33-event-notifications.test.ts`, `36-journey-student.test.ts`, `38-journey-lab-booking.test.ts` | NOT RUN |
| CON-25 | Lab & facility registry | `src/server/labs`, `src/db/schema/labs.ts`, `src/app/(member)/dashboard/lab-booking`, `src/app/(member)/dashboard/lab-staff`, `src/app/(staff)/admin/labs` | `34-lab-booking.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts` | NOT RUN |
| CON-26 | Availability calendar & slot engine | `src/server/labs`, `src/db/schema/labs.ts`, `src/app/(member)/dashboard/lab-booking`, `src/app/(member)/dashboard/lab-staff`, `src/app/(staff)/admin/labs` | `34-lab-booking.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts` | NOT RUN |
| CON-27 | Booking request flow | `src/server/labs`, `src/db/schema/labs.ts`, `src/app/(member)/dashboard/lab-booking`, `src/app/(member)/dashboard/lab-staff`, `src/app/(staff)/admin/labs` | `34-lab-booking.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts` | NOT RUN |
| CON-28 | Lab-head approval console | `src/server/labs`, `src/db/schema/labs.ts`, `src/app/(member)/dashboard/lab-booking`, `src/app/(member)/dashboard/lab-staff`, `src/app/(staff)/admin/labs` | `34-lab-booking.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts` | NOT RUN |
| CON-29 | Lab assistant assignment & roster | `src/server/labs`, `src/db/schema/labs.ts`, `src/app/(member)/dashboard/lab-booking`, `src/app/(member)/dashboard/lab-staff`, `src/app/(staff)/admin/labs` | `34-lab-booking.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts` | NOT RUN |
| CON-30 | Booking ticket & signed QR pass | `src/lib/lab-qr`, `src/server/labs/attendance-qr.ts`, `src/app/lab-device`, `src/app/api/lab-attendance`, `public/sw.js`, `public/manifest.webmanifest` | `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-31 | Two-sided QR check-in and check-out | `src/lib/lab-qr`, `src/server/labs/attendance-qr.ts`, `src/app/lab-device`, `src/app/api/lab-attendance`, `public/sw.js`, `public/manifest.webmanifest` | `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-32 | Lab utilisation reporting | `src/server/labs`, `src/db/schema/labs.ts`, `src/app/(member)/dashboard/lab-booking`, `src/app/(member)/dashboard/lab-staff`, `src/app/(staff)/admin/labs` | `34-lab-booking.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts` | NOT RUN |
| CON-33 | Application review console | `src/server/applications`, `src/server/storage`, `src/app/(member)/apply`, `src/app/(member)/dashboard/applications`, `src/app/(staff)/admin/applications`, `src/app/api/applications`, `src/app/api/admin/applications` | `01-server-action-boundary.test.ts`, `26-concurrency.test.ts`, `27-document-upload.test.ts`, `32-staff-console.test.ts`, `36-journey-student.test.ts`, `37-journey-staff.test.ts`, `41-storage-reconcile.test.ts`, `70-core-journey.test.ts` | NOT RUN |
| CON-34 | Document handling | `src/server/applications`, `src/server/storage`, `src/app/(member)/apply`, `src/app/(member)/dashboard/applications`, `src/app/(staff)/admin/applications`, `src/app/api/applications`, `src/app/api/admin/applications` | `01-server-action-boundary.test.ts`, `26-concurrency.test.ts`, `27-document-upload.test.ts`, `32-staff-console.test.ts`, `36-journey-student.test.ts`, `37-journey-staff.test.ts`, `41-storage-reconcile.test.ts`, `70-core-journey.test.ts` | NOT RUN |
| CON-35 | Analytics dashboard | `src/server/analytics`, `src/app/api/analytics`, `src/app/(staff)/admin/analytics` | `40-analytics.test.ts` | NOT RUN |
| CON-36 | PWA packaging | `src/lib/lab-qr`, `src/server/labs/attendance-qr.ts`, `src/app/lab-device`, `src/app/api/lab-attendance`, `public/sw.js`, `public/manifest.webmanifest` | `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-37 | Offline shell & background sync | `src/lib/lab-qr`, `src/server/labs/attendance-qr.ts`, `src/app/lab-device`, `src/app/api/lab-attendance`, `public/sw.js`, `public/manifest.webmanifest` | `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-38 | Mobile camera QR scanning | `src/lib/lab-qr`, `src/server/labs/attendance-qr.ts`, `src/app/lab-device`, `src/app/api/lab-attendance`, `public/sw.js`, `public/manifest.webmanifest` | `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-39 | Cloudflare Turnstile | `src/server/security`, `src/server/env.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `src/components/security`, `infra/cfn` | `01-server-action-boundary.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `27-document-upload.test.ts`, `28-token-hygiene.test.ts`, `29-edge-controls.test.ts`, `42-account-login-throttle.test.ts`, `43-cms-audit.test.ts`, `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-40 | Rate limiting & abuse controls | `src/server/security`, `src/server/env.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `src/components/security`, `infra/cfn` | `01-server-action-boundary.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `27-document-upload.test.ts`, `28-token-hygiene.test.ts`, `29-edge-controls.test.ts`, `42-account-login-throttle.test.ts`, `43-cms-audit.test.ts`, `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-41 | Browser hardening | `src/server/security`, `src/server/env.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `src/components/security`, `infra/cfn` | `01-server-action-boundary.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `27-document-upload.test.ts`, `28-token-hygiene.test.ts`, `29-edge-controls.test.ts`, `42-account-login-throttle.test.ts`, `43-cms-audit.test.ts`, `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-42 | Upload safety | `src/server/security`, `src/server/env.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `src/components/security`, `infra/cfn` | `01-server-action-boundary.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `27-document-upload.test.ts`, `28-token-hygiene.test.ts`, `29-edge-controls.test.ts`, `42-account-login-throttle.test.ts`, `43-cms-audit.test.ts`, `44-lab-attendance-qr.test.ts` | NOT RUN |
| CON-43 | Secrets, encryption & audit logging | `src/server/security`, `src/server/env.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `src/components/security`, `infra/cfn` | `01-server-action-boundary.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `27-document-upload.test.ts`, `28-token-hygiene.test.ts`, `29-edge-controls.test.ts`, `42-account-login-throttle.test.ts`, `43-cms-audit.test.ts`, `44-lab-attendance-qr.test.ts` | FAIL |
| CON-44 | AWS Amplify Hosting | `infra/cfn`, `infra/edge`, `scripts/ops`, `Dockerfile`, `.github/workflows` | `00-boot.test.ts`, `29-edge-controls.test.ts`, `41-storage-reconcile.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-45 | Amazon RDS for PostgreSQL 16 | `infra/cfn`, `infra/edge`, `scripts/ops`, `Dockerfile`, `.github/workflows` | `00-boot.test.ts`, `29-edge-controls.test.ts`, `41-storage-reconcile.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-46 | Amazon S3 & CloudFront | `infra/cfn`, `infra/edge`, `scripts/ops`, `Dockerfile`, `.github/workflows` | `00-boot.test.ts`, `29-edge-controls.test.ts`, `41-storage-reconcile.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-47 | Amazon SES | `infra/cfn`, `infra/edge`, `scripts/ops`, `Dockerfile`, `.github/workflows` | `00-boot.test.ts`, `29-edge-controls.test.ts`, `41-storage-reconcile.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-48 | Cloudflare edge | `infra/cfn`, `infra/edge`, `scripts/ops`, `Dockerfile`, `.github/workflows` | `00-boot.test.ts`, `29-edge-controls.test.ts`, `41-storage-reconcile.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-49 | Amazon CloudWatch | `infra/cfn`, `infra/edge`, `scripts/ops`, `Dockerfile`, `.github/workflows` | `00-boot.test.ts`, `29-edge-controls.test.ts`, `41-storage-reconcile.test.ts`, `60-dependencies-and-migrations.test.ts` | NOT RUN |
| CON-50 | Accessibility | `src/components`, `src/app`, `src/styles`, `docs/handover/ACCESSIBILITY-MANUAL-TEST.md` | `35-accessibility.test.ts`, `36-header-fit.test.ts`, `44-account-network-failure.test.ts` | FAIL |
| CON-51 | Automated tests & flow verification | `tests`, `src`, `infra`, `.github/workflows/ci.yml` |  | NOT RUN |
| CON-52 | Performance & search visibility | `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/opengraph-image.tsx`, `scripts/bundle-budget.json` | `31-public-pages.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts` | NOT RUN |
| CON-53 | Documentation, training & handover | `docs/handover`, `docs/delivery`, `README.md`, `docs/LOCAL-TESTING.md` |  | NOT RUN |
| UX-01 | Global rules |  |  | NOT RUN |
| UX-02 | 1. Public shell |  |  | NOT RUN |
| UX-03 | 2. Homepage |  |  | FAIL |
| UX-04 | 3. `/programs` |  |  | NOT RUN |
| UX-05 | 4. `/programs/[slug]` |  |  | NOT RUN |
| UX-06 | 5. Auth screens |  |  | FAIL |
| UX-07 | 6. Onboarding |  |  | FAIL |
| UX-08 | 7. `/dashboard` |  |  | NOT RUN |
| UX-09 | 8. `/dashboard/applications` |  |  | NOT RUN |
| UX-10 | 9. `/apply/[program]` |  |  | NOT RUN |
| UX-11 | 10. `/admin` |  |  | NOT RUN |
| UX-12 | 11. Motion budget |  |  | NOT RUN |
| UX-13 | 12. Responsive summary |  |  | NOT RUN |
| UX-14 | 13. Accessibility checklist (§44) |  |  | FAIL |
| COPY-01 | 0. Official source material |  |  | NOT RUN |
| COPY-02 | 1. Homepage |  |  | FAIL |
| COPY-03 | 2. Programs |  |  | FAIL |
| COPY-04 | 3. Sign up / log in |  |  | NOT RUN |
| COPY-05 | 4. Onboarding |  |  | NOT RUN |
| COPY-06 | 5. Dashboard |  |  | NOT RUN |
| COPY-07 | 6. Application flow |  |  | NOT RUN |
| COPY-08 | 7. Emails |  |  | NOT RUN |
| COPY-09 | 8. Empty states |  |  | NOT RUN |
| COPY-10 | 9. Errors |  |  | NOT RUN |
| COPY-11 | 10. Navigation & footer |  |  | NOT RUN |
| COPY-12 | 11. Microcopy |  |  | NOT RUN |
| COPY-13 | 12. Words KNEST does not use |  |  | NOT RUN |
| JNY-01 | The seven journeys at a glance |  |  | NOT RUN |
| JNY-02 | Journey 1 — The student who isn't sure they're an entrepreneur |  |  | NOT RUN |
| JNY-03 | Journey 2 — The student with an idea → a submitted application |  |  | FAIL |
| JNY-04 | Journey 3 — The accepted founder |  |  | FAIL |
| JNY-05 | Journey 4 — The mentor |  |  | NOT RUN |
| JNY-06 | Journey 5 — The investor |  |  | NOT RUN |
| JNY-07 | Journey 6 — The partner |  |  | NOT RUN |
| JNY-08 | Journey 7 — Staff, operating KNEST |  |  | FAIL |
| JNY-09 | Cross-cutting rules |  |  | FAIL |
| JNY-10 | Journey coverage in this slice |  |  | NOT RUN |
