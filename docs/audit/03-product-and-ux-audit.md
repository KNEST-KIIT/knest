# Product and UX audit
Product and frontend specialists independently inspected source; they did not visually review screens. Root's executed/browser coverage is recorded separately in [10](10-evidence-and-verification-log.md). Source-confirmed control flow is distinguished from unmeasured layout/assistive-technology behavior.

## Journey scorecard
| Persona / journey | Current state | Principal friction / missing acceptance | V1 acceptance |
|---|---|---|---|
| Curious student discover→self-locate→onboard | Substantial implementation | Auth detours lose return path; network recovery; approved real content | Discover a real program, use keyboard/mobile onboarding, reach intended destination |
| Applicant draft→upload→verify→submit | Substantial happy path and tests | Pending state on failed fetch; generic question labels; real storage/mail unverified | Save/reload without loss; valid upload; verification; once-only submit; recoverable errors |
| Applicant tracking / accepted founder | Status and notifications exist | Durable mail and clear next steps; voluntary founder-role transition uncertain | See correct status/question snapshot and understand next action |
| Mentor intake→review→directory | Partial | Intake in app.users, CMS profile separately created; no proved handoff | Explicit manual queue or narrow deferred scope; never imply unseen review occurred |
| Investor/partner contact | Form/inbox implemented | Entry links target absent About anchors | Real CTA→topic→message→handled record; named responder |
| Program manager/reviewer | Queue/detail/state/audit implemented | Draft/private-field exposure, CMS operator acceptance, privilege UI | Publish/edit real program and process submission without developer |
| Super administrator | Role/deactivate workflows exist | Immediate mutation on select; last-admin race | Explicit confirmed changes; at least one active superadmin invariant |
| Lab member/head/assistant | Implemented behind default-off flag | Policy unapproved; F15/F16 lifecycle/privacy/feedback | Separate Pilot-B gate; no production enablement by inference |

No entire journey is classified VERIFIED COMPLETE solely from route/component existence. Accessibility automation and scripted journeys are bounded evidence, not an institutional usability sign-off.

## Canonical product findings
These IDs are the shared finding register. Backlog and estimates reference IDs rather than duplicating complete findings.

### F04 — Approved collection disclosures, content and operational owners missing
**P0 release gate; high confidence in recorded hold.** `docs/delivery/HD-06-PRIVACY-INPUTS.md:3,44` explicitly forbids real student data before approved notice. Privacy/terms pages use `src/components/content/legal-pending.tsx:47–52`; signup lacks a nearby notice/terms link (`src/app/(auth)/signup/signup-form.tsx:110–183`). Copy approval HD-04, privacy/terms HD-06 and named support/operator inputs remain unresolved. This is a project release requirement, not a legal compliance conclusion. Impact: data collection/content publication proceeds without institutional acceptance if ignored. Remedy: identify approvers, supply exact approved policy/copy, connect disclosures and support to collection points. Verify signed/versioned approval and rendered notices in every relevant journey. Do not invent consent wording or assume consent is the lawful basis.

### F09 — Core forms and navigation have misleading or unrecoverable states
**P1; high source confidence; common network failure trigger.**
- Login/signup/app save/upload/submit set pending then await fetch without catch/finally: `(auth)/login/login-form.tsx:24–37`, `signup/signup-form.tsx:24–42`, `(member)/apply/[program]/application-form.tsx:26–33,64–68,96–98,115–121`. A rejected network promise can leave controls blocked. Add bounded errors, finally cleanup, retained inputs and safe retry.
- Auth cross-links omit validated `next`: signup:188; login:124,169. A visitor headed to an application can lose intent by changing auth path. Preserve safe internal return path through both directions/reset.
- Contact entry CTAs target absent `/about#contact` or `#partner`: `site-footer.tsx:22,30`, `invest/page.tsx:135`, `mentors/page.tsx:113`, `onboarding/destination.ts:16`. About has no matching IDs. Use real contact destination/topic and crawl fragment targets.
- Resend `(auth)/verify/resend-button.tsx:9–20` reports Sent regardless of HTTP success and can strand Sending on rejection. Notify me in `programs/[slug]/apply-cta.tsx:22–24,39–41` is a same-page link, not subscription. Check outcomes and remove unsupported promise or separately approve the feature.
- `(staff)/admin/members/member-actions.tsx:47–64` commits role changes on every select onChange and includes super_admin. Immediate deactivation and uncontrolled selection can mislead after rejection. Use controlled proposed state plus explicit action/confirmation and restore on failure.
**Verification:** abort/offline/429/500 scenarios for account/application forms; no duplicate submit after ambiguous response; auth-return matrix; link targets; no privilege POST until an explicit confirmed action. These are source-confirmed defects; exact visual consequences need browser review.

### F17 — Keyboard, mobile overlay and dynamic form accessibility not accepted
**P1; high source and bounded local-browser confidence.** Root opened the menu at 375×900: panel top/bottom 72, height 0, header height 73; navigation overlaps hero content. Resizing the open menu to width 1280 leaves body overflow hidden. See [screenshot](evidence/mobile-menu-375.png) and report 10. These are reproduced local defects, not a full accessibility assessment.
`src/components/layout/site-header.tsx:38–57,168–212` locks body scrolling but does not trap focus/inert background or close on breakpoint change. Keyboard can move into covered content; observed resizing leaves scroll locked. Implement an accessible modal/navigation pattern and restore focus.
`application-form.tsx:245–310` uses generic answer labels detached from actual questions, groups lack coherent accessible names and hidden file input has no explicit focus proxy. `option-list.tsx:26–27,65` uses radio semantics on independently tabbable buttons without standard arrow-key behavior. Prefer native grouped controls, true question labels and field-specific errors; announce progress/outcome and manage focus.
Existing axe scans at 375/1280 widths do not cover all routes/personas/states. Menu-open, form errors, verification confirm/reset confirm, assistant/founder/mentor and application detail need explicit acceptance.
**Verification:** keyboard-only full journeys, mobile menu open/close/resize, NVDA screen-reader flow, 200–400% zoom/reflow, meaningful focus and live feedback, dynamic axe checks. Automated zero serious/critical violations is necessary but insufficient for WCAG acceptance. No numeric accessibility score is asserted.

### F18 — Scope and completion sources conflict
**P1 planning/acceptance gate; high confidence.** README says Phase0/no IaC; current code and templates contradict that. CURRENT_STATE/TRACKER contain historical deployment/branch statements and old counts; LOCAL-COMPLETENESS calls handover TODO although handover files now exist. Original product deferred infrastructure booking; later commercial generator includes labs/QR/PWA, but received commercial document remains unverified. Latest owner records supersede staging and Cloudflare DNS plans. Remedy: accepted versioned V1 scope and one evidence-linked delivery record; preserve historical docs but mark their effective dates. Verify every launch commitment maps to requirement/test/owner; contract variation explicitly signed where needed.

### F19 — Mentor and profile promises lack a complete operational handoff
**P2 by recommended application-first scope; P1 if owner includes these journeys. Medium/high confidence.**
`onboarding/actions.ts:100–118` writes mentor intake into app.users; `payload/collections/mentors.ts:14–15` expects staff-created profile; `dashboard/mentor-view.tsx:26–30` implies review without proved routing. `docs/handover/CONTENT-EDITING-GUIDE.md:187` asks an engineer for user ID. `onboarding/destination.ts:17–20` confirms no /profile despite CONTENT_SPEC:349 promising later edits. Owner must choose minimal manual workflow/profile editing or adjust scope/promises. Verify intake→staff discover→publish linked profile without engineer, or truthful deferral.

### F20 — Event-count dashboard is not a cohort conversion funnel
**P2; high confidence.** `src/server/analytics/funnel.ts:19–25` counts cumulative events; `track.ts:9–18,26–36` cannot persist anonymous session cookie during Server Component render. Repeated events and visitor identity make conversion inference unsafe. Keep truthful labels, define time window/unique person/cohort and reconcile outcomes against operational tables. Add minimal activation/submission/decision/error metrics; defer elaborate analytics.

### F23 — Performance/design inconsistencies lack measured impact
**P2; static confidence high, user impact unmeasured.** Undefined token uses `--color-line-strong`/`--radius-xl`, raw hero image (`hero.tsx:50–53`), desktop-hidden priority auth image, some lab wrappers and horizontal tables need rendered measurement. Do not undertake cosmetic redesign before launch-blocking journeys. Measure image payload, LCP/CLS/INP and reflow on representative phones/slow network; fix material budgets first.

## V1 product acceptance and launch metrics
Proposed assumptions for owner adoption: small institutional pilot, real approved programs, named staff, 20 concurrent interactive users and up to 1,000 registered accounts initially. These are planning values, not observed traffic.
Acceptance: all core journeys including denied access and network interruption; staff publish/review/enquiry handling without engineer; clear honest empty/loading/error/success states; no invented availability/benefits; accessible mobile/keyboard experience; approved data-use notices; support escalation.
Track daily synthetic journey health, HTTP failures, draft→verified submission outcome, decision lead time, enquiry response and delivery failures. Business conversion targets require a baseline and owner decision; do not invent success percentages.

