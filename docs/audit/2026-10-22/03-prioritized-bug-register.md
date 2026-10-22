# Prioritized bug register — in progress

Only reproduced current findings are listed. No application code was changed. Raw fixture evidence stays Git-ignored.

## QA-004 — P1 — Mailbox verification retains credentials and sessions chosen before mailbox ownership

Affected: `src/server/auth/actions.ts`.

Reproduction:
1. Actor A registers a fictional mailbox using a password A knows.
2. A signs in before verification and retains the resulting session.
3. Mailbox owner B consumes the captured local verification link in a separate actor context.
4. A reuses its old session and signs in again with the original password.

**Expected:** Mailbox ownership confirmation must not promote a pre-registered attacker-controlled password/session into persistent access to the verified account.

**Actual:** Signup 202; unverified login 200 with session; owner verification 200 with another session and verified DB flag; A old session returns account page 200 with fixture email; A original password still logs in 200. Three fixture sessions exist.

**Evidence:** `test-results/qa-2026-10-22/ownership-probe.json`, `test-results/qa-2026-10-22/ownership-probe.mjs`.

**Verified root cause:** loginWithPassword does not check emailVerified. confirmEmailVerification only sets the verification timestamp and creates a session; it neither replaces the original password nor revokes pre-verification sessions.

**Recommended fix:** Design an ownership-safe activation flow that proves the mailbox before establishing its password, or forces the mailbox owner to establish a fresh credential and revokes earlier sessions. Blocking pre-verification login alone does not invalidate an attacker-known password after verification.

**Limits:** Local fictional actors only. Requires prior registration and the mailbox owner consuming that verification link. No actual victim, production exploit, staff elevation or data exfiltration was tested. Historical handover D-01 already suspected this; current replay independently confirms it.

## QA-002 — P2 — Declared radio groups omit arrow-key selection and roving focus

Affected: `src/app/(public)/journey-selector.tsx`, `src/components/ui/option-list.tsx`.

Reproduction:
1. Select the first homepage choice or the Student onboarding role.
2. Press ArrowDown while that radio is focused.
3. Inspect focus, checked state and tab stops; compare Tab then Space.

**Expected:** Arrow keys move focus and selection within the declared radio group; only its active option is a normal tab stop.

**Actual:** ArrowDown leaves the first radio focused and checked; every option has tabIndex 0. Tab and Space can still select another role.

**Evidence:** `test-results/qa-2026-10-22/homepage-radio-keyboard.json`, `test-results/qa-2026-10-22/onboarding-radio-keyboard.json`, `test-results/qa-2026-10-22/application-choice-url-errors.json`, `test-results/qa-2026-10-22/screenshots/home-radio-arrow.png`.

**Verified root cause:** Both controls render ordinary buttons with role=radio and onClick but no arrow-key handler or managed tabIndex.

**Recommended fix:** Use a native radio group or implement the complete radio keyboard pattern in the reusable control and homepage selector.

**Limits:** Not total keyboard inoperability: Tab/Space work. Homepage, onboarding role and application-stage choice variants reproduced; other SingleSelect instances still require execution.

## QA-005 — P2 — Onboarding URL error does not identify or focus its invalid field

Affected: `src/app/(member)/onboarding/onboarding-flow.tsx`.

Reproduction:
1. Use fictional Student onboarding and reach profile.
2. Enter not-a-url in LinkedIn and press Continue.
3. Inspect focus and the URL input aria-invalid / aria-describedby.
4. Correct to a valid fictional URL and retry.

**Expected:** The failed field is marked invalid and associated with its error; focus moves to a useful error or invalid input.

**Actual:** The alert says That doesn’t look like a URL. LinkedIn still has aria-invalid=false and no aria-describedby. Focus is BODY. Retry remains enabled; correcting the URL reaches recommendation.

**Evidence:** `test-results/qa-2026-10-22/profile-url-error.json`, `test-results/qa-2026-10-22/screenshots/profile-url-error.png`.

**Verified root cause:** advance stores a single string error rendered after the fields. Field receives no error prop and advance does not focus the invalid control or error.

**Recommended fix:** Return field-specific validation errors, pass them through Field, and focus the first invalid field or an accessible summary.

**Limits:** Error is visible and announced as an alert, and correction succeeds. This is an error identification/focus defect, not a stuck-form claim.

## QA-007 — P2 — Signup password validation neither marks nor focuses the invalid password

Affected: `src/app/(auth)/signup/signup-form.tsx`.

Reproduction:
1. Follow the homepage Idea CTA to signup.
2. Enter valid fictional name and email, and short as the password.
3. Submit and wait for the validation response.
4. Inspect input error attributes and focus, then correct only the password and retry.

**Expected:** UX_WIREFRAMES lines 248–251 require an inline associated error, aria-invalid and focus on the first invalid field: password in this case.

**Actual:** Alert says Use at least 12 characters. Password remains aria-invalid=false and describes only its normal hint. No input has focus. Retry succeeds after changing only the password.

**Evidence:** `test-results/qa-2026-10-22/signup-password-error.json`, `test-results/qa-2026-10-22/screenshots/signup-password-error.png`, `test-results/qa-2026-10-22/signup-journey-browser.json`.

**Verified root cause:** Signup stores a single form error without passing errors to Field. Its error handler always attempts nameRef.focus(), regardless of which field failed. The comment paraphrases the specification incorrectly as first-field focus.

**Recommended fix:** Map validation errors to their actual fields, associate those errors and focus the first invalid control after pending/disabled state has cleared.

**Limits:** The password is correctly refused and retry works. No stuck signup or silent acceptance is claimed. The timing reason why the name focus attempt did not persist is not separately proven.

## QA-008 — P2 — Published file-only resources have no usable public entry point

Affected: `src/app/(public)/resources/page.tsx`, `src/server/content/resources.ts`.

Reproduction:
1. As the fictional content role upload the audit PNG through /api/media.
2. Publish a resource with that file, required metadata, no body and no externalUrl through /api/resources.
3. As an anonymous visitor activate its public resource card.
4. Inspect the direct detail route and anonymously retrieve the uploaded file as a diagnostic.

**Expected:** A published downloadable resource has an actionable card that reaches its file or a detail page containing the download.

**Actual:** The card href is # and activation remains on the resource listing with no download. Its direct detail route returns the branded not-found boundary. The file itself returns HTTP 200 image/png with a valid PNG signature.

**Evidence:** `test-results/qa-2026-10-22/content-fixtures.json`, `test-results/qa-2026-10-22/file-only-resource-browser.json`, `test-results/qa-2026-10-22/file-only-resource-detail.json`, `test-results/qa-2026-10-22/resource-file-api.json`, `test-results/qa-2026-10-22/screenshots/file-only-resource.png`, `test-results/qa-2026-10-22/screenshots/file-only-resource-detail-404.png`.

**Verified root cause:** The listing chooses a detail URL only when body is truthy, otherwise externalUrl or #; it ignores file. getResourceBySlug additionally requires body exists, excluding the valid file-only resource from detail lookup.

**Recommended fix:** Resolve resource targets consistently for hosted body, downloadable file and external URL; allow file-backed detail routes or link directly to the file. Validate records with no usable target.

**Limits:** Fictional PNG-only resource supported by the current Media allow-list. No claim about unsupported document MIME types or the source-similar search result path, which has not yet been clicked.

## QA-009 — P2 — Expired open-status program advertises Apply and returns an unexplained loop

Affected: `src/app/(public)/programs/[slug]/apply-cta.tsx`, `src/app/(member)/apply/[program]/page.tsx`.

Reproduction:
1. As the fictional program manager publish an open-status program with yesterday’s deadline.
2. Open the program anonymously from its listing; inspect the status and Apply CTA.
3. Follow Apply through signup to the login link and authenticate as the onboarded fictional student.
4. Activate Apply again and inspect the returned page; read the apply response redirect marker and draft count in the audit DB.

**Expected:** Effective deadline and visible status agree. An expired program explains closure and offers a useful alternative without sending the person through account setup or a loop.

**Actual:** Listing/detail say Applications open, detail says Closes yesterday, and Apply sends an anonymous visitor into signup. After login, Apply returns to that same program with the same Apply link and no closure explanation. The apply response embeds a redirect back to the program; no draft exists for that fixture.

**Evidence:** `test-results/qa-2026-10-22/content-fixtures.json`, `test-results/qa-2026-10-22/expired-program-browser.json`, `test-results/qa-2026-10-22/expired-program-api.json`, `test-results/qa-2026-10-22/screenshots/expired-program.png`.

**Verified root cause:** ApplyCta chooses the open branch solely by applicationStatus and never applies closedReason. The private apply page checks the deadline and redirects a new applicant back to the public page, assuming it explains closure; the public page does not.

**Recommended fix:** Use the same effective availability decision in public status/CTA and private application entry, and render the deadline-based closed reason with a useful next action.

**Limits:** The server correctly prevents creation of a new expired-program draft. This is misleading availability and an auth/application-entry loop, not a deadline bypass. HTTP 200 in the code probe carries the documented Next streaming meta redirect, not successful application entry.

## QA-010 — P2 — Student dashboard hides the saved application draft

Affected: `src/app/(member)/dashboard/student-view.tsx`, `src/app/(member)/dashboard/page.tsx`.

Reproduction:
1. As the verified fictional student start Validation Bootcamp and save its first two answers.
2. Use Save and exit to reach Your applications, where the draft and Continue link are visible.
3. Reload, then use the header Dashboard link.
4. Inspect every dashboard link and section; compare the saved draft in the database and the known application list.

**Expected:** Journey 2 requires the dashboard to show Draft — continue so the student can return to unfinished work without rediscovering the program.

**Actual:** The application list shows the draft and backend retains both answers. The main student dashboard has only the generic recommendation, events and resources; no draft summary, Continue action or link to /dashboard/applications is present.

**Evidence:** `test-results/qa-2026-10-22/student-draft-discovery.json`, `test-results/qa-2026-10-22/application-saved-text-db.json`, `test-results/qa-2026-10-22/application-resume-browser.json`, `test-results/qa-2026-10-22/screenshots/student-missing-draft.png`.

**Verified root cause:** DashboardPage renders StudentDashboard for this role. StudentDashboard queries events/resources and a generic recommendation, but no applications; its global navigation also has no applications destination.

**Recommended fix:** Surface the student’s active draft and an applications entry point, with a prominent Continue action when a draft exists.

**Limits:** The draft is not lost: the known application list and the public program can still recover it. Failure concerns discoverability from the specified dashboard, not storage or total inability to resume.

## QA-011 — P2 — Application URL validation leaves the invalid answer unmarked and unfocused

Affected: `src/app/(member)/apply/[program]/application-form.tsx`.

Reproduction:
1. Reach the optional website/demo URL question in the fictional Validation Bootcamp draft.
2. Enter not-a-url and choose Save & continue.
3. Inspect the visible error, input description/invalid attributes and current focus.
4. Clear the optional URL and continue.

**Expected:** The rejected answer is identified as invalid and associated with its error, with focus directed to useful correction guidance.

**Actual:** The alert says That doesn’t look like a URL. The URL input has aria-invalid=false and no aria-describedby, and focus is BODY. The form remains retryable and an empty optional URL saves successfully.

**Evidence:** `test-results/qa-2026-10-22/application-choice-url-errors.json`, `test-results/qa-2026-10-22/application-rejected-upload-db.json`, `test-results/qa-2026-10-22/screenshots/application-url-error.png`.

**Verified root cause:** ApplicationForm stores only a form-level error string and never passes it into Field or focuses an invalid control. Its heading-focus effect runs only when question/review/submitted state changes, not on validation failure.

**Recommended fix:** Associate validation errors with the current answer control, set its invalid state and focus it or an accessible summary after pending state clears.

**Limits:** Validation itself rejects the URL and the user can recover. This is not an accepted-invalid-value or stuck-form claim. It reproduces the same class of error-handling gap seen in other forms, in a separate application component.

## QA-001 — P3 — Shared Field leaves a dangling hint description in its error variant

Affected: `src/components/ui/field.tsx`.

Reproduction:
1. Render the actual Field with both hint and error and its Input child.
2. Inspect aria-describedby on the input and the IDs in the rendered HTML.

**Expected:** Each description ID supplied by the shared component resolves to an existing element.

**Actual:** aria-describedby references both error and hint; the hint element is not rendered while error is present.

**Evidence:** `test-results/qa-2026-10-22/component-probe.json`, `test-results/qa-2026-10-22/field-error-render.html`.

**Verified root cause:** Field creates hintId whenever hint is non-empty, includes it in describedBy, but renders the hint only when !error.

**Recommended fix:** Only reference a rendered hint, or keep the hint rendered together with the error.

**Limits:** No current caller passes Field.error. This is a confirmed shared-component variant defect, not a demonstrated task-blocking page issue or complete WCAG failure.

## QA-003 — P3 — Homepage journey selection is cleared by refresh

Affected: `src/app/(public)/journey-selector.tsx`.

Reproduction:
1. Select I HAVE AN IDEA on the homepage.
2. Reload before following its CTA.
3. Inspect all checked options and the response panel.

**Expected:** The remembered selection specified by UX_WIREFRAMES.md line 116 and CONTENT_SPEC.md line 188 survives refresh.

**Actual:** Idea is checked before reload; all five options are unchecked afterward.

**Evidence:** `test-results/qa-2026-10-22/homepage-refresh-choice.json`.

**Verified root cause:** Selection is held only in useState(null); the component has no persistence. Stage is encoded only in the onward CTA URL.

**Recommended fix:** Confirm the current persistence requirement, then persist and restore the selection if it remains required.

**Limits:** Requirement mismatch against accessible specifications. The URL-based CTA handoff itself is not alleged broken; no later approved removal of the refresh requirement was established.

## QA-006 — P3 — Detail not-found boundary renders nested main landmarks

Affected: `src/app/(public)/layout.tsx`, `src/components/layout/not-found-page.tsx`.

Reproduction:
1. Open /programs/audit-missing-program-20261022.
2. Inspect main landmarks and compare an unknown top-level route.
3. Follow Search from the global boundary and Go home from the detail boundary.

**Expected:** Both recovery pages have one main landmark and one h1.

**Actual:** Detail boundary has two main elements, one nested in the other, and one h1. Global boundary has one main and one h1. Recovery links work.

**Evidence:** `test-results/qa-2026-10-22/404-boundaries.json`, `test-results/qa-2026-10-22/screenshots/detail-404.png`.

**Verified root cause:** PublicLayout wraps children in main; the shared NotFound component also returns main.

**Recommended fix:** Separate the not-found content from its document landmark wrapper so each layout owns exactly one main.

**Limits:** Reproduced public program detail only; other route-group boundaries remain to execute. No task-blocking navigation issue claimed.
