# Test execution report — in progress

> **27 October remediation qualification:** The failures below are preserved as the
> original audit baseline. After the documented repairs, the exact local candidate
> passed 66 unit files / 620 assertions; 36 integration files / 440 assertions with
> one documented expected failure; a Next.js 16.4.3 production build; zero-error
> TypeScript and ESLint; the bundle budget; and 35/35 synthetic-persona browser
> assertions. The production dependency audit exits 0 with no actionable finding
> and one documented moderate build/dev-only exception. This does not satisfy the
> hosted infrastructure, provider, recovery, legal, or owner-acceptance gates.

The full audit is incomplete. Only the following executed cohorts have current evidence. No overall pass percentage is claimed.

## Target and isolation

Application code: `ab6a09e435de317e68dde24fa92b2e4295067bcd`. Later commits `14301a0` and `fc36e9d` add audit documentation only. Fresh build ID: `Lw3CverOiOmTG7DcoR-qH`. A hash comparison of all 490 inventoried source files currently matches the code baseline. Tests run against disposable API fixtures and a separate audit-only loopback UI cluster; saved user sandbox data and real Google credentials were not used.

## Code and API execution

| Cohort | Result | Evidence / scope |
| --- | --- | --- |
| Fresh production build | PASS | `build-result.json`, `build.log`; provider endpoints deliberately unreachable during compilation, so this is not runtime integration acceptance. |
| Strict typecheck | PASS | `typecheck.log` |
| Full lint | PASS | `lint.log`: 0 errors, 1 existing unused PASSWORD warning in integration test 70. |
| Design token lint | PASS | `design-token-lint.log`; static check only. |
| Unit assertions | 587 PASS | 60 files; individual results in `unit-execution-ledger.json` and `units.json`. |
| API assertions | 283 ordinary PASS; 1 expected FAIL; 3 NOT RUN | 27 files; individual results in `api-execution-ledger.json`. Framework pass count 284 includes the expected failure. |
| CMS REST create role boundary | 135 PASS | `cms-acl-matrix.json`: 9 actors × 15 collections including the hidden Staff mirror; 28 allowed fixture records, 107 denied writes. Does not accept UI/edit/delete/publish coverage. |
| Shared Field hint/error variant probe | FAIL | `component-probe.json`; QA-001, isolated supported variant. |

The API expected failure is the analytics rotating-forwarded-IP case KN-22c. Its test harness deliberately trusts that header; it does not prove the deployed edge accepts spoofed addresses. The two browser QR cases were excluded from CLI execution and remain NOT RUN. The migration drift case was excluded because it writes generated migrations under src; an isolated-copy equivalent is still to execute.

## Reviewed browser and additional ownership cases

| Case | Status | Evidence |
| --- | --- | --- |
| WEB-HOME-01 — Homepage choices reveal useful next action | PASS | `homepage-choice-results.json`, `signup-journey-browser.json`, `signup-before-db.json`, `signup-after-db.json` |
| WEB-HOME-02 — Homepage radio keyboard operation | FAIL | `homepage-radio-keyboard.json` |
| WEB-HOME-03 — Homepage choice survives a refresh | FAIL | `homepage-refresh-choice.json` |
| WEB-NAV-01 — Public navigation and footer destinations | PASS | `header-navigation.json`, `footer-navigation.json`, `header-auth-navigation.json`, `public-navigation-console.json` |
| WEB-NAV-02 — Mobile menu focus and reachability | PASS | `mobile-menu-anonymous.json`, `mobile-menu.json` |
| WEB-404-01 — Global and detail not-found boundaries | FAIL | `404-boundaries.json` |
| WEB-AUTH-01 — Password login validation and recovery | PASS | `password-login-browser.json` |
| WEB-ONB-01 — Onboarding role radio keyboard operation | FAIL | `onboarding-radio-keyboard.json` |
| WEB-ONB-02 — Onboarding invalid profile URL recovery | FAIL | `profile-url-error.json`, `student-onboarding-browser.json` |
| WEB-RES-01 — File-only resource remains reachable | FAIL | `content-fixtures.json`, `file-only-resource-browser.json`, `file-only-resource-detail.json`, `resource-file-api.json` |
| WEB-PRG-01 — Expired open program shows truthful application state | FAIL | `expired-program-browser.json`, `expired-program-api.json` |
| API-OWNERSHIP-01 — Mailbox verification does not retain an attacker-controlled account | FAIL | `ownership-probe.json` |
| WEB-ONB-03 — Student completion persists answers and reaches recommended programs | PASS | `student-onboarding-browser.json`, `student-onboarding-db.json` |
| WEB-AUTH-02 — New signup validates the correct field and preserves homepage intent through verification | FAIL | `signup-password-error.json`, `signup-journey-browser.json`, `signup-before-db.json`, `signup-after-db.json` |
| WEB-APP-01 — Application entry creates a draft only after Start | PASS | `application-entry-browser.json`, `application-before-entry-db.json`, `application-after-entry-get-db.json`, `application-draft-start-db.json` |
| WEB-APP-02 — Required answers save and resume across exit/reload | PASS | `application-resume-browser.json`, `application-saved-text-db.json` |
| WEB-APP-03 — Configured choice questions and optional URL validation | FAIL | `application-choice-url-errors.json`, `application-rejected-upload-db.json`, `application-review-ready-db.json` |
| WEB-APP-04 — Document upload rejects invalid/large files and accepts a real PDF | PASS | `upload-fixture-manifest.json`, `application-invalid-upload-browser.json`, `application-oversize-upload-browser.json`, `application-valid-upload-browser.json`, `application-rejected-upload-db.json`, `application-review-ready-db.json`, `application-document-download.json` |
| WEB-APP-05 — Review editing and reload preserve the application | PASS | `application-review-browser.json`, `application-review-ready-db.json`, `application-document-download.json` |
| WEB-APP-06 — Submission confirms and creates durable receipt/notifications | PASS | `application-submit-browser.json`, `application-submission-effects.json`, `application-receipt-browser.json`, `application-submitted-db.json`, `application-receipt-reopened-db.json` |
| WEB-APP-07 — Student dashboard makes its saved draft discoverable | FAIL | `student-draft-discovery.json`, `application-saved-text-db.json` |
| WEB-REV-01 — Reviewer queue filters submitted work and protects drafts | PASS | `reviewer-queue-browser.json`, `reviewer-control-draft.json`, `reviewer-document-api.json`, `reviewer-boundaries-browser.json` |
| WEB-REV-02 — Reviewer moves only through legal statuses with private internal note | PASS | `reviewer-transition-browser.json`, `review-transition-effects.json`, `application-accepted-db.json`, `applicant-accepted-browser.json`, `applicant-response-privacy.json` |
| WEB-ADM-01 — Admin audit trail exposes the exact application transition history | PASS | `admin-audit-browser.json`, `review-transition-effects.json`, `applicant-audit-boundary-browser.json` |
| WEB-REV-03 — Rejection and waitlist branches remain actionable | PASS | `review-branch-fixtures.json`, `reviewer-rejection-browser.json`, `reviewer-waitlist-browser.json`, `reviewer-waitlist-resolved-browser.json`, `applicant-rejected-browser.json`, `applicant-waitlisted-browser.json`, `applicant-waitlist-resolved-browser.json`, `review-branches-waitlisted-db.json`, `review-branches-resolved-db.json` |
| WEB-CMS-01 — CMS complex field labels and required-publish recovery | FAIL | `cms-label-validation-discovery.json`, `cms-event-keyboard-controls.json` |
| WEB-CMS-02 — Event draft/publish/edit/unpublish lifecycle | FAIL | `cms-event-draft.json`, `cms-event-anonymous-draft-browser.json`, `cms-event-published-public.json`, `cms-event-revision-draft.json`, `cms-event-revision-browser.json`, `cms-event-revision-published-browser.json`, `cms-event-unpublished.json`, `cms-event-unpublished-browser.json` |
| WEB-CMS-03 — Event slug generation, uniqueness and rename stability | PASS | `cms-event-draft.json`, `cms-event-revision-published-browser.json`, `cms-duplicate-slug-replayed.json`, `cms-duplicate-slug-recovery.json` |
| WEB-CMS-04 — CMS role ownership across all collections | NOT RUN | No complete execution evidence; see reviewed case ledger for partial work. |
| WEB-CMS-05 — Program/cohort/startup/founder relationships surface once | FAIL | `relationship-fixtures.json`, `relationships-startup-published.json`, `relationship-startup-public-initial-browser.json`, `relationship-accepted-prerequisite.json`, `relationships-founder-accepted.json`, `relationship-founder-dashboard-browser.json`, `relationship-founder-dashboard.png`, `relationship-delete-protection.json`, `relationship-program-excludes-draft-browser.json`, `relationship-startup-draft-public-browser.json`, `relationship-program-includes-startup-browser.json`, `relationship-startup-program-moved-browser.json`, `relationship-program-a-after-move-browser.json`, `relationship-program-b-includes-startup-browser.json`, `relationship-startup-directory-browser.json`, `relationship-founder-update-propagated-browser.json`, `relationship-story-order.json`, `relationship-story-reordered-browser.json`, `relationships-story-reordered.json` |
| WEB-CMS-06 — Mentor editorial review, taxonomy and linked dashboard | PASS | `relationships-mentor-draft.json`, `mentor-draft-owner-dashboard-browser.json`, `mentor-self-publish.json`, `relationships-program-linked-draft-mentor.json`, `mentor-draft-program-exclusion-browser.json`, `mentor-draft-public-detail-browser.json`, `relationships-mentor-published.json`, `mentor-published-owner-dashboard-browser.json`, `mentor-published-program-browser.json`, `mentor-owner-public-profile-browser.json`, `mentor-filters-browser.json`, `mentor-unavailable-directory-browser.json`, `mentor-unavailable-detail-browser.json`, `relationships-mentor-unpublished.json`, `mentor-unpublished-editor-browser.json`, `mentor-unpublished-owner-dashboard-browser.json`, `mentor-unpublished-directory-browser.json`, `mentor-unpublished-detail-browser.json`, `mentor-unpublished-program-exclusion-browser.json` |
| WEB-CMS-07 — Hosted and external resources/articles remain actionable | NOT RUN | No complete execution evidence; see reviewed case ledger for partial work. |
| WEB-CMS-08 — Homepage fixed sections and content controls | FAIL | `homepage-baseline-browser.json`, `homepage-narrative-control-browser.json`, `homepage-person-disabled.json`, `homepage-person-disabled-browser.json`, `homepage-problem-disabled.json`, `homepage-problem-disabled-browser.json`, `homepage-api-duplicate-keys.json`, `homepage-duplicate-keys-browser.json`, `homepage-api-reorder-control.json`, `homepage-valid-order-browser.json`, `homepage-api-restore.json`, `homepage-final-restored.json`, `homepage-restored-browser.json` |
| WEB-CMS-09 — Testimonials, FAQ and metrics validation/privacy | FAIL | `cms-safeguards.json`, `testimonial-unchecked-before-browser.json`, `testimonial-unchecked-saved-browser.json`, `testimonial-ui-unchecked-state.json`, `testimonial-ui-corrected-state.json`, `homepage-curation-privacy-check.json` |
| WEB-CMS-10 — Partner/infrastructure publication and relationships | NOT RUN | No complete execution evidence; see reviewed case ledger for partial work. |
| WEB-CMS-11 — Media accessible metadata, replacement and role restrictions | NOT RUN | No complete execution evidence; see reviewed case ledger for partial work. |
| WEB-CMS-12 — Event date/registration-target validation and public behavior | FAIL | `cms-event-inverted-dates.json`, `cms-event-inverted-dates-browser.json`, `cms-event-malformed-registration.json`, `cms-registration-malformed-browser.json`, `cms-event-valid-restored-browser.json` |
| WEB-EVT-01 — Signed-out registration preserves event through password login | PASS | `event-anonymous-signup-entry.json`, `event-login-return-browser.json` |
| WEB-EVT-02 — Native registration persists, confirms and appears in Your events | PASS | `event-effects-baseline.json`, `event-registration-browser.json`, `event-your-events-browser.json`, `event-effects-before-duplicates.json`, `event-mail-decoded.json` |
| API-EVT-03 — Duplicate registration is idempotent | PASS | `event-api-duplicates.json`, `event-effects-before-duplicates.json`, `event-effects-after-duplicates.json` |
| WEB-EVT-04 — Capacity and cancellation free a seat | PASS | `event-capacity-browser.json`, `event-api-full-refusal.json`, `event-effects-full-refusal.json`, `event-cancel-browser.json`, `event-cancel-list-browser.json`, `event-effects-after-cancel-observed.json`, `event-freed-seat-browser.json`, `event-effects-freed-seat-claimed.json`, `event-evidence-reconciliation.json` |
| WEB-EVT-05 — Public event filters, reset, empty and calendar download | PASS | `event-filters-browser.json`, `cms-event-stage-fixture.json`, `event-calendar-download-browser.json`, `event-calendar-downloaded.ics`, `event-evidence-reconciliation.json` |
| COMP-SUMMARY-01 — Shared filtered result summary uses singular and plural agreement | FAIL | `result-summary-probe.json`, `event-filters-browser.json`, `event-filter-one-result.png` |
| WEB-CMS-13 — Authenticated staff permission refusal explains the role restriction | FAIL | `cms-permission-owned-control.json`, `cms-permission-refusal-browser.json`, `cms-permission-owned-return-browser.json`, `cms-content-role-dashboard.json` |
| WEB-CMS-14 — Homepage curated testimonials and metrics affect the public page | FAIL | `homepage-curated-editor-browser.json`, `homepage-curated-controls.json`, `homepage-curation-privacy-check.json`, `homepage-curated-public-browser.json`, `homepage-api-restore.json`, `homepage-final-restored.json` |
| WEB-CMS-15 — Accepted founder can discover the startup linked to their editorial profile | FAIL | `relationship-fixtures.json`, `relationships-startup-published.json`, `relationship-startup-public-initial-browser.json`, `relationship-accepted-prerequisite.json`, `relationships-founder-accepted.json`, `relationship-founder-dashboard-browser.json`, `relationship-founder-dashboard.png` |
| WEB-MENTOR-01 — Every expertise choice filters the published mentor directory and toggles off | PASS | `mentors-public-oracle.json`, `mentor-filters-browser.json`, `relationship-evidence-reconciliation.json` |
| WEB-MENTOR-02 — Mentor need-selector radio supports arrow selection and roving focus | FAIL | `mentor-radio-keyboard.json` |

All raw evidence paths are relative to Git-ignored `test-results/qa-2026-10-22/`. Browser input masking is respected; input value reads were not used to claim preservation. Successful login after changing only the password and the resulting backend/profile state provide the stated evidence.

Public desktop navigation clicked all six header destinations, both auth links, the header brand and all 18 local footer links. Fragment targets exist. Captured warning/error console entries for that run were empty. A control timeout interrupted the initial footer loop; its unsaved intermediate observations were not treated as passes. The per-link run was repeated with incremental evidence saving.

## Outstanding coverage

The initial 306 case families are not 306 executed tests. Every route, expanded CMS state, staff workflow, member role branch, form error/retry, document upload, filter, responsive state, notification, lab/QR state and applicable design variant still needs detailed reconciliation against atomic evidence. The explicit reviewed ledger now has 48 cases: 22 PASS, 22 FAIL and 4 NOT RUN. A FAIL can include a reproduced substep with other substeps incomplete; exact execution notes remain in the ledger. They include the first complete application/upload/submission/receipt path, reviewer acceptance/rejection/waitlist and a focused admin audit-trail check. This case set does not exhaust the initial catalogue: further roles, search/contact, remaining public filter variants, event expiry/external/failure/concurrency branches, remaining CMS operations, admin modules and labs remain to reconcile and execute. Physical devices, real assistive technology, production hosting and institutional approvals are not established by this audit.

## CMS and event continuation

Nine draft-enabled and five non-draft CMS collections were reviewed against their schemas, global controls, role map, content clients and audit hooks. Twelve CMS cases were separately reviewed before replay; 4 remain NOT RUN with any partial evidence stated. The 135 REST POST assertions accept only the current coarse create-ownership boundary, not every CMS operation or institutional policy.

The actual Event editor lifecycle exercised derived slug, private draft, publish, saved revision, published revision, real Unpublish and duplicate-slug correction. Public isolation and stable rename URLs work; saving a revision falsely records cms.unpublish (QA-013). Event date/select/relationship/rich-text naming fails (QA-012). Publishing an inverted date range and a bare external registration target produces actual public failures (QA-014/QA-015); those fictional values were restored before registration tests.

Native registration was exercised across signed-out signup/login return, durable first registration, reload, Your events/View event, duplicate POSTs, two-seat capacity, third-actor refusal, cancellation and reuse of the freed seat. Exact database, notification, local email and analytics effects reconcile. Canonical MIME decoding corrected an audit-helper subject-filter miss; it was not an application delivery failure. The real calendar download is 458 bytes and agrees with the published title, location, UTC times and absolute local link. Actual type/format/stage filter, empty, refresh and reset states work. One-result default summary grammar fails separately (QA-016).

Browser-control calls stalled and the control runtime reset during this work. The same live app/gateway handles were revalidated, saved effects inspected and retained tabs rebound before continuing. These tool delays are not application performance evidence. No app restart, production operation or application-code repair resulted from them. Nine reconciliation assertions validate the saved event evidence; they are not additional independent feature cases.

## Homepage and content safeguards continuation

The scoped content-admin session was tested through its actual dashboard, Homepage editor, testimonial create/edit and refused Program create. This adds a specific role replay, not acceptance of every staff role or CMS operation. The permission boundary works; its authenticated-denial wording fails separately (QA-020).

Homepage values were backed up before any modification. Real CMS saves changed hero/narrative copy and section toggles. The Person flag is ignored and the Problem flag controls all three narrative blocks (QA-017). A ten-row REST update with a duplicate Hero key and missing Person key was accepted and duplicated the visible hero (QA-018). A valid API order swap correctly changed visible section order. Keyboard sorting was attempted using the displayed Space/arrow instructions, remained on the same target, and was cancelled; pointer sorting and the cause of that keyboard result remain unaccepted. This is retained as partial evidence, not a completed sorting test.

Ten actual REST validation/privacy assertions produced eight PASS and two FAIL. Explicit false and omitted testimonial consent both saved and remained publicly readable; the actual unchecked CMS form reproduced the same failure (QA-019), and correcting the UI fixture updated the same record. Overlong quote, missing FAQ answer and missing metric source/date were correctly rejected. Valid records created, and internal metric source was absent from anonymous detail and populated Homepage relationships.

The actual Featured tab selected one valid consented testimonial and one dated/sourced metric. Both persisted and populated, but their attribution/quote/label were absent from the reloaded homepage (QA-021). Other featured program/startup/event and hero-media variants remain unexecuted. FAQ HTML/edit/order and remaining role/CRUD branches are not accepted by this cohort.

After the toggle, duplicate, valid-order and curation variants, every original editable homepage value was restored exactly; the final public heading sequence matches the baseline. Thirteen saved-evidence consistency checks pass (`homepage-evidence-reconciliation.json`), without being counted as independent feature coverage. All fixture data remains local and ignored. No application code or deployment changed.

## Relationship graph and mentor lifecycle continuation

Actual scoped CMS forms created Program A, its Cohort, a linked Founder and a two-stage Startup. A second program and two fresh member accounts were explicit isolated prerequisites, not evidence that onboarding works. Draft startup access was refused and absent from the settled program page; publishing exposed the exact directory/detail/program graph. One cohort relation change moved the startup from Program A to B on both program pages and its own detail. A single founder edit propagated without copying data. A real story-heading edit and supported REST order update retained row IDs and changed actual public order; pointer/keyboard story dragging is not accepted by that API result.

A new application on this fresh program caused its real DELETE endpoint to refuse with 409 and leave the program intact. Only the new fictional application was then submitted and moved through legal review statuses to establish the accepted-founder prerequisite. Before the cohort move, its exact account/profile/startup/program graph was verified; the founder dashboard omitted the linked startup and route (QA-022). The original accepted application remains accepted with its five answer rows and one document, checked separately against its prior snapshot.

The Mentor workflow created an unpublished editorial profile linked to a fresh mentor member. The member’s self-publish request returned 403. A draft reference on a public program exposed only its numeric relationship ID, not private profile content; the page remained usable and the owner saw its honest pending state. Staff publication updated the directory, public detail, program and linked dashboard. Each of the nine expertise choices was actually clicked and its exact card set compared with unfiltered published metadata. Four empty expertise categories and positive matches were observed; clicking the active choice cleared it. Availability changed from open to unavailable while remaining listed after open/limited mentors. Actual Unpublish withdrew public detail, directory, program content and the linked-account profile while retaining the editable staff draft. This functional lifecycle passes; its radio ArrowDown behavior fails as an additional QA-002 variant.

The original snapshot helper signed in on each run and eventually failed. A diagnostic replay returned 429; the first failed call had not retained its status and is not retroactively treated as an independently proven 429. Evidence reads were changed to one existing scoped staff session held only in process memory. No rate limit, account permission or security setting was reset/relaxed. That helper session is closed after this cohort. Twenty-nine evidence-reconciliation checks pass; they validate saved observations and are not additional independent feature cases.
