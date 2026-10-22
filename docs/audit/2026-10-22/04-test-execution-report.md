# Test execution report — in progress

The full audit is incomplete. Only the following executed cohorts have current evidence. No overall pass percentage is claimed.

## Target and isolation

Application code: `ab6a09e435de317e68dde24fa92b2e4295067bcd`. Later commit `14301a0` adds draft audit documents only. Fresh build ID: `Lw3CverOiOmTG7DcoR-qH`. A hash comparison of all 490 inventoried source files currently matches the code baseline. Tests run against disposable API fixtures and a separate audit-only loopback UI cluster; saved user sandbox data and real Google credentials were not used.

## Code and API execution

| Cohort | Result | Evidence / scope |
| --- | --- | --- |
| Fresh production build | PASS | `build-result.json`, `build.log`; provider endpoints deliberately unreachable during compilation, so this is not runtime integration acceptance. |
| Strict typecheck | PASS | `typecheck.log` |
| Full lint | PASS | `lint.log`: 0 errors, 1 existing unused PASSWORD warning in integration test 70. |
| Design token lint | PASS | `design-token-lint.log`; static check only. |
| Unit assertions | 587 PASS | 60 files; individual results in `unit-execution-ledger.json` and `units.json`. |
| API assertions | 283 ordinary PASS; 1 expected FAIL; 3 NOT RUN | 27 files; individual results in `api-execution-ledger.json`. Framework pass count 284 includes the expected failure. |
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

All raw evidence paths are relative to Git-ignored `test-results/qa-2026-10-22/`. Browser input masking is respected; input value reads were not used to claim preservation. Successful login after changing only the password and the resulting backend/profile state provide the stated evidence.

Public desktop navigation clicked all six header destinations, both auth links, the header brand and all 18 local footer links. Fragment targets exist. Captured warning/error console entries for that run were empty. A control timeout interrupted the initial footer loop; its unsaved intermediate observations were not treated as passes. The per-link run was repeated with incremental evidence saving.

## Outstanding coverage

The initial 306 case families are not 306 executed tests. Every route, expanded CMS state, staff workflow, member role branch, form error/retry, document upload, filter, responsive state, notification, lab/QR state and applicable design variant still needs detailed reconciliation against atomic evidence. The 25 explicitly reviewed cases now have execution results. They include the first complete application/upload/submission/receipt path, reviewer acceptance/rejection/waitlist and a focused admin audit-trail check. This case set does not exhaust the initial catalogue: further roles, public filters/search/events/contact, CMS operations, admin modules, failure/concurrency variants and labs remain to reconcile and execute. Physical devices, real assistive technology, production hosting and institutional approvals are not established by this audit.
