# KNEST local product review — 18 October 2026

The review workspace is http://review.localhost:3100/. Sixteen independent fictional sessions were opened and their landing screens verified in the in-app browser. Student first visit lands on onboarding; the other sessions reach their role destinations. This verifies sign-in and landing screens, not every feature or complete workflow.

Checks for this setup: TypeScript passed; the changed login component passed ESLint; the local platform health endpoint returned 200; the review helper rejected an unknown host and a mismatched browser origin with 403. Student, founder and administrator retained their separate identities after refresh. Server-rendered login HTML uses POST and disables inputs before hydration. The scripts are outside the repository's ESLint file set; they were covered by TypeScript and the running helper checks. No new full-suite acceptance claim is made.

## Walkthrough order

| Experience | Current destination | What to review |
| --- | --- | --- |
| Student, first visit | student.localhost:3100/onboarding | Is the reason for each question clear? Can someone find a useful next step without learning KNEST terminology? |
| Returning student | student-ready.localhost:3100/dashboard | Can someone pick a suitable program, save an application, return and understand its status? |
| Founder | founder.localhost:3100/dashboard | Can someone see their venture's progress and the one action needed next? |
| Investor | investor.localhost:3100/dashboard | Can someone find relevant ventures or request the right introduction? |
| Mentor | mentor.localhost:3100/dashboard | Can someone understand profile approval, assigned programs and how to contribute? |
| Alumni / partner | alumni.localhost:3100/dashboard; partner.localhost:3100/dashboard | Is there a clear contribution path for this role? |
| Reviewer | reviewer.localhost:3100/admin/applications | Can a reviewer find assigned work, assess it and hand it back without guessing? |
| Program manager | manager.localhost:3100/admin/overview | Can a manager publish programs, triage applications and manage decisions? |
| Administrator | admin.localhost:3100/admin/overview | Can staff see urgent work, ownership and delivery failures? |
| Content / startup / mentor management | content.localhost:3100/admin; startupmanager.localhost:3100/admin; mentormanager.localhost:3100/admin | Is publishing understandable, with clear draft, preview and published states? |
| Lab administrator | labadmin.localhost:3100/admin/labs | Can staff configure an operable lab without missing a prerequisite? |
| Lab head / assistant | labhead.localhost:3100/dashboard/lab-staff/local-test-lab; assistant.localhost:3100/dashboard/lab-staff/local-test-lab | Can staff process requests, run attendance and handle exceptions? |

Labs remain an optional sandbox feature, separate from the previously proposed application-first launch scope.

## Proposed journey

| Stage | User outcome | Product behavior to aim for | Completion evidence |
| --- | --- | --- | --- |
| Discover | Know whether KNEST can help | Plain-language entry points by intent; show eligibility, effort and timing before asking for an account | User finds a relevant opportunity and can explain why it fits |
| Join | Reach the intended opportunity | Preserve the original destination through signup, verification and login; ask only necessary information | User returns to that opportunity without searching again |
| Onboard | Receive a useful first recommendation | Ask role and current goal; explain why; show progress; permit later profile enrichment | One relevant primary action appears |
| Apply | Submit confidently | State required documents and deadline upfront; show saved state, resume point, field errors and final confirmation | Draft survives revisit; submitted receipt and status appear |
| Review | Move work to the next owner | Assigned queue, decision context and safe document access; distinguish internal notes from applicant messages | Ownership and decision history agree with the applicant's status |
| Track | Know what is happening | Show current stage, last update, next responsible person and expected response window | Applicant sees the same meaningful status staff recorded |
| Respond | Complete the next action | Link notifications directly to the requested action; clearly explain revisions, outcomes and contact options | Action removes the pending task across relevant views |
| Return | Continue without relearning | Dashboard prioritizes unfinished work; retain drafts and useful context; recover from network failures | User can resume the intended task without a new search |

For investor, mentor, alumni and partner journeys, define the operating handoff before promising introductions, matching, meetings or dashboards that do not yet exist.

## Observed friction and priorities

1. **Sign-in before hydration — repaired during this setup.** A browser submission before React attached used the form's default GET method and put fictional login fields in its URL. The form now explicitly uses POST and keeps its fields and submit button disabled until the client is ready. Server-rendered HTML checks confirm the safeguards; subsequent real browser logins reach the correct portals. This change does not implement a full no-JavaScript sign-in flow.
2. **Investor, alumni and partner goals need more definition.** These roles currently use the student-style dashboard component. Investor and partner show “Let's find the right conversation”; alumni shows “Start with events and the fundamentals. No idea required.” A shared layout is fine, but its main action should serve the person's actual intent.
3. **The first useful action is weakened by empty content.** The returning student view shows no matching events and no resources. The founder has no applications. The reviewer queue is empty. These are legitimate empty states, but a realistic review needs a connected fictional scenario: an open opportunity, a draft, a submitted application, an assigned reviewer, an outcome and its notification. Do not invent production activity to fill these screens.
4. **Staff navigation changes abruptly between operational views and CMS.** The operational header calls it “Full admin”; the CMS calls itself the “KNEST Operating System.” Use clear names and a reliable return path. Prefer the role's actual work queue on first arrival.
5. **CMS rendering remains a known issue.** The content and specialist management shells render in the browser, but the development CMS reports document-layout hydration issues. Do not consider that shell accepted merely because its screen appears. Repair the document boundary before deeper CMS acceptance.
6. **Lab review needs a complete request-to-attendance scenario.** The head and assistant consoles currently have empty request/schedule/history sections. Their permissions differ correctly in the initial visible controls, but a populated end-to-end handoff still needs to be exercised.

## Review method

Start with the student first-visit tab. For each screen, ask: “What am I here to do?”, “What happens next?”, and “What happens if I leave or something fails?” Record the expected result, actual result and the smallest change that removes the uncertainty. Finish one application journey across student, reviewer and manager before polishing secondary screens.

Track task completion, time to first useful action, unnecessary steps, points requiring staff help and recovery from interruptions. Establish a measured baseline before setting improvement targets. The outcome to optimize is a completed real task, not the number of screens or visual effects.

## Student → reviewer → administrator: implemented review

One fictional local student completed onboarding and applied to the demo program. The same application was followed through reviewer and administrator screens to a fictional acceptance. No real applicant or institutional selection decision was involved. A separate local student session was retained for further draft testing; saved account details remain outside Git.

| Friction | Implemented behavior |
| --- | --- |
| Refreshing onboarding returned to step one despite saved answers | The current step is preserved in the URL, including the login return path; refreshing step three resumes step three. Earlier answers remain in the database. |
| Step changes left keyboard focus behind and animated the old question under the new step number | Headings receive focus without scrolling the progress controls out of view; progress is named and announced; transitions respect reduced motion; navigation is disabled while saving. |
| Onboarding completion labels could describe a different destination | A preserved application return path says “Continue to your application”; dashboard return says “Open your dashboard.” |
| Application requirements only appeared after starting | The start screen lists the question count, required count and document requirements. The unsupported fixed “20 minutes” estimate was replaced with the actual question count. |
| Zero-question programs were stranded on “Section 1 of 0” | They open an explicit review explaining that only account details are being submitted, with a working submit action. |
| Returning to a draft always restarted question one | A partially saved draft resumes at the first unanswered question; a fully saved draft reopens review. |
| “Saved automatically” implied that unsaved typing was already safe | The form distinguishes unsaved changes from saved answers, offers save-and-exit, saves before Back, and warns on closing a tab with unsaved answers. |
| Editing one reviewed answer required stepping through the rest again | Each answer has a distinct accessible Edit action; saving it returns directly to review. |
| File control advertised drag-and-drop without implementing it | The control says “Choose a file,” names the document, shows upload activity and permits replacement. Oversized replacements show a clear error and preserve the previous attachment. |
| Applicants could not inspect the uploaded bytes | Owner-only downloads are available in review and the receipt. Anonymous callers and other accounts cannot retrieve the attachment. Staff retain the separate audited download path. |
| Submission returned to a generic list without a readable receipt | Each application has an authenticated receipt with its reference, saved questions/answers, document links, status and last update. Submitted applications remain read-only. |
| Status updates could become stale while switching tasks | The receipt offers Refresh status and refreshes when the document becomes visible again. |
| Notifications and emails required another search for the application | New messages link directly to that application's receipt. The five existing fictional in-app notification links were aligned locally; their content, audit records and captured historical emails were preserved. |
| Messages promised an unconfigured reply date or interview details | Copy now states only the supported next step: the team will notify/contact the applicant. No response deadline or interview appointment was invented. |
| Staff detail was constrained to a narrow 550px shell | The operational shell uses the available width; the review layout stacks below desktop width and wraps long content. |
| Review changes defaulted to a decision and could retain stale selection/note state | The next status starts unselected, fields have labels, successful updates clear the choice and note, and controls stay disabled during the refresh. Final decisions show an explicit warning. |
| Staff could not see the preceding handoff in the application | The detail includes the latest 30 audit updates, actors, timestamps and internal notes. Document access is represented in the history. Internal notes are excluded from the student's receipt and notifications. |
| The reviewer had an irrelevant CMS navigation link | Reviewers see their operational navigation; content-management navigation is shown to roles that manage the relevant areas. |
| Queue empty states did not distinguish a filter mismatch | The queue gives a matching count, explains draft privacy and offers Clear filters when a filter produces no results. |
| Progress text and save controls competed for width on small screens | Application context and save feedback stack on phones, with separate space for exit; review and confirmation actions wrap without forcing horizontal scrolling. |

### Evidence from the local walkthrough

- Saved the first answer, exited, resumed at question two and checked the saved value.
- Rejected an invalid URL while keeping the answer editable. Paused only the local review proxy, reproduced a transport failure, restored it and successfully retried the same preserved answer. The application/database were not stopped for this check.
- Uploaded a valid fictional PDF; student and reviewer downloads matched the original bytes exactly. A file larger than 10 MB was refused without losing the valid attachment.
- Edited the first answer from review and returned directly to review; reloaded a fully saved draft and retained the complete review state.
- Submitted once. The data evidence records one submission audit row, four status transitions (`under_review`, `shortlisted`, `interview`, `accepted`), five durable notifications, five locally captured emails and one staff-document-access audit row.
- The staff-only sentinel note was present in staff history and absent from the student's receipt and notification records.
- Checked the fresh student draft at measured 375px and 390px content widths with no horizontal overflow. After the final focus correction, the progress and save controls remained visible at scroll position zero. The student receipt and administrator history were also inspected at their normal browser widths. This is not real-device accessibility acceptance.
- The fictional upload was created locally and is excluded from Git. The local fixture questions are added only to the dedicated loopback sandbox and do not define an institutional application requirement.

Verification artifacts (browser snapshots, screenshots, data counts and API test reports) are retained under `%LOCALAPPDATA%/KNEST/local-platform/portal-review-2026-10-18`.

### Acceptance limits

This pass covers the student application's local flow and its staff handoff, with local substitutes for email, storage and the human check. It does not accept AWS integrations, public deployment, every onboarding-role permutation, physical mobile devices or the separate CMS shell. The pre-existing CMS document-layout hydration warning remains outside this application flow. Signup verification and recovery were not repeated in this pass; the walkthrough started from the fictional verified account.

Verification: 573 unit tests passed across 58 files; all 38 targeted API checks passed across the document, concurrency and staff-console suites. A further focused owner-download/receipt regression passed after the direct notification links changed, including exact attachment bytes, ownership boundaries, private-note exclusion and receipt URLs in new notifications. The updated browser-test expectations were typechecked; the browser walkthrough itself used the connected in-app browser. Lint reported zero errors and one existing unused-import warning. The production build passed, and both application health and the local email inbox returned HTTP 200.

## Remaining workflows — work in progress

The owner requested the remaining workflow review, then steered the active work to planning and enabling real Google sign-in. The following new changes have **not yet completed release verification**; the previous section's passing build/test totals apply to the preceding student-flow pass only.

- Split the site and Payload into proper root documents using the installed Next.js multiple-root-layout and global-not-found conventions. A fresh CMS browser document had one HTML element, one body and one KNEST title suffix. The CMS create form still appeared disabled in the walkthrough; publishing is not accepted yet and needs diagnosis. Do not call the CMS fully fixed from the document check alone.
- Added contribution destinations for investor, alumni and partner dashboards, direct founder application links, truthful mentor-profile copy, contact topic context and an actionable event empty state.
- A fictional partner enquiry was submitted through the browser and marked handled by the content role. The local event was registered, appeared in Your events, then cancelled with visible feedback.
- Preserved return paths through verification resend and password recovery; added POST/hydration guards to sensitive forms; reused a verification request across Strict Mode effect replay. A newly created fictional account opened its locally captured verification link in the browser, showed Email confirmed, and continued to investor onboarding with the event return path intact. It remains at the profile step.
- Repaired lab request confirmation clearing and missing page refresh, guarded stale availability responses, and held staff actions through refresh. The booking form is open but the request/approval/cancellation walkthrough remains unfinished. A native date-key change triggered availability loading; programmatic date filling alone had not triggered React's date change.
- Added `47-workflow-handoffs.test.ts` for return paths, credential-form hydration guards, password recovery/session revocation and CMS document/shortcut boundaries. It has not yet run.
- A standalone typecheck encountered stale generated `.next/types` references to the removed common root layout. The next complete build must regenerate these and confirm there are no genuine source errors. The subsequent build and lint were deliberately stopped after the 16 GB laptop fell to about 560 MB free memory. Run heavy checks sequentially, with fewer review tabs, after implementation settles. No current build or full-suite success is claimed for these additions.

Evidence and fictional setup details are under the existing private review directory's `other-workflows/` subfolder. Google sign-in planning continues in `GOOGLE-SIGN-IN-PLAN.md`. No deployment, DNS, AWS action or production data change was made in this review.

### Verification update after Google integration

The newer code has now passed **576 unit tests across 59 files** and **49 targeted API checks across five files** (documents, token hygiene, edge/cache controls, complete Google flows and workflow handoffs). The four new workflow handoff checks passed, including one CMS root document and role-appropriate shortcuts. Full lint found zero errors and one existing unused-import warning; a later focused lint of the changed authentication and integration files also passed.

The production build completed, including TypeScript, with the persistent preview database deliberately stopped to reduce memory use. It logged local database connection/fallback warnings during page collection. This is compilation evidence, not hosted or content acceptance. The strict Google callback replay found and led to a repair of NextRequest's local hostname normalization; valid callbacks, stable user identity, same-email linking with session-bound proof, password setup, disabled accounts and missing OAuth cookies are now exercised end to end through HTTP and the database.

The local preview is being resumed with the explicit private Google opt-in. Real Google browser sign-in, CMS form editing/publishing, the lab handoff and remaining role/mobile walkthroughs still need acceptance. The earlier work-in-progress notes describe the walkthrough state before these automated checks; they do not override this newer verification record.

### Live preview and mentor publishing follow-up

- The preview was restarted with `pnpm dev:local --google`; homepage, login and health returned HTTP 200, and the login HTML includes Google alongside email/password. The local test inbox remains on port 8025. All sandbox data and existing account passwords were preserved.
- A real Brave sign-in reached Google's account chooser and the **KNEST Development** consent screen for the KNEST owner account, requesting name, profile picture and email only. The owner subsequently approved this consent. The expired first attempt and successful fresh login are recorded in the follow-up below.
- After a fresh CMS load completed initialization, the mentor form was editable and browser startup logs had no errors. As the fictional mentor-manager account, saved a fictional mentor with Product expertise and linked it to an existing fictional mentor account. The saved Draft state was visible and anonymous API reads returned zero matching documents. Published through the browser; the CMS visibly showed Published and anonymous reads returned one published document. Saved record identifiers remain outside Git.
- The fictional mentor dashboard displays the published profile and **View your public profile** linking to its public detail; this was confirmed in both the browser and the rendered HTTP response. The CMS form, mentor dashboard, portal hub, previous admin application and incomplete fictional onboarding page were retained for review. The temporary mobile viewport override was reset.
- This closes the earlier uncertainty about the mentor editor remaining disabled. It does not accept every collection, unpublishing/media/version restoration, lab approval/attendance or all remaining member-role/mobile paths. Linking a mentor using a raw internal user ID remains a staff-product friction point for a later lookup-based interface.

### Google login recovery — 19 October 2026

The failed consent return had expired its temporary OAuth security check. A fresh real Google sign-in completed successfully, creating a verified ordinary member and opening onboarding. The Account screen confirms Google is connected; logout returned to the public site and a second Google sign-in reused the same account. Local database checks found one Google identity, no Google tokens, no staff permission and one active session. No onboarding choices were submitted for the real owner.

Added clear recovery for expired/missing OAuth cookies, with fresh-start guidance while preserving full state and PKCE validation. The password option stays available. Broader CMS, lab, role and mobile workflow acceptance is unchanged by this authentication check.

The follow-up also found development refreshes interrupting form activation and a third-party verification script that could leave password login pending without explanation. Added a compiled local review mode (`--preview`), a bounded widget load with visible retry, and loopback-only handling of Cloudflare's exact published test site key/token. Server validation remains enabled; public domains and real keys use the normal widget. The final build/type checks, **587 unit tests / 60 files**, and **40 API checks / four files** passed. See the Google sign-in plan for the real-provider and local-browser acceptance record.

### Student, reviewer, admin and lab follow-up — 19 October 2026

Continued the connected in-app browser walkthrough with fictional local accounts. Reopened student onboarding, retained the application return path, corrected an invalid profile URL without losing the entered details, and completed the six-question Validation Bootcamp draft. Uploaded the fictional PDF, inspected the review, saved and exited, resumed at review and submitted once. The reviewer saw the application only after submission, moved it through review and shortlisting, and recorded a private internal note. The administrator moved it through interview to accepted. The student receipt refreshed to Accepted, retained the submitted answers and exposed no internal note. The owner's downloaded PDF matched the fixture bytes exactly.

A second fictional application was followed through the complete handoff. Its identifiers and saved contents remain outside Git; the earlier demo application and its history remain intact. No real owner's onboarding choices, account permissions or password were changed.

Three further repairs arose from this pass:

- Reopening onboarding no longer clears saved skills, graduation year or a mentor's experience when those fields are absent from the visible form. The new retention regression failed against the preceding build, confirming the data-loss defect before the repair.
- The overview's Applications in progress card now opens a matching combined filter for under review, shortlisted, interview and waitlisted. The count and queue share one status definition. Invalid status names, including JavaScript prototype names, are ignored safely.
- A successful lab request now links directly to Your bookings and names that destination in the confirmation. Refreshing availability after a conflicting request preserves the explanatory error.

The fictional founder requested a lab slot; its lab head approved it with a note, the founder saw the note and Approved state, and cancellation changed it to Cancelled. Member management correctly disabled role/deactivation changes on the administrator's own account. No staff access was granted during this browser walkthrough.

The updated compiled build and standalone typecheck passed. All **587 unit tests across 60 files** and **79 targeted API checks across five files** passed (concurrency, document ownership, staff console, lab booking and workflow handoffs). Full lint reported zero errors and one existing unused-import warning in the core browser-test file. The build ran with the local database paused and logged expected connection/fallback warnings during page collection; runtime acceptance used the resumed local preview.

After restart, the browser confirmed the Accepted receipt and complete staff history, the overview's zero-count in-progress filter opening the matching empty queue, and Clear filters restoring both accepted demo applications. A second fictional lab request displayed the new confirmation link; following it opened the correct waiting booking, which was then cancelled. Both test bookings are now Cancelled. Current student, reviewer and admin browser error logs were empty. The application health endpoint and captured-mail inbox returned HTTP 200. Those portals remain open for review.

The persisted application has six frozen questions, five answer rows and one document, exactly one submission audit event, four staff status-change events, five durable notifications and five locally captured emails. No private sentinel note appeared in notification or captured-email content. Evidence is retained under `%LOCALAPPDATA%/KNEST/local-platform/portal-review-2026-10-19/workflow-review`; the build, unit, API and lint logs are in the parent local-platform directory.

This is local workflow acceptance with captured email and local storage. It does not accept public hosting, real provider delivery, physical-device accessibility, QR scanning/offline use or institutional operating policies. All cloud resources and domain settings remain outside this pass.
