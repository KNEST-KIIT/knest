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
1. Focus a selected homepage, onboarding-role, application-stage or mentor-need radio; the mentor replay uses Product.
2. Press ArrowDown while that radio is focused.
3. Inspect focus, checked state and tab stops; compare Tab then Space.

**Expected:** Arrow keys move focus and selection within the declared radio group; only its active option is a normal tab stop.

**Actual:** ArrowDown leaves the selected radio focused and checked; every option remains a tab stop. Product remains selected on the mentor filter and its URL stays expertise=product. Pointer filtering still works.

**Evidence:** `test-results/qa-2026-10-22/homepage-radio-keyboard.json`, `test-results/qa-2026-10-22/onboarding-radio-keyboard.json`, `test-results/qa-2026-10-22/application-choice-url-errors.json`, `test-results/qa-2026-10-22/screenshots/home-radio-arrow.png`, `test-results/qa-2026-10-22/mentor-radio-keyboard.json`.

**Verified root cause:** Both controls render ordinary buttons with role=radio and onClick but no arrow-key handler or managed tabIndex.

**Recommended fix:** Use a native radio group or implement the complete radio keyboard pattern in the reusable control and homepage selector.

**Limits:** Not total keyboard inoperability: Tab/Space can operate these buttons. Homepage, onboarding-role, application-stage and mentor-need variants are reproduced. Other SingleSelect contexts and assistive-technology behavior remain to execute.

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

## QA-012 — P2 — Event editor complex fields have no programmatic names or usable label targets

Affected: `src/payload/collections/events.ts`, `@payloadcms/ui 3.90.2 DateTime and Select field renderers`.

Reproduction:
1. Open the Event create form as the fictional super-admin.
2. Inspect the accessible names and DOM label associations of Starts At, Ends At, Event Type, relationships and Description.
3. Activate the visible Starts At and Event Type labels and inspect focus; compare the correctly named Title field.

**Expected:** Every visible editable field has a programmatic name, and its label focuses the actual control.

**Actual:** Both date inputs and all seven select/relationship comboboxes have no accessible name. Description contenteditable is unnamed. Date/select labels point to wrapper divs instead of their inputs; activating them leaves BODY focused. Title is correctly labelled.

**Evidence:** `test-results/qa-2026-10-22/cms-label-validation-discovery.json`, `test-results/qa-2026-10-22/cms-event-keyboard-controls.json`, `test-results/qa-2026-10-22/screenshots/cms-event-fields.png`.

**Verified root cause:** The installed DateTime renderer gives the wrapper the field ID without passing a matching ID to DatePickerField. Select similarly gives its wrapper the field ID while its actual input has a generated react-select ID. DOM inspection confirms missing names on the rich-text control; that renderer has not been independently traced.

**Recommended fix:** Provide input IDs/label associations and accessible names for the date, select/relationship and rich-text controls, using supported Payload customizations or a verified upstream repair; regression-check their actual rendered DOM.

**Limits:** Reproduced on the Event editor. No framework-wide acceptance, total keyboard-inoperability, screen-reader replay or proven version-upgrade fix is claimed. Tab reaches the rich-text field; its separate Tab behavior remains unassessed.

## QA-013 — P2 — Saving a draft revision records a false content-unpublish action

Affected: `src/payload/audit-hooks.ts`.

Reproduction:
1. Create and publish a fictional Event.
2. Change its title/summary and choose Save Draft, preserving the previously published version.
3. Compare anonymous REST/detail content and the base published row with the latest draft and new audit action.
4. Use the real Unpublish control afterward and compare the actual removal behavior.

**Expected:** A saved draft revision is distinguishable from taking published content offline; audit action semantics match the public-state effect.

**Actual:** Save Draft records cms.unpublish with published-to-draft labels while anonymous detail/REST still returns the original published title and the base row remains published. The later actual Unpublish also records cms.unpublish and does remove public access.

**Evidence:** `test-results/qa-2026-10-22/cms-event-revision-draft.json`, `test-results/qa-2026-10-22/cms-event-revision-browser.json`, `test-results/qa-2026-10-22/cms-event-unpublished.json`, `test-results/qa-2026-10-22/cms-event-unpublished-browser.json`.

**Verified root cause:** auditAfterChange classifies any transition of returned document _status from published to draft as cms.unpublish. A saved draft revision has that status even though Payload retains the published base document, so the hook confuses revision status with actual publication state.

**Recommended fix:** Distinguish saving a draft revision from withdrawing the published document and record actions using the effective publication operation/state.

**Limits:** Event draft/public isolation works in the replay. This finding concerns misleading audit semantics, not content leakage or loss. Other draft-enabled collections are source-similar but not replayed.

## QA-014 — P2 — Event editor publishes an end date before its start, hiding registration for a future event

Affected: `src/payload/collections/events.ts`, `src/app/(public)/events/[slug]/page.tsx`.

Reproduction:
1. On the fictional event keep the future start time and change Ends At to yesterday.
2. Choose Publish changes and inspect persisted dates and public detail.
3. Restore the valid future end time and verify the native Register action returns.

**Expected:** Publishing rejects an end time earlier than the start and explains the invalid range.

**Actual:** Publish succeeds and both staff/anonymous REST and the base database retain the inverted range. The public page displays the future start date alongside Finished and This event has finished, with no registration action. Restoring a valid end returns Register.

**Evidence:** `test-results/qa-2026-10-22/cms-event-inverted-dates.json`, `test-results/qa-2026-10-22/cms-event-inverted-dates-browser.json`, `test-results/qa-2026-10-22/screenshots/cms-event-inverted-dates.png`, `test-results/qa-2026-10-22/cms-event-valid-restored-browser.json`.

**Verified root cause:** Events defines independent date fields without a cross-field range validator. EventDetail uses endsAt in preference to startsAt for finished status, so an accepted earlier end overrides the future start.

**Recommended fix:** Validate event time ranges before publication and consistently handle invalid legacy ranges across event availability and calendar surfaces.

**Limits:** Fictional local CMS input only; no deployed provider or real attendee was affected. The separate calendar fallback was inspected in source but not executed for the inverted fixture.

## QA-015 — P2 — Malformed external event registration URL publishes a dead-end Register action

Affected: `src/payload/collections/events.ts`, `src/app/(public)/events/[slug]/page.tsx`.

Reproduction:
1. Set Registration Url to a nonempty value without a scheme on the fictional future event.
2. Publish and activate the actual public Register link.
3. Inspect the new tab destination, then clear the field and verify native registration returns.

**Expected:** An external registration target is validated or safely normalized before publication, and Register reaches a usable destination.

**Actual:** The bare value is accepted and persisted. Register uses it unchanged as href; the browser opens a relative local event-detail URL that renders the branded not-found page. Clearing it restores the native registration button and signed-out signup return path.

**Evidence:** `test-results/qa-2026-10-22/cms-event-malformed-registration.json`, `test-results/qa-2026-10-22/cms-registration-malformed-browser.json`, `test-results/qa-2026-10-22/screenshots/cms-registration-dead-end.png`, `test-results/qa-2026-10-22/cms-event-valid-restored-browser.json`, `test-results/qa-2026-10-22/event-anonymous-signup-entry.json`.

**Verified root cause:** registrationUrl is an unvalidated text field, and EventDetail renders it directly as an external anchor rather than checking an absolute supported URL.

**Recommended fix:** Validate the optional external target as an absolute HTTP(S) URL and expose actionable inline correction before publication; defend rendering of legacy malformed targets.

**Limits:** Actual activation used a local malformed target only. No external organizer, unsafe-script URL or external-registration completion was tested.

## QA-017 — P2 — Homepage narrative section toggles do not control their own sections

Affected: `src/app/(public)/page.tsx`, `src/app/(public)/narrative.tsx`.

Reproduction:
1. Back up the isolated homepage and use the content-admin editor to fill distinct fictional Problem, Person and KNEST copy.
2. Verify all three render with all sections enabled.
3. Turn Person off and save; compare the stored flag and the public page.
4. Turn Person back on, turn Problem off and save; compare the remaining enabled sections.
5. Restore every original editable homepage value.

**Expected:** Each of the three exposed section toggles independently controls its own public content, as the editor description promises.

**Actual:** Person enabled=false persists, but its heading/body still render. With Problem disabled and Person/KNEST enabled, all three narrative sections disappear. Hero copy changes work, and original settings were restored exactly.

**Evidence:** `test-results/qa-2026-10-22/homepage-narrative-control.json`, `test-results/qa-2026-10-22/homepage-narrative-control-browser.json`, `test-results/qa-2026-10-22/homepage-person-disabled.json`, `test-results/qa-2026-10-22/homepage-person-disabled-browser.json`, `test-results/qa-2026-10-22/homepage-problem-disabled.json`, `test-results/qa-2026-10-22/homepage-problem-disabled-browser.json`, `test-results/qa-2026-10-22/homepage-api-restore.json`, `test-results/qa-2026-10-22/homepage-restored-browser.json`.

**Verified root cause:** HomePage renders the entire Narrative component only for the problem key. Narrative contains all three sections; the person and knest switch cases return null, ignoring their independent enable/order entries.

**Recommended fix:** Render each narrative section under its own key or expose an honestly grouped narrative control, preserving the approved independent-section requirement unless that requirement is explicitly changed.

**Limits:** Fictional content-admin changes in the isolated local cluster only. Valid API ordering of other sections works; pointer sorting and the unaccepted keyboard-sort attempt are separate from this confirmed toggle defect.

## QA-018 — P2 — Homepage accepts duplicate fixed section keys and renders duplicate heroes

Affected: `src/payload/globals/homepage.ts`, `src/server/content/homepage.ts`, `src/app/(public)/page.tsx`.

Reproduction:
1. Use the reviewed original ten-section backup in the isolated audit cluster.
2. As an authorized fictional content editor send the global update with ten rows, replacing the Person key with a second Hero key.
3. Read the stored keys and reload the actual homepage.
4. Replace the fixture with a valid section order, then restore the full original homepage.

**Expected:** The server enforces the fixed unique section set, not merely its row count, and rejects a duplicated key/missing section.

**Actual:** The update returns HTTP 200 and retains two hero keys with no person key. The public homepage renders two copies of the hero and two h1 headings. Original values were restored exactly afterward.

**Evidence:** `test-results/qa-2026-10-22/homepage-api-duplicate-keys.json`, `test-results/qa-2026-10-22/homepage-duplicate-keys-browser.json`, `test-results/qa-2026-10-22/screenshots/homepage-duplicate-hero.png`, `test-results/qa-2026-10-22/homepage-api-reorder-control.json`, `test-results/qa-2026-10-22/homepage-valid-order-browser.json`, `test-results/qa-2026-10-22/homepage-api-restore.json`, `test-results/qa-2026-10-22/homepage-final-restored.json`.

**Verified root cause:** The global array validates only minRows/maxRows=10 and allowed individual select values. key is readOnly only in the editor UI; no validator enforces uniqueness/completeness. enabledSections returns the entries unchanged and HomePage maps duplicate keys to duplicate components.

**Recommended fix:** Validate the complete fixed key set and reject duplicates/missing keys at the server; safely handle already-invalid stored arrays in rendering.

**Limits:** Requires an authorized content-editor request; anonymous writes or privilege escalation are not alleged. The malformed array was a deliberately reviewed local fixture and was restored. Two h1 elements describe the duplicated visible hero, not a blanket WCAG failure claim.

## QA-019 — P2 — Unconsented testimonials save successfully and are anonymously readable

Affected: `src/payload/collections/testimonials.ts`.

Reproduction:
1. As the fictional content admin create a synthetic testimonial with explicit consentGiven=false, then one with that field omitted.
2. In the actual CMS form fill Quote/Attribution, leave Consent Given unchecked and choose Save.
3. Read those exact synthetic records anonymously through REST and compare persisted consent.
4. Check consent on the UI fixture and save again to verify correction without another record.

**Expected:** The affirmative public-consent safeguard rejects or keeps private a quote whose consent has not been given.

**Actual:** Both false and omitted consent requests return 201, and the real unchecked form also saves. Anonymous detail requests return 200 with the attributed quote and consentGiven=false. Correcting the UI fixture to true works. The 401-character quote is separately refused.

**Evidence:** `test-results/qa-2026-10-22/cms-safeguards.json`, `test-results/qa-2026-10-22/testimonial-unchecked-before-browser.json`, `test-results/qa-2026-10-22/testimonial-unchecked-saved-browser.json`, `test-results/qa-2026-10-22/testimonial-ui-unchecked-state.json`, `test-results/qa-2026-10-22/testimonial-api-false-editor-browser.json`, `test-results/qa-2026-10-22/screenshots/testimonial-consent-false-full.png`, `test-results/qa-2026-10-22/testimonial-ui-corrected-state.json`, `test-results/qa-2026-10-22/testimonial-corrected-browser.json`.

**Verified root cause:** The schema declares consentGiven as a required checkbox without an affirmative-value validator. The installed Payload checkbox validator checks that a required value is boolean, so false is valid; omitted input is stored false. The non-draft collection uses readAlways without filtering consent.

**Recommended fix:** Require affirmative consent for public testimonial publication and ensure legacy/unconsented records are excluded from anonymous reads; retain a safe staff correction workflow.

**Limits:** All names/quotes are explicitly fictional. Only local staff-authorized writes and public API reads were tested; no real person was quoted or real consent decision made. Homepage rendering of selected valid quotes is a separate finding.

## QA-021 — P2 — Homepage saves curated testimonials and metrics without rendering them

Affected: `src/payload/globals/homepage.ts`, `src/app/(public)/page.tsx`.

Reproduction:
1. Select one valid consented fictional testimonial and one dated/sourced fictional metric through the actual Homepage Featured tab.
2. Save and verify both IDs and populated anonymous global relationships.
3. Reload the homepage and inspect its complete main content for the selected attribution/quote and metric label.
4. Restore the original homepage settings and confirm their public baseline.

**Expected:** Curations exposed as homepage controls affect the public homepage, while the internal metric source remains private.

**Actual:** Both selections save and populate correctly in the anonymous global. The selected attribution, quote and metric label are absent from the public homepage. Source redaction does work in the populated metric relationship. Restoring original values succeeds.

**Evidence:** `test-results/qa-2026-10-22/homepage-curated-editor-browser.json`, `test-results/qa-2026-10-22/homepage-curated-controls.json`, `test-results/qa-2026-10-22/homepage-curation-privacy-check.json`, `test-results/qa-2026-10-22/homepage-curated-public-browser.json`, `test-results/qa-2026-10-22/homepage-api-restore.json`, `test-results/qa-2026-10-22/homepage-final-restored.json`.

**Verified root cause:** HomePage reads the global but never consumes its testimonials or metrics relationships and has no renderer for either. Its independently computed ecosystem counts are not the selected Metrics collection content.

**Recommended fix:** Connect the supported curated content to its approved homepage surfaces, or remove/clarify unused controls if the approved scope explicitly excludes them.

**Limits:** Reproduced only for selected testimonial/metric fields with valid synthetic metadata. Other featured program/startup/event and hero-media controls remain unexecuted; no broad field-completeness claim is made. No production content was changed.

## QA-022 — P2 — Accepted founder dashboard omits the startup linked to their editorial profile

Affected: `src/app/(member)/dashboard/founder-view.tsx`, `src/payload/collections/founders.ts`.

Reproduction:
1. Create a fresh fictional founder account and publish a founder profile whose userId points to that account.
2. Publish its startup linked to that founder and a cohort in Program A; verify the public program/startup/founder relationship.
3. Use the actual submission and legal reviewer routes to move only this fresh founder’s own Program A application to accepted.
4. Sign in as that founder and inspect every dashboard section and main-content link before changing the cohort’s program.

**Expected:** Journey 3’s accepted-founder view shows YOUR STARTUP with its current stage/program context and a useful route to the linked public startup.

**Actual:** The dashboard shows the accepted program as the next step, the application, notifications, labs and resources, but neither the linked startup’s name nor a startup/profile link. The same startup and founder relation are present on the public program/detail pages. No application or CMS relation was lost.

**Evidence:** `test-results/qa-2026-10-22/relationship-fixtures.json`, `test-results/qa-2026-10-22/relationships-startup-published.json`, `test-results/qa-2026-10-22/relationship-startup-public-initial-browser.json`, `test-results/qa-2026-10-22/relationship-accepted-prerequisite.json`, `test-results/qa-2026-10-22/relationships-founder-accepted.json`, `test-results/qa-2026-10-22/relationship-founder-dashboard-browser.json`, `test-results/qa-2026-10-22/screenshots/relationship-founder-dashboard.png`.

**Verified root cause:** FounderDashboard queries the user’s applications/program/resources only. It does not use Founders.userId or query startups whose founders include the linked editorial profile, so the stored account link has no dashboard consumer.

**Recommended fix:** Resolve the founder’s linked editorial profile/startup and surface its name, current stage and public profile route alongside the existing application/program context, without inventing a private workspace.

**Limits:** Fresh fictional account was already platformRole=founder, and its exact linked Program A application was accepted through actual local routes. This does not test automatic role promotion or the separate acceptance-offer hypothesis. The original accepted application and other saved data were preserved. Public relationship propagation works; this is a missing account-facing consumer, not missing storage.

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

**Evidence:** `test-results/qa-2026-10-22/404-boundaries.json`, `test-results/qa-2026-10-22/screenshots/detail-404.png`, `test-results/qa-2026-10-22/relationship-startup-draft-public-browser.json`, `test-results/qa-2026-10-22/mentor-draft-public-detail-browser.json`, `test-results/qa-2026-10-22/mentor-unpublished-detail-browser.json`.

**Verified root cause:** PublicLayout wraps children in main; the shared NotFound component also returns main.

**Recommended fix:** Separate the not-found content from its document landmark wrapper so each layout owns exactly one main.

**Limits:** Reproduced program, startup and mentor public-detail not-found boundaries. Recovery links were exercised on the original global/program replay; other route-group boundaries remain unexecuted. No task-blocking navigation issue is claimed.

## QA-016 — P3 — One filtered result uses the plural verb in the shared result summary

Affected: `src/lib/result-summary.ts`, `src/app/(public)/events/page.tsx`.

Reproduction:
1. Filter the fictional event listing to Workshop and Idea so exactly one card matches.
2. Inspect its visible count and live-region summary.
3. Call the actual shared resultSummary helper for one, two and zero filtered events.

**Expected:** The one-result default summary reads 1 event matches your filters.; plural and zero-result variants remain grammatically correct.

**Actual:** Visible count and live region say 1 event match your filters. The actual helper produces the same string; its two- and zero-result variants pass.

**Evidence:** `test-results/qa-2026-10-22/event-filters-browser.json`, `test-results/qa-2026-10-22/screenshots/event-filter-one-result.png`, `test-results/qa-2026-10-22/result-summary-probe.json`.

**Verified root cause:** resultSummary pluralizes the noun based on count but always uses match your filters as its default filtered suffix.

**Recommended fix:** Apply singular/plural agreement to the default verb while preserving explicit custom qualifiers.

**Limits:** P3 copy-only defect: filtering and the numerical count are correct. Other list pages use the helper in source but were not browser-replayed for this variant.

## QA-020 — P3 — CMS permission denial tells an authenticated staff member to log in

Affected: `@payloadcms/next 3.90.2 UnauthorizedView`, `CMS Program create view`.

Reproduction:
1. Use the content-admin session that can edit Homepage and its own synthetic testimonial.
2. Navigate to Program create, which is outside that role’s write area.
3. Read the denial heading and body actions, then return to the owned testimonial without signing in again.

**Expected:** The refused operation is explained as a role restriction, with useful recovery for the already-authenticated staff member.

**Actual:** Creation is correctly refused, but the heading says Unauthorized, you must be logged in to make this request. The body offers Log out. The existing session remains valid on returning to the owned editor.

**Evidence:** `test-results/qa-2026-10-22/cms-content-role-dashboard.json`, `test-results/qa-2026-10-22/cms-permission-owned-control.json`, `test-results/qa-2026-10-22/cms-permission-refusal-browser.json`, `test-results/qa-2026-10-22/screenshots/cms-content-forbidden-create.png`, `test-results/qa-2026-10-22/cms-permission-owned-return-browser.json`.

**Verified root cause:** The installed UnauthorizedView selects its permission-specific heading only when user exists and global canAccessAdmin is false. A content admin has global access but lacks collection-create permission, so this branch uses the generic sign-in error text.

**Recommended fix:** Distinguish missing authentication from collection permission denial and offer a return to the staff member’s accessible content area.

**Limits:** P3 explanation/recovery issue. Server authorization works; this is not a login failure, session loss or privilege bypass. The navigation shell remains, so a total dead end is not claimed.
