> Source: `docs/commercial/generate.mjs` on branch `claude/knest-invoicing-maintenance-8rh7gd` (`DEV_SECTIONS`, lines 72-191), the 53 build modules. Wording is quoted from that file and abridged only where marked "...". **The repository copy still contains 15 unfilled placeholders, so it may differ from the document KIIT received; confirm the version with the owner (HD-21).**
>
> Statuses are the baseline at `00181d4`, before Phase 1. Phase 1 changed: module 13 (content delivery: invented fallbacks removed; the contract's "degrades gracefully" is now an honest empty or error state), 42 (SVG/XML uploads removed), 40 (analytics endpoint now rate limited), 6 (dev-bypass removed; deactivation still not enforced), 10 (Payload upgraded). None of these is yet VERIFIED in any environment.

# Contract traceability (D-06) (invoice `DEV_SECTIONS`, `generate.mjs:72-191`, branch copy; 53 modules)

**Status key:**
- **ND** = not delivered
- **PD** = partially delivered
- **IU** = implemented in code, unverified in any environment
- **II** = implemented incorrectly

No module is "delivered and verified", because no environment exists.

Owner is Eng unless noted. Verification for every IU/PD/II row means staging evidence per Part J. **Every row's contractual status is ND or worse at the environment level until P7**, which contradicts the invoice's "delivered, deployed and in production".

| # | Module: exact wording (abridged only where noted "…") | Existing | Missing | Task(s) | Deps | Acceptance / verification | Status |
|---|---|---|---|---|---|---|---|
| 1 | **Project foundation**: "Next.js 16 App Router on TypeScript strict mode, with the code standards, type generation and build pipeline…" | Next 16, strict TS, `generate:types` | Working lint; CI | C-01, F-10 | — | lint + CI green | PD |
| 2 | **Data architecture**: "One PostgreSQL database split into two schemas … so the CMS never becomes the backend." | `cms`/`app` split | Lab bookings currently in CMS (violates it) | LB-12 | P3B | No operational data in `cms` | II |
| 3 | **Schema, migrations & seed tooling**: "8 schema modules, versioned migrations and seeding scripts for first-run and demo data." | 8 schema files; Drizzle 0000-0005; seeds | Payload migrations; `lab_admin` migration; safe seeds | F-04, C-05 | C-06 | Migrate-from-zero CI | PD |
| 4 | **Design system & token pipeline**: "Colour, typography, spacing, border and motion rules built as design tokens…" | `tokens.css` | "Pipeline" undefined (kit JSON not wired); September bypasses | X-11 | — | Hardcode lint zero | PD, **ambiguous: "pipeline"** |
| 5 | **Component library & application shell**: "20 shared components … plus the responsive header, mobile drawer and footer." | 20 ui components; header/drawer/footer | Undefined classes; a11y defects | X-10, X-11 | — | axe + keyboard | IU |
| 6 | **Authentication & session management**: "Auth.js v5 with revocable server-side sessions, password hashing and Google sign-in — removing someone locks them out on their next request…" | DB sessions, bcrypt | `isActive` not enforced (contradicts "locks them out"); Google not configured/guarded | R-02, R-03 | HD-10 | Deactivate → next request denied; Google E2E | II |
| 7 | **Account lifecycle flows**: "Email verification and password reset end to end: token issue, expiry, single use and confirmation." | Code present | Email delivery; hashed tokens; rate limits | F-07, R-08 | HD-18 | Staging email E2E | PD |
| 8 | **Roles & authorisation**: "Student, founder, mentor, lab staff and admin roles, with permissions re-read … admin routes hidden…" | Roles + guards; `lab_admin` unmigrated | Lab head/assistant scoping | LB-01, F-04 | — | Authz matrix | PD |
| 9 | **Account screens**: "Six screens over one shared form, validation and error layer." | 6 auth routes | Network-error hang; Google guard | R-02 | — | E2E | IU |
| 10 | **Payload CMS 3 staff console**: "Admin console mounted inside the application, with staff signing in on the same single account…" | Yes | Vulnerable version | C-06 | — | Staff E2E | II (vulnerable) |
| 11 | **Programme & venture content types**: "Programs, Cohorts, Startups, Founders and Mentors — fields, relationships, validation and editor layout." | Yes | — | — | — | Staff E2E | IU |
| 12 | **Editorial & site content types**: "Events, Resources, Articles, FAQs, Partners, Infrastructure, Metrics, Testimonials, Staff, the media library and site-wide homepage settings." | Collections exist | Field leaks (NF-02); SVG (NF-03) | C-03, C-07 | — | Integration | PD |
| 13 | **Content delivery layer**: "11 typed services … with fallbacks so a database hiccup degrades gracefully instead of erroring." | Services exist | Fallbacks fabricate | C-02 | — | Empty/error tests | II, **ambiguous: "fallbacks" = honest degraded state (HD-22)** |
| 14 | **Homepage**: "Hero, the triple-helix ecosystem model, counters that read real data rather than invented numbers, and calls to action." | Hero, CTAs | Triple helix not on home; no real counters | X-02, X-06, X-08 | HD-04 | Counters traced to tables | PD |
| 15 | **Programme pages**: "Listing with filters, plus an individual page for every programme." | Yes | Fallback dead links | C-02 | — | E2E | IU |
| 16 | **Ecosystem directories**: "Startup and mentor listings, each with individual profile pages." | Yes | — | — | — | E2E | IU |
| 17 | **Events & resources**: "Event and resource listings, event detail pages and long-form article rendering." | Listings, event detail | **Article detail page** | X-09 (`/stories/[slug]`, donor) | — | E2E | PD |
| 18 | **About, Ecosystem & Invest pages**: "Three editorial pages…" | Yes | Unapproved claims | C-02, X-01 | HD-04 | Copy sign-off | II |
| 19 | **Site-wide search**: "One search across programmes, startups, mentors, events and resources." | `/search` (4 collections) | **Mentors not searched**; unlinked | X-09 + add mentors | — | Search test incl. a mentor | PD |
| 20 | **Guided onboarding & recommendation**: "A short intake that places a person at their real stage and recommends the programmes that actually fit." | Yes | Intent lost; CTA ignores path | R-01 | — | E2E J2 | II |
| 21 | **Application engine**: "Question sets configured per programme…" | Yes | Snapshot on delete/unpublish | R-04 | — | Integration | IU |
| 22 | **Application lifecycle & review states**: "… server-side validation and only permitted transitions, so an incomplete or tampered application cannot be submitted." | State machine | Presence-only validation; races | R-05, R-06 | — | Integration | II |
| 23 | **Member dashboard & event registration**: "Journey status, application progress, registered events, and event registration with capacity respected." | Yes | Capacity race; fake progress; past events | C-02, R-05, R-07 | — | Parallel test | II |
| 24 | **Notification centre**: "In-app and email notifications with read state, raised as applications, events and bookings progress." | Applications only | Events, bookings notifications | R-07, LB-05 | F-07 | E2E | PD |
| 25 | **Lab & facility registry**: "Every bookable lab across KIIT — department, equipment, capacity, operating hours and the staff who run it — maintained by lab heads themselves." | Infrastructure collection (no hours, no staff) | All | LB-02 | HD-16 | Head edits own lab only | ND |
| 26 | **Availability calendar & slot engine**: "Bookable slots generated from each lab's operating hours, with double-booking made impossible at the database level, and blackout dates…" | None (overlap check is race-prone) | All | LB-03 | LB-01 | Concurrency test | ND |
| 27 | **Booking request flow**: "A founder picks a lab, sees live availability, chooses a slot and states purpose, headcount and equipment needed." | Minimal form, no purpose/headcount/equipment | Most | LB-04 | HD-16 | E2E | PD |
| 28 | **Lab-head approval console**: "A request queue per lab, with approve, reject with a reason, or propose an alternative slot — and a record of who decided what, and when." | None | All | LB-05 | LB-01 | E2E + audit rows | ND |
| 29 | **Lab assistant assignment & roster**: "An approved slot gets a named assistant, who sees their own upcoming duty schedule…" | None | All | LB-06 | — | Authz test | ND |
| 30 | **Booking ticket & signed QR pass**: "… cryptographically signed QR code, tied to that booking, that slot and that person — a screenshot of somebody else's pass does not work." | None | All | LB-07 (§5) | — | Forgery/replay/screenshot tests | ND, **ambiguous (HD-22)** |
| 31 | **Two-sided QR check-in and check-out**: "The student pass is scanned by the assigned lab staff, and the staff pass is scanned by the student. Both sides are recorded…" | None | All | LB-08 | LB-07 | E2E on Android + iOS | ND |
| 32 | **Lab utilisation reporting**: "Bookings, attendance, no-shows and hours used, per lab and per department…" | None | All | LB-09 | LB-08 | Reconciliation | ND |
| 33 | **Application review console**: "Reviewer queue with filters, full applicant detail, decisions with permitted transitions, and an audit trail against every reviewer." | Queue, detail, transitions, audit write | Pagination/search; audit read | R-14 (donor) | — | E2E | PD |
| 34 | **Document handling**: "Uploads to Amazon S3 with real file-type verification, and retrieval that is access-controlled…" | Code; S3 unwired | Credentials, presigned flow | F-06 | S-1 | Staging upload | PD |
| 35 | **Analytics dashboard**: "Activity tracking and the application funnel — how many people start, complete and are accepted." | Exists, untrustworthy | Table-derived funnel | A-01..A-06 | — | Reconciliation | II |
| 36 | **PWA packaging**: "… home-screen install on both Android and iOS…" | None | All | LB-10 | — | Install on Android Chrome + iOS Safari | ND |
| 37 | **Offline shell & background sync**: "A service worker caching the app shell, an offline fallback, and queued actions that sync once signal returns instead of being lost." | None | All | LB-10 (§5) | — | Offline test matrix | ND, **ambiguous: Background Sync API unavailable on iOS; meet via app-level outbox (HD-22)** |
| 38 | **Mobile camera QR scanning**: "In-browser camera scanning … built to work on the patchy Wi-Fi…" | None | All | LB-08 | — | Device matrix | ND |
| 39 | **Cloudflare Turnstile**: "… on sign-up, sign-in, password reset, application submit and booking request, verified server-side…" | None | All | LB-11 | Cloudflare account | Integration | ND |
| 40 | **Rate limiting & abuse controls**: "Per-route token buckets on every sensitive endpoint … enforced in the database…" | DB limiter on 5 routes | Unthrottled endpoints; trusted IP | R-08, C-08 | S-1 | Integration | PD |
| 41 | **Browser hardening**: "Content Security Policy, HSTS, and clickjacking, MIME-sniffing and referrer-leak protection, verified in report-only mode…" | CSP, XFO, nosniff, referrer | HSTS | Q-05 | HTTPS | Header test | PD |
| 42 | **Upload safety**: "… nothing user-uploaded ever served as executable content." | Magic bytes for documents | SVG/XML media | C-07 | — | Integration | II |
| 43 | **Secrets, encryption & audit logging**: "AWS Secrets Manager, least-privilege IAM roles, encryption at rest on RDS and S3, TLS in transit, and an audit log of every privileged action." | Audit on review only | Rest | F-02/F-05, NF-10, R-03 | Account | Config evidence + audit coverage test | ND |
| 44 | **AWS Amplify Hosting**: "Git-connected CI/CD with server-side rendering, per-branch preview environments, atomic deploys and one-click rollback." | None | All | ADR-001r / HD-22 | S-1 | — | ND, **conflicts with Next 16 (§3)** |
| 45 | **Amazon RDS for PostgreSQL 16**: "… encryption, automated backups and point-in-time recovery." | None | All | F-05 | Account | Restore drill | ND |
| 46 | **Amazon S3 & CloudFront**: "Private buckets for applicant documents, CDN delivery for public media, lifecycle rules and signed access." | None | All | F-06 | Account | Staging | ND |
| 47 | **Amazon SES**: "Transactional mail with domain verification and the SPF, DKIM and DMARC records…" | None | All | F-07 | HD-18 | DMARC pass | ND |
| 48 | **Cloudflare edge**: "DNS on the KNEST-supplied domain, TLS, WAF rules and DDoS protection…" | None | All | F-09 | HD-18 | Config evidence | ND, **free-plan WAF limits to confirm** |
| 49 | **Amazon CloudWatch**: "Log aggregation, error and uptime alarms, and alert routing…" | None | All | Q-03, Q-04 | Account | Alarm drill | ND |
| 50 | **Accessibility**: "WCAG 2.1 AA pass across both platforms…" | Partial primitives | Known failures (KN-19) | X-10 | — | Audit report | PD |
| 51 | **Automated tests & flow verification**: "Unit tests over the rules that must not break, plus scripted end-to-end verification of the auth, application and booking flows." | 20 unit tests, curl scripts (auth/app) | E2E; booking | Q-01, Q-02 | — | CI | PD |
| 52 | **Performance & search visibility**: "Image pipeline, load-time tuning, page metadata and social preview cards." | Partial metadata | Images, OG, sitemap | X-11, X-12 | — | Lighthouse | PD |
| 53 | **Documentation, training & handover**: "Architecture, content editing and lab operations documentation, plus a walkthrough for KNEST staff and lab heads." | Product docs | Content-editing and lab-ops docs, training | Q-06, PL-04 | — | Sign-off | PD |

**Delivery summary:** 0 verified; 18 ND; 19 PD; 6 IU; 10 II (total 53).

The invoice's non-module commitments are also unmet: "Production deployment on AWS Amplify, configured and live"; "All AWS and Cloudflare resources … in KNEST-owned accounts, with credentials handed over"; "QR pass and scanning flow working end to end"; "30 days of post-launch defect support" (the window is anchored to a 2026-09-16 issue date for a launch that has not happened).

**AMC obligations that become pre-pilot capabilities:**
- P1 response within 2 business hours, including "lab check-in or QR scanning failing at the lab door";
- a named support channel;
- restore drills;
- CloudWatch alerting;
- monthly releases.
