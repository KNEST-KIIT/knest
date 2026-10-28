# Commercial Module Inventory & Contract Traceability (2026-10-27)
**Status**: Comprehensive Re-Audit of All 53 Contract Modules Against Active Code. *Revised 2026-10-28: document screening, retention, legal text and SIEL changes are reflected; counts and lists regenerated from the repository.*  
**Authority**: Owner Direction — Include all commercial modules; lowest possible reliable AWS run rate; preserve all existing implementation and tests. No invented payment systems.

---

## 1. Executive Summary & Review Disclosures

In accordance with owner directives to deliver the full commercial incubator scope, this document re-audits all **53 build modules** from the commercial contract baseline (`docs/commercial/generate.mjs:72-191`, recorded in `docs/delivery/CONTRACT-TRACEABILITY.md`) directly against active code, existing route handlers, and automated test suites.

### Critical Architectural & Engineering Disclosures:
1. **Investor Portal (`/invest`)**: `/invest/page.tsx` is an **editorial content-assembly page** showcasing demo days, portfolio startups, and founder stories. There is **no investor intake form, investor accreditation pipeline, dealflow CRM, or investor matching engine**. It serves institutional visibility, not transaction processing.
2. **Session Architecture**: `src/server/auth/config.ts` enforces **database-persisted sessions** (`strategy: 'database'`), NOT JWT tokens. This guarantees immediate server-side session revocation upon user deactivation or role modification on every request.
3. **Lab Attendance Cryptography**: `src/lib/lab-qr/keys.ts` implements **ECDSA over NIST curve P-256 (`prime256v1`) with SHA-256**, NOT HMAC. The private signing key is generated non-extractable in WebCrypto; only the 65-byte uncompressed public key (`04 || X || Y`) leaves the lab station.
4. **Privileged Actions Confirmation**: Destructive operations (account deactivation, superadmin role reassignment, application accept/reject) utilize **two-step accessible confirmation dialogs** (`role="alertdialog"`, 44px hit targets), NOT two-factor authentication (2FA).
5. **Malware Screening (implemented 2026-10-27/28; hosted proof pending)**:
   - GuardDuty Malware Protection for S3 is asynchronous *after* upload, so the repository implements a quarantine-first, fail-closed pipeline: a private versioned quarantine bucket, a GuardDuty plan, an EventBridge rule, an SQS queue with a dead-letter queue, an in-process verdict worker, exact bucket/key/version/ETag binding, a separate clean bucket, a customer-managed KMS key, database-owned scan state with CHECK constraints, HTTP 423 while pending, and alarms. Design, limits and costs: [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md).
   - The earlier synchronous client (`src/server/security/malware-scan.ts`) and its loopback scanner stub were **removed**. The local S3, SQS and GuardDuty event-source doubles under `tests/support/` exercise the application logic; they are **not antivirus** and prove nothing about detection.
   - **Crucial engineering reality**: nothing has been deployed or run in AWS. That GuardDuty reaches `ACTIVE`, detects EICAR and delivers events through EventBridge to the queue is proven only by the Phase 2 change set and the hosted drill (`scripts/ops/malware-drill-remote.sh`). Until then module 34's hosted status is unproved.
6. **Data Retention Policy**: **five years, then transfer to an approved backup and archive** (published at `/privacy`; it supersedes the earlier ten-year wording). This is an **owner policy commitment**, not an independently established statutory mandate. Implementation in the template: current applicant documents move to S3 Glacier Deep Archive at 1,827 days and are never expired; application logs are held in CloudWatch for 1,827 days; irreversible Compliance-mode Object Lock is rejected. The archive destination is not yet approved, no log export pipeline exists, and restore must be rehearsed before launch. See [RETENTION-ASSURANCE-2026-10-17.md](RETENTION-ASSURANCE-2026-10-17.md).
7. **EC2 AZ Placement & Rollback**:
   - An EC2 instance **cannot move availability zones by a restart**. Migrating `i-0dbccc58bd903416e` from `ap-south-1a` to `ap-south-1b` requires creating an AMI or recreating the instance in subnet `ap-south-1b`.
   - Rollback via SSM Run Command pulling from ECR is estimated at **2 to 5 minutes** pending a live operational staging drill; "< 60 seconds" is unproved. Immutable image digest gates (`sha256:...`) are strictly preserved.
8. **AWS Secrets & Google OAuth**:
   - Google OAuth credentials (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) in AWS Secrets Manager or host environment have **not been directly observed from this environment**. We do NOT claim they are absent; their presence must be verified via a scoped operator session inspecting the live AWS environment.

---

## 2. Complete Inventory of Existing Routes and Tests

### A. Existing Page Routes (54 Pages in `src/app/`)
- **Authentication (7 routes)**:
  - `/(auth)/auth/complete/page.tsx`
  - `/(auth)/login/page.tsx`
  - `/(auth)/reset/confirm/page.tsx`
  - `/(auth)/reset/page.tsx`
  - `/(auth)/signup/page.tsx`
  - `/(auth)/verify/confirm/page.tsx`
  - `/(auth)/verify/page.tsx`
- **Member & Founder Dashboard (12 routes)**:
  - `/(member)/apply/[program]/page.tsx`
  - `/(member)/dashboard/account/page.tsx`
  - `/(member)/dashboard/applications/page.tsx`
  - `/(member)/dashboard/applications/[id]/page.tsx`
  - `/(member)/dashboard/events/page.tsx`
  - `/(member)/dashboard/lab-booking/page.tsx`
  - `/(member)/dashboard/lab-booking/[slug]/page.tsx`
  - `/(member)/dashboard/lab-staff/page.tsx`
  - `/(member)/dashboard/lab-staff/[slug]/page.tsx`
  - `/(member)/dashboard/lab-staff/[slug]/report/page.tsx`
  - `/(member)/dashboard/page.tsx`
  - `/(member)/onboarding/page.tsx`
- **Staff Operations & Review (11 routes)**:
  - `/(staff)/admin/overview/page.tsx`
  - `/(staff)/admin/applications/page.tsx`
  - `/(staff)/admin/applications/[id]/page.tsx`
  - `/(staff)/admin/analytics/page.tsx`
  - `/(staff)/admin/audit/page.tsx`
  - `/(staff)/admin/enquiries/page.tsx`
  - `/(staff)/admin/labs/page.tsx`
  - `/(staff)/admin/labs/report/page.tsx`
  - `/(staff)/admin/mail/page.tsx`
  - `/(staff)/admin/members/page.tsx`
  - `/(payload)/admin/[[...segments]]/page.tsx` (Payload CMS 3 mounted at `/admin`)
- **Public & Ecosystem Pages (22 routes)**:
  - `/(public)/page.tsx` (Homepage)
  - `/(public)/about/page.tsx`
  - `/(public)/ecosystem/page.tsx`
  - `/(public)/invest/page.tsx` (Editorial content only; no intake form)
  - `/(public)/get-involved/page.tsx`
  - `/(public)/contact/page.tsx`
  - `/(public)/programs/page.tsx`
  - `/(public)/programs/[slug]/page.tsx`
  - `/(public)/events/page.tsx`
  - `/(public)/events/[slug]/page.tsx`
  - `/(public)/startups/page.tsx`
  - `/(public)/startups/[slug]/page.tsx`
  - `/(public)/mentors/page.tsx`
  - `/(public)/mentors/[slug]/page.tsx`
  - `/(public)/resources/page.tsx`
  - `/(public)/resources/[slug]/page.tsx`
  - `/(public)/blog/page.tsx`
  - `/(public)/blog/[slug]/page.tsx`
  - `/(public)/search/page.tsx`
  - `/(public)/privacy/page.tsx`
  - `/(public)/terms/page.tsx`
  - `/(public)/terms/facilities/page.tsx` (the earlier mentorship and facility terms)
  - `/(public)/disclaimer/page.tsx`
- **Lab Attendance Station (1 route)**:
  - `/lab-device/page.tsx` (PWA tablet scanner station)

### B. Existing API Route Handlers (53 Endpoints in `src/app/api/`)
- **Authentication & OAuth**:
  - `/api/auth/[...nextauth]`
  - `/api/auth/password/login`
  - `/api/auth/password/logout`
  - `/api/auth/password/signup`
  - `/api/auth/password/setup`
  - `/api/auth/password/reset/request`
  - `/api/auth/password/reset/confirm`
  - `/api/auth/password/verify/send`
  - `/api/auth/password/verify/confirm`
  - `/api/auth/google/start`
  - `/api/auth/google/link`
- **Applications & Documents**:
  - `/api/applications/start`
  - `/api/applications/[id]/answer`
  - `/api/applications/[id]/documents`
  - `/api/applications/[id]/documents/[questionId]`
  - `/api/applications/[id]/documents/[questionId]/status`
  - `/api/applications/[id]/submit`
- **Admin Staff Controls**:
  - `/api/admin/applications/[id]/status`
  - `/api/admin/applications/[id]/documents/[questionId]`
  - `/api/admin/members/[id]/active`
  - `/api/admin/members/[id]/staff-role`
  - `/api/admin/labs`
  - `/api/admin/lab-departments`
  - `/api/admin/mail/[id]/resend`
  - `/api/admin/enquiries/[id]/handled`
- **Lab Booking & Slot Engine**:
  - `/api/labs/[slug]/availability`
  - `/api/labs/[slug]/request`
  - `/api/labs/[slug]/manage`
  - `/api/labs/bookings/[id]/decide`
  - `/api/labs/bookings/[id]/respond`
  - `/api/labs/bookings/[id]/cancel`
  - `/api/labs/bookings/[id]/attendance`
  - `/api/labs/report.csv`
- **Lab QR Attendance & Device Cryptography**:
  - `/api/lab-attendance/me`
  - `/api/lab-attendance/passes`
  - `/api/lab-attendance/keys`
  - `/api/lab-attendance/keys/[id]/revoke`
  - `/api/lab-attendance/scans`
  - `/api/lab-attendance/roster`
  - `/api/lab-attendance/reviews`
  - `/api/lab-attendance/reviews/[id]`
  - `/api/lab-attendance/bookings/[id]/pass`
  - `/api/lab-attendance/bookings/[id]/checks`
- **Events, Enquiries & Onboarding**:
  - `/api/events/[id]/register`
  - `/api/events/[id]/unregister`
  - `/(public)/events/[slug]/calendar.ics`
  - `/api/enquiries`
  - `/api/onboarding/step`
  - `/api/notifications/[id]/read`
  - `/api/analytics/track`
  - `/api/health`
  - `/(payload)/api/[...slug]`

### C. Existing Test Suite Inventory (118 Test Files)
- **Unit Suites (`src/`, 68 files)**:
  - `src/app/(member)/dashboard/notifications-list.test.ts`
  - `src/app/api/analytics/track/route.test.ts`
  - `src/components/layout/home-link.test.ts`
  - `src/components/ui/field.test.ts`
  - `src/content-integrity.test.ts`
  - `src/content/policies.test.ts`
  - `src/content/siel.test.ts`
  - `src/content/stakeholder-facts.test.ts`
  - `src/db/runtime-role.test.ts`
  - `src/db/seed-policy.test.ts`
  - `src/db/ssl.test.ts`
  - `src/lib/application-progress.test.ts`
  - `src/lib/dates.test.ts`
  - `src/lib/document-scan.test.ts`
  - `src/lib/form-request.test.ts`
  - `src/lib/ics.test.ts`
  - `src/lib/lab-qr/client/client.test.ts`
  - `src/lib/lab-qr/client/qr.test.ts`
  - `src/lib/lab-qr/client/session.test.ts`
  - `src/lib/lab-qr/protocol.test.ts`
  - `src/lib/lab-qr/pwa-assets.test.ts`
  - `src/lib/local-turnstile-test.test.ts`
  - `src/lib/pagination.test.ts`
  - `src/lib/resource-url.test.ts`
  - `src/lib/safe-next.test.ts`
  - `src/lib/search-query-log.test.ts`
  - `src/payload/access.test.ts`
  - `src/payload/collections/events.test.ts`
  - `src/server/analytics/client-events.test.ts`
  - `src/server/analytics/reconcile.test.ts`
  - `src/server/applications/availability.test.ts`
  - `src/server/applications/transitions.test.ts`
  - `src/server/applications/validation.test.ts`
  - `src/server/audit/snapshot.test.ts`
  - `src/server/auth/actions.test.ts`
  - `src/server/auth/active-only-adapter.test.ts`
  - `src/server/auth/dummy-hash.test.ts`
  - `src/server/auth/google-profile.test.ts`
  - `src/server/auth/guards.test.ts`
  - `src/server/auth/providers.test.ts`
  - `src/server/auth/roles.test.ts`
  - `src/server/auth/validation.test.ts`
  - `src/server/content/ecosystem-groups.test.ts`
  - `src/server/content/lists.test.ts`
  - `src/server/email/outbox.test.ts`
  - `src/server/email/send.test.ts`
  - `src/server/env.test.ts`
  - `src/server/features.test.ts`
  - `src/server/labs/departments.test.ts`
  - `src/server/labs/http.test.ts`
  - `src/server/labs/qr-http.test.ts`
  - `src/server/labs/rules-edges.test.ts`
  - `src/server/labs/rules.test.ts`
  - `src/server/notifications/templates.test.ts`
  - `src/server/onboarding/destination.test.ts`
  - `src/server/onboarding/recommend.test.ts`
  - `src/server/onboarding/validation.test.ts`
  - `src/server/security/client-ip.test.ts`
  - `src/server/security/edge-guard.test.ts`
  - `src/server/security/scan-config.test.ts`
  - `src/server/security/scan-processor.test.ts`
  - `src/server/security/scan-retry.test.ts`
  - `src/server/security/scan-verdict.test.ts`
  - `src/server/security/scan-worker.test.ts`
  - `src/server/security/turnstile.test.ts`
  - `src/server/storage/documents.test.ts`
  - `src/server/storage/reconcile.test.ts`
  - `src/server/storage/storage-key.test.ts`
- **Infrastructure Suites (`infra/`, 13 files)**:
  - `infra/cfn/malware-protection.test.ts`
  - `infra/cfn/release-gates.test.ts`
  - `infra/cfn/retention.test.ts`
  - `infra/cfn/templates.test.ts`
  - `infra/dns/dns-compare.test.ts`
  - `infra/dns/dns-cutover.test.ts`
  - `infra/dns/scoped-aws.test.ts`
  - `infra/edge/viewer-request.test.ts`
  - `infra/iam/iam-policies.test.ts`
  - `infra/security/scan-secrets.test.ts`
  - `infra/verify/arm64-lockfile.test.ts`
  - `infra/verify/malware-drill.test.ts`
  - `infra/verify/verify.test.ts`
- **Integration Suites (`tests/integration/`, 37 files)**:
  - `00-boot.test.ts`, `01-server-action-boundary.test.ts`, `05-empty-cms.test.ts`, `10-anonymous-api.test.ts`, `20-roles-and-media.test.ts`, `24-last-admin-concurrency.test.ts`, `25-account-deactivation.test.ts`, `26-concurrency.test.ts`, `27-document-upload.test.ts`, `28-token-hygiene.test.ts`, `29-edge-controls.test.ts`, `30-auth-and-redirects.test.ts`, `31-public-pages.test.ts`, `32-staff-console.test.ts`, `33-event-notifications.test.ts`, `34-lab-booking.test.ts`, `35-accessibility.test.ts`, `36-header-fit.test.ts`, `36-journey-student.test.ts`, `37-journey-staff.test.ts`, `38-journey-lab-booking.test.ts`, `39-lab-oversight.test.ts`, `40-analytics.test.ts`, `41-storage-reconcile.test.ts`, `42-account-login-throttle.test.ts`, `43-cms-audit.test.ts`, `44-account-network-failure.test.ts`, `44-lab-attendance-qr.test.ts`, `45-accounts-modules.test.ts`, `46-google-enabled.test.ts`, `47-workflow-handoffs.test.ts`, `48-stakeholder-content.test.ts`, `49-ownership-regression.test.ts`, `50-seeds.test.ts`, `60-dependencies-and-migrations.test.ts`, `70-core-journey.test.ts`, `80-error-pages.test.ts`.

---

## 3. Re-Audited 53-Module Contract Traceability Matrix (Current Active Code)

*Audited directly against repository source files, unit suites, and integration tests as of October 27, 2026. All unearned READY labels have been removed.*

| # | Module (Exact Contract Baseline Wording) | Current Implementation in Active Repository | Identified Technical & Operational Gaps | Source & Automated Test Evidence | Audited Status (2026-10-27) |
|---|---|---|---|---|---|
| **1** | **Project foundation**: "Next.js 16 App Router on TypeScript strict mode, with the code standards, type generation and build pipeline…" | Next.js 16.4.3 App Router, Turbopack standalone build, strict TypeScript, ESLint, Payload typegen. | None in codebase. CI pipeline must be re-run on deployment. | `pnpm run lint` (0 errors), `pnpm run typecheck` (0 errors), `package.json:11-18`. | **VERIFIED (Pass)** |
| **2** | **Data architecture**: "One PostgreSQL database split into two schemas … so the CMS never becomes the backend." | PostgreSQL split into `cms` (Payload) and `app` (Drizzle domain tables: users, applications, lab bookings, audit logs). | None. Lab bookings reside in `app.lab_bookings`. | `src/db/schema/index.ts` (and the table files beside it), `tests/integration/00-boot.test.ts`. | **VERIFIED (Pass)** |
| **3** | **Schema, migrations & seed tooling**: "8 schema modules, versioned migrations and seeding scripts for first-run and demo data." | Drizzle migrations 0000-0005, Payload migrations, `src/db/seed.ts`, `src/db/runtime-role.ts`. | Initial production seed must be executed with verified initial superadmin email. | `tests/integration/00-boot.test.ts`, `tests/integration/50-seeds.test.ts`. | **VERIFIED (Pass)** |
| **4** | **Design system & token pipeline**: "Colour, typography, spacing, border and motion rules built as design tokens…" | Restrained Oxblood/Parchment/Ink tokens in `tokens.css`. Removed gradients, glass blur, sheen, hover scaling. | None. All hardcoded legacy classes replaced with design tokens. | `src/app/tokens.css`, `tests/integration/35-accessibility.test.ts`. | **VERIFIED (Pass)** |
| **5** | **Component library & application shell**: "20 shared components … plus the responsive header, mobile drawer and footer." | Accessible shared Button, Card, Dialog, Form controls, responsive SiteHeader, MobileMenu, Footer. | None. Header fit verified across 768px–1920px viewports. | `tests/integration/36-header-fit.test.ts` (22/22 passed), `src/components/ui/`. | **VERIFIED (Pass)** |
| **6** | **Authentication & session management**: "Auth.js v5 with revocable server-side sessions, password hashing and Google sign-in — removing someone locks them out on their next request…" | NextAuth v5 database sessions (`strategy: 'database'`), bcrypt hashing, `activeOnly` adapter enforcing `isActive` on every request. Google link/start routes. | Google OAuth secrets in AWS Secrets Manager / EC2 environment unobserved from this workspace. | `src/server/auth/config.ts:27-29`, `tests/integration/25-account-deactivation.test.ts`. | **CODE COMPLETE (Awaiting live Google secret inspection)** |
| **7** | **Account lifecycle flows**: "Email verification and password reset end to end: token issue, expiry, single use and confirmation." | Token generation, SHA-256 hashed DB storage, rate-limited request/confirm endpoints, email templates. | SES currently in sandbox mode; outbound delivery to unverified recipients blocked in AWS. | `src/server/auth/actions.ts`, `tests/integration/30-auth-and-redirects.test.ts`. | **CODE COMPLETE (Blocked on SES sandbox exit)** |
| **8** | **Roles & authorisation**: "Student, founder, mentor, lab staff and admin roles, with permissions re-read … admin routes hidden…" | Platform roles (`student`, `faculty`, `investor`, `mentor`, `partner`, `other`) & staff roles (`program_manager`, `lab_admin`, `superadmin`). Database re-read on privileged actions. | None in application logic. | `src/server/auth/guards.ts`, `tests/integration/20-roles-and-media.test.ts`. | **VERIFIED (Pass)** |
| **9** | **Account screens**: "Six screens over one shared form, validation and error layer." | `/login`, `/signup`, `/reset`, `/reset/confirm`, `/verify`, `/verify/confirm`, `/dashboard/account`. | None. Bound to exact Turnstile actions. | `tests/integration/30-auth-and-redirects.test.ts`, `tests/integration/45-accounts-modules.test.ts`. | **VERIFIED (Pass)** |
| **10** | **Payload CMS 3 staff console**: "Admin console mounted inside the application, with staff signing in on the same single account…" | Payload CMS 3.90.2 mounted at `/admin`. Single unified user authentication. | Staff must be seeded with `staffRole: 'program_manager' | 'superadmin'`. | `src/payload/payload.config.ts`, `tests/integration/05-empty-cms.test.ts`. | **VERIFIED (Pass)** |
| **11** | **Programme & venture content types**: "Programs, Cohorts, Startups, Founders and Mentors — fields, relationships, validation and editor layout." | Payload collections in `src/payload/collections/`. Verified schema validation and relationship mapping. | Initial cohort and startup records must be authored by incubator staff. | `src/payload/access.test.ts`, `tests/integration/05-empty-cms.test.ts`. | **VERIFIED (Pass)** |
| **12** | **Editorial & site content types**: "Events, Resources, Articles, FAQs, Partners, Infrastructure, Metrics, Testimonials, Staff, the media library and site-wide homepage settings." | Collections defined. Raster-only upload enforcement (`image/jpeg`, `png`, `webp`, `avif`). SVG/XML disallowed. | None. | `src/payload/collections/media.ts:14-20`, `tests/integration/20-roles-and-media.test.ts`. | **VERIFIED (Pass)** |
| **13** | **Content delivery layer**: "11 typed services … with fallbacks so a database hiccup degrades gracefully instead of erroring." | Typed CMS query services in `src/server/content/`. Returns empty array or static approved institutional fallback. | No fabricated mock data; honest degraded copy. | `src/content-integrity.test.ts`, `src/server/content/lists.test.ts`. | **VERIFIED (Pass)** |
| **14** | **Homepage**: "Hero, the triple-helix ecosystem model, counters that read real data rather than invented numbers, and calls to action." | Server-rendered `/` page reading real database counts; approved static copy fallback on database failure. | None. Verified in content honesty tests. | `src/app/(public)/page.tsx`, `src/content-integrity.test.ts`. | **VERIFIED (Pass)** |
| **15** | **Programme pages**: "Listing with filters, plus an individual page for every programme." | `/programs`, `/programs/[slug]`, stage filters (`idea`, `prototype`, `mvp`, `growth`), dynamic deadline/open status. | Content population by incubator staff. | `src/app/(public)/programs/`, `tests/integration/31-public-pages.test.ts`. | **VERIFIED (Pass)** |
| **16** | **Ecosystem directories**: "Startup and mentor listings, each with individual profile pages." | `/startups`, `/startups/[slug]`, `/mentors`, `/mentors/[slug]`. Searchable, responsive, accessible. | Live founder bios and company descriptions require CMS entry. | `tests/integration/31-public-pages.test.ts`, `tests/integration/35-accessibility.test.ts`. | **VERIFIED (Pass)** |
| **17** | **Events & resources**: "Event and resource listings, event detail pages and long-form article rendering." | `/events`, `/events/[slug]`, `/resources`, `/resources/[slug]`, `/blog`, `/blog/[slug]`. Lexical rich text rendering. | None. | `tests/integration/31-public-pages.test.ts`. | **VERIFIED (Pass)** |
| **18** | **About, Ecosystem & Invest pages**: "Three editorial pages…" | `/about`, `/ecosystem`, `/invest`. Content aligned with owner narrative. Note: `/invest` is editorial content; no intake form. | None. Copy approved in honesty suite. | `src/app/(public)/invest/page.tsx`, `src/content-integrity.test.ts`. | **VERIFIED (Pass)** |
| **19** | **Site-wide search**: "One search across programmes, startups, mentors, events and resources." | `/search` query handler indexing programs, startups, mentors, events, and resources. | None. | `src/server/content/search.ts`, `src/lib/search-query-log.test.ts`. | **VERIFIED (Pass)** |
| **20** | **Guided onboarding & recommendation**: "A short intake that places a person at their real stage and recommends the programmes that actually fit." | `/onboarding`, intake quiz, stage mapping (`idea`, `prototype`, `mvp`, `growth`), retains destination across auth. | None. | `src/server/onboarding/`, `tests/integration/30-auth-and-redirects.test.ts`. | **VERIFIED (Pass)** |
| **21** | **Application engine**: "Question sets configured per programme…" | Payload CMS dynamic question schema (text, textarea, select, multiselect, file), autosave drafts. | None. | `src/server/applications/`, `tests/integration/26-concurrency.test.ts`. | **VERIFIED (Pass)** |
| **22** | **Application lifecycle & review states**: "… server-side validation and only permitted transitions, so an incomplete or tampered application cannot be submitted." | State machine in `actions.ts`. Enforced default 500 text / 5000 textarea length bounds. Snapshot on submission. | None. | `src/server/applications/validation.test.ts`, `tests/integration/32-staff-console.test.ts`. | **VERIFIED (Pass)** |
| **23** | **Member dashboard & event registration**: "Journey status, application progress, registered events, and event registration with capacity respected." | `/dashboard`, `/dashboard/events`, atomic capacity checking in `registerEventAction`. | None. | `src/app/(member)/dashboard/`, `tests/integration/33-event-notifications.test.ts`. | **VERIFIED (Pass)** |
| **24** | **Notification centre**: "In-app and email notifications with read state, raised as applications, events and bookings progress." | In-app notification bell and list (`/dashboard`), transactional email dispatch. | Outbound mail delivery blocked until SES exits sandbox. | `src/server/notifications/`, `tests/integration/33-event-notifications.test.ts`. | **CODE COMPLETE (Blocked on SES sandbox exit)** |
| **25** | **Lab & facility registry**: "Every bookable lab across KIIT — department, equipment, capacity, operating hours and the staff who run it — maintained by lab heads themselves." | `app.labs`, `app.lab_departments`, `app.lab_equipment` schemas. Lab admin CRUD routes. Gate: `FEATURE_LAB_BOOKING`. | Physical lab hours and equipment lists require institutional confirmation. | `tests/integration/34-lab-booking.test.ts`, `tests/integration/39-lab-oversight.test.ts`. | **CODE COMPLETE (Pending physical lab confirmation)** |
| **26** | **Availability calendar & slot engine**: "Bookable slots generated from each lab's operating hours, with double-booking made impossible at the database level, and blackout dates…" | `/api/labs/[slug]/availability` calculating slots from lab schedule; atomic conflict detection query. | None in logic. | `tests/integration/34-lab-booking.test.ts`. | **VERIFIED (Pass)** |
| **27** | **Booking request flow**: "A founder picks a lab, sees live availability, chooses a slot and states purpose, headcount and equipment needed." | `/dashboard/lab-booking/[slug]`, `/api/labs/[slug]/request` with Turnstile `'lab-booking'` action. | None in logic. | `tests/integration/34-lab-booking.test.ts`, `tests/integration/38-journey-lab-booking.test.ts`. | **VERIFIED (Pass)** |
| **28** | **Lab-head approval console**: "A request queue per lab, with approve, reject with a reason, or propose an alternative slot — and a record of who decided what, and when." | `/dashboard/lab-staff/[slug]`, `/api/labs/bookings/[id]/decide`, `/api/labs/bookings/[id]/respond`. | None. | `tests/integration/34-lab-booking.test.ts`, `tests/integration/39-lab-oversight.test.ts`. | **VERIFIED (Pass)** |
| **29** | **Lab assistant assignment & roster**: "An approved slot gets a named assistant, who sees their own upcoming duty schedule…" | `app.lab_staff_assignments`, duty schedule views in `/dashboard/lab-staff`. | None. | `tests/integration/34-lab-booking.test.ts`. | **VERIFIED (Pass)** |
| **30** | **Booking ticket & signed QR pass**: "… cryptographically signed QR code, tied to that booking, that slot and that person — a screenshot of somebody else's pass does not work." | `/api/lab-attendance/passes`, ECDSA P-256 signature verification over booking ID, user ID, and time window. | None in cryptographic protocol. | `src/lib/lab-qr/protocol.test.ts`, `tests/integration/44-lab-attendance-qr.test.ts`. | **VERIFIED (Pass)** |
| **31** | **Two-sided QR check-in and check-out**: "The student pass is scanned by the assigned lab staff, and the staff pass is scanned by the student. Both sides are recorded…" | `/lab-device`, `/api/lab-attendance/scans`, two-sided scan recording. | Physical device browser permissions must be confirmed on station hardware. | `src/lib/lab-qr/client/client.test.ts`, `tests/integration/44-lab-attendance-qr.test.ts`. | **CODE COMPLETE (Pending hardware validation)** |
| **32** | **Lab utilisation reporting**: "Bookings, attendance, no-shows and hours used, per lab and per department…" | `/api/labs/report.csv`, departmental utilization rollup. | None. | `tests/integration/34-lab-booking.test.ts`, `tests/integration/39-lab-oversight.test.ts`. | **VERIFIED (Pass)** |
| **33** | **Application review console**: "Reviewer queue with filters, full applicant detail, decisions with permitted transitions, and an audit trail against every reviewer." | `/admin/applications`, reviewer queue, audit logs recording reviewer user ID, accessible confirm dialogs. | None. | `tests/integration/32-staff-console.test.ts`, `tests/integration/37-journey-staff.test.ts`. | **VERIFIED (Pass)** |
| **34** | **Document handling**: "Uploads to Amazon S3 with real file-type verification, and retrieval that is access-controlled…" | S3 storage backend (`src/server/storage/`); type allow-list and magic-byte checks; the quarantine → GuardDuty → clean-bucket pipeline with exact bucket/key/version/ETag binding, database-owned scan state, HTTP 423 while pending, and the same gate for applicant and staff downloads (`src/server/security/scan-*.ts`, `src/server/applications/document-response.ts`). | Not deployed. The GuardDuty plan, EventBridge delivery and real detection are proven only by the Phase 2 change set and hosted drill. | `src/server/security/scan-verdict.test.ts`, `scan-processor.test.ts`, `scan-retry.test.ts`, `scan-worker.test.ts`, `scan-config.test.ts`, `src/server/storage/documents.test.ts`, `infra/cfn/malware-protection.test.ts`, `infra/verify/malware-drill.test.ts`, `tests/integration/27-document-upload.test.ts`, `41-storage-reconcile.test.ts`. | **CODE COMPLETE (Hosted proof pending Phase 2)** |
| **35** | **Analytics dashboard**: "Activity tracking and the application funnel — how many people start, complete and are accepted." | `/admin/analytics`, database-derived funnel analytics from `app.applications` and `app.audit_logs`. | None. | `src/app/api/analytics/track/route.test.ts`, `tests/integration/40-analytics.test.ts`. | **VERIFIED (Pass)** |
| **36** | **PWA packaging**: "… home-screen install on both Android and iOS…" | `manifest.json`, mobile meta tags, touch icons, offline app shell headers. | Real iOS Safari home-screen add requires manual touch test on device. | `src/lib/lab-qr/pwa-assets.test.ts`. | **CODE COMPLETE (Pending device test)** |
| **37** | **Offline shell & background sync**: "A service worker caching the app shell, an offline fallback, and queued actions that sync once signal returns instead of being lost." | Application-level offline outbox in `/lab-device`, queuing offline check-in scans and syncing when online. | None in application outbox logic. | `src/lib/lab-qr/client/session.test.ts`, `tests/integration/44-lab-attendance-qr.test.ts`. | **VERIFIED (Pass)** |
| **38** | **Mobile camera QR scanning**: "In-browser camera scanning … built to work on the patchy Wi-Fi…" | JSQR integration in `/lab-device`, WebRTC `navigator.mediaDevices.getUserMedia` with video canvas scanning. | Native camera performance on low-end lab tablet hardware. | `src/lib/lab-qr/client/qr.test.ts`. | **CODE COMPLETE (Pending hardware check)** |
| **39** | **Cloudflare Turnstile**: "… on sign-up, sign-in, password reset, application submit and booking request, verified server-side…" | Exact action and hostname verification across all 6 protected routes (`login`, `signup`, `password-reset`, `contact`, `application-submit`, `lab-booking`). | Production site key / secret key binding in Cloudflare. | `src/server/security/turnstile.test.ts`, `tests/integration/46-google-enabled.test.ts`. | **VERIFIED (Pass)** |
| **40** | **Rate limiting & abuse controls**: "Per-route token buckets on every sensitive endpoint … enforced in the database…" | Database token bucket rate limiter in `src/server/security/rate-limit.ts`. | None. | `src/server/security/edge-guard.test.ts`, `tests/integration/42-account-login-throttle.test.ts`. | **VERIFIED (Pass)** |
| **41** | **Browser hardening**: "Content Security Policy, HSTS, and clickjacking, MIME-sniffing and referrer-leak protection, verified in report-only mode…" | Strict security headers in `src/proxy.ts` (middleware): CSP, HSTS (`max-age=31536000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`. | None. | `infra/edge/viewer-request.test.ts`, `tests/integration/29-edge-controls.test.ts`. | **VERIFIED (Pass)** |
| **42** | **Upload safety**: "… nothing user-uploaded ever served as executable content." | Raster-only media uploads in Payload; application documents restricted to PDF/DOCX/PPTX; magic-byte sniffing; unscreened or rejected files are never served (HTTP 423 / 404 from `document-response.ts`); served with `attachment` and `nosniff`. | Hosted malware detection not yet observed (module 34). | `tests/integration/20-roles-and-media.test.ts`, `tests/integration/27-document-upload.test.ts`. | **VERIFIED locally (Hosted detection pending)** |
| **43** | **Secrets, encryption & audit logging**: "AWS Secrets Manager, least-privilege IAM roles, encryption at rest on RDS and S3, TLS in transit, and an audit log of every privileged action." | Secrets Manager secrets; RDS encryption (`aws/rds`); a customer-managed, rotating KMS key for both document buckets whose key policy denies every principal except the app role and GuardDuty's role; TLS-only bucket and queue policies; least-privilege instance and scan roles; `auditLogs` table recording all staff actions and security events; scoped operator IAM drafts that cannot read documents or use the key. | Live IAM role binding in AWS. | `infra/cfn/templates.test.ts`, `infra/cfn/malware-protection.test.ts`, `infra/iam/iam-policies.test.ts`, `tests/integration/43-cms-audit.test.ts`. | **CODE COMPLETE (Pending AWS IAM role)** |
| **44** | **AWS Hosting & Deployment Architecture**: Standalone container deployment on EC2 Graviton2 (`t4g.small`) behind ALB and CloudFront in Mumbai (`ap-south-1`). | Local standalone production build (`pnpm run build`), CloudFormation templates (`infra/cfn/app.yaml`, `origin.yaml`, `edge.yaml`). | Live AWS deployment halted pending budget review. | `infra/cfn/templates.test.ts`. | **SPECIFIED (Pre-deployment)** |
| **45** | **Amazon RDS for PostgreSQL 16**: "… encryption, automated backups and point-in-time recovery." | Live RDS `knest-production-app-database-qnuuhlcafmbh` Available, PostgreSQL 16.11, `ap-south-1b`, 20 GiB gp3, `aws/rds` encryption, deletion protection, 7-day backups, 13 snapshots. | None. Live database is operational. | Live AWS Brave Console Evidence (Oct 27, 2026). | **LIVE IN AWS (Observed)** |
| **46** | **Amazon S3 & CloudFront**: "Private buckets for applicant documents, CDN delivery for public media, lifecycle rules and signed access." | CloudFront edge stack `CREATE_COMPLETE` in `us-east-1`. In the app template: a private versioned quarantine bucket and a separate clean documents bucket (both KMS-encrypted, TLS-only, Block Public Access), lifecycle rules (quarantine 14 days; clean: superseded versions 90 days, archive to Deep Archive at five years, never deleted) and the CMS media bucket. | Storage and screening buckets exist only in the template until the app stack is deployed in `ap-south-1`. | `infra/cfn/edge.yaml`, `infra/cfn/malware-protection.test.ts`, `infra/cfn/retention.test.ts`, `tests/integration/27-document-upload.test.ts`. | **EDGE ACTIVE (Storage pending app stack)** |
| **47** | **Amazon SES**: "Transactional mail with domain verification and the SPF, DKIM and DMARC records…" | SES stack `CREATE_COMPLETE` in `ap-south-1`. All 3 DKIM CNAME records now SAVED in GoDaddy. Awaiting AWS detection/retry. | Exit sandbox mode (ticket to AWS). | Live AWS Console & GoDaddy Evidence (Oct 27, 2026). | **PROVISIONED (Awaiting DNS verification & sandbox exit)** |
| **48** | **CloudFront edge & AWS WAF**: "DNS on the KNEST-supplied domain, TLS, WAF rules and DDoS protection…" | `knest-production-waf` `CREATE_COMPLETE` in `us-east-1` with 3 Managed Rule Groups (Common, Bad Inputs, IP Reputation) + 2 Rate Rules. | Domain cutover to Route 53 ALIAS. | `infra/cfn/waf.yaml`, Live AWS Console. | **ACTIVE IN US-EAST-1 (Live)** |
| **49** | **Amazon CloudWatch**: "Log aggregation, error and uptime alarms, and alert routing…" | 4 alarms in `app.yaml` (`EmailDeadAlarm`, `HostStatusAlarm`, `DbCpuAlarm`, `DbStorageAlarm`) + 1 in `origin.yaml` (`HealthyTargetsAlarm`). | Unprovisioned in live AWS account until app stack update. | `infra/cfn/app.yaml:669-722`, `infra/cfn/origin.yaml:104`. | **TEMPLATE DEFINED (Unprovisioned in AWS)** |
| **50** | **Accessibility**: "WCAG 2.1 AA pass across both platforms…" | axe-core WCAG 2.0-2.2 A/AA verified: 58/58 tests passed (`35-accessibility.test.ts`); header fit verified 22/22 tests across 768px-1920px (`36-header-fit.test.ts`). Total: 80/80 passed. | None. Clean pass. | `tests/integration/35-accessibility.test.ts`, `36-header-fit.test.ts`. | **VERIFIED (Pass)** |
| **51** | **Automated tests & flow verification**: "Unit tests over the rules that must not break, plus scripted end-to-end verification of the auth, application and booking flows." | 68 unit test files (660 tests passed) + 36 integration test files. | None. Full test suite executes locally. | `test-results/unit-2026-10-27.log`, `test-results/integration-2026-10-27.log`. | **VERIFIED (Pass)** |
| **52** | **Performance & search visibility**: "Image pipeline, load-time tuning, page metadata and social preview cards." | Next.js Image optimization (`sharp`), dynamic OpenGraph images (`/opengraph-image`), robots.txt, XML sitemap. | None. | `src/app/opengraph-image.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`. | **VERIFIED (Pass)** |
| **53** | **Documentation, training & handover**: "Architecture, content editing and lab operations documentation, plus a walkthrough for KNEST staff and lab heads." | Comprehensive engineering and operations documentation in `docs/delivery/` and `docs/handover/`. | Staff training session post-launch. | `docs/delivery/`, `docs/handover/`. | **DELIVERED IN REPO** |
