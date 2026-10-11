# Accessibility review: manual test script

Audience: a human reviewer who has not seen the code. Target: WCAG 2.2 level AA on every screen
in the inventory below. This script covers what an automated scan cannot see. Allow about one
working day for the full list on two devices.

## What is already automated, and what that means

`tests/integration/35-accessibility.test.ts` runs axe-core (rules tagged WCAG 2.0, 2.1 and 2.2, A
and AA) over every screen in the inventory at 1280 px and 375 px width, fails the build on any
serious or critical finding, and checks the skip link, sideways scroll at phone width, the mobile
menu focus trap, the sign-in network-failure recovery, form labels and the focus ring. It runs in
CI on every push.

A scanner finds roughly a third of real problems. It cannot judge reading order, meaning of link
text, correctness of announcements, usability with a screen reader, cognitive load, or touch use
on a real phone. That is the work below. Nothing in this document has been performed by a human
yet; the result table at the end is empty on purpose.

## Setup

- Browsers: current Chrome on Windows and Safari on iOS (a real phone, not a simulator).
- Screen readers: NVDA with Firefox or Chrome on Windows; VoiceOver with Safari on iOS. TalkBack
  with Chrome on Android if a device is available.
- Other: browser zoom 200% and 400% (equivalent to 320 CSS px), text spacing bookmarklet, Windows
  high contrast (Contrast themes), `prefers-reduced-motion`, a keyboard only.
- Accounts: one student, one lab head, one super administrator. Create them with the seed and
  demo scripts (`pnpm db:seed:demo`) on a non-production database. Do not use real people.
- Record: the commit SHA of the build, the date, the reviewer, and each result in the table.

## Screen inventory

Public: `/`, `/about`, `/programs`, `/programs/<slug>`, `/events`, `/events/<slug>`, `/mentors`,
`/mentors/<slug>`, `/startups`, `/resources`, `/blog`, `/blog/<slug>`, `/ecosystem`, `/invest`,
`/get-involved`, `/contact`, `/privacy`, `/terms`, `/search`, `/login`, `/signup`, `/reset`,
`/verify`, error and not-found pages.

Member: `/onboarding`, `/dashboard`, `/dashboard/applications`, `/dashboard/events`,
`/apply/<program>`, `/dashboard/lab-booking`, `/dashboard/lab-booking/<lab>`, and (when the
attendance flag is on) the booking pass screen `/dashboard/lab-booking/pass`.

Lab head and assistant: `/dashboard/lab-staff`, `/dashboard/lab-staff/<lab>`,
`/dashboard/lab-staff/<lab>/report`, and (flag on) the scanner `/dashboard/lab-staff/scan`.

Staff: `/admin/overview`, `/admin/applications`, `/admin/enquiries`, `/admin/members`,
`/admin/audit`, `/admin/labs`, `/admin/labs/report`, and the Payload editor at `/admin` for
content staff (collection list, edit form, rich-text editor, media upload).

Screens added by other work streams in this release (profile and settings, content additions,
attendance) are listed in the "Added in this release" section at the end of this file as they
land.

## Part A. Keyboard only (every screen)

Unplug the mouse. For each screen:

1. Press Tab from the address bar. The first stop is "Skip to main content" and it is visible.
   Enter moves focus into the main region.
2. Tab through the whole page. Every link, button, field and control is reached; nothing that
   is not interactive is reached; the order matches the visual order (WCAG 2.4.3).
3. The focus ring is visible on every stop and is not hidden behind the sticky header
   (WCAG 2.4.11 Focus Not Obscured). Scroll position follows focus.
4. Enter activates links and buttons, Space activates buttons and checkboxes, arrow keys work
   inside radio groups, tabs, menus and date or time pickers as their pattern requires.
5. There is no keyboard trap. Escape closes the mobile menu, dialogs and menus and returns focus
   to the control that opened them.
6. Any action done by dragging or pointer gestures has a keyboard or single-click path
   (WCAG 2.5.7 Dragging Movements): in this product that applies to the booking time picker and
   the scanner.
7. Forms: submit with Enter in a text field; errors appear, focus moves to the first error or the
   summary, and nothing is lost.

## Part B. Screen reader (NVDA and VoiceOver)

For each of the five flows below, complete the task using only the screen reader with the display
off or the screen covered. Note anything you could not do, or had to guess.

| Flow | Pass condition |
|---|---|
| B1 Sign up, verify, onboard | Every field announces its label, type and required state; password rules are announced before submit; the error summary is announced when it appears (role alert) and not twice; the Turnstile check is operable and its state is announced |
| B2 Browse programs, open one, start an application | Page title changes on navigation and is announced; headings give an outline (one h1, no skipped levels); program stage and status are text, not only colour |
| B3 Fill in and submit an application with a file upload | Autosave state ("Saved", "Saving") is announced politely; the file button states the allowed types and size; upload success and failure are announced; the submit confirmation is announced and focus lands somewhere meaningful |
| B4 Book a lab slot, cancel it | The calendar or slot list is navigable by arrow keys or links; each slot announces date, time and availability; selected state is announced; confirmation and cancellation are announced |
| B5 Staff: review an application, change status, open a document | Table headers are announced with cells; sort and filter controls announce state; status change confirmation is announced; document opens as a download with a sensible name |

Also check on every screen:

- Landmarks: header, nav, main, footer; exactly one main; navigation landmarks labelled when more
  than one.
- Links and buttons have names that make sense out of context ("Read more" repeated is a fail
  unless it has a hidden unique name).
- Images: informative images have text alternatives; decorative images are hidden; the logo link
  announces the site name.
- Live regions: toasts and status messages use `role="status"` or `role="alert"` and do not steal
  focus.
- Tables: real table markup with `th` and scope; the horizontally scrolling tables are reachable
  and announce that they scroll (see Part D).

## Part C. Zoom, reflow, spacing, contrast

1. 200% browser zoom at 1280 px: no loss of content or function.
2. 400% zoom (a 320 CSS px viewport): no two-dimensional scrolling except for data tables and
   the booking calendar; no overlapping text (WCAG 1.4.10).
3. Apply the text-spacing bookmarklet (line height 1.5, paragraph 2x, letter 0.12em, word 0.16em):
   no clipped or overlapping text (WCAG 1.4.12).
4. Text-only zoom in the browser settings to 200%.
5. Windows high contrast (both Contrast themes): every control boundary, focus ring, icon and
   state remains visible; no information is lost.
6. Colour: with a greyscale filter, status badges, availability and errors are still told apart
   by text or icon (WCAG 1.4.1).
7. Contrast spot-check with a colour picker on the light and dark theme: body text 4.5:1, large
   text 3:1, control boundaries and focus rings 3:1 (WCAG 1.4.3, 1.4.11). Include text over
   images in the hero.
8. Orientation: the app works in portrait and landscape on the phone (WCAG 1.3.4).

## Part D. Touch, mobile and device

On a real phone:

1. Every target is at least 24 by 24 CSS px and primary actions are comfortably larger
   (WCAG 2.5.8; the project target for primary actions is 44 px).
2. The mobile menu opens full height, keeps focus inside, closes with Escape and the close
   button, and releases page scroll.
3. The sticky header never covers a focused field when the on-screen keyboard is open.
4. Horizontally scrolling tables show a visible cue that more columns exist (edge fade, scroll
   bar or arrow), not only an `aria-label`.
5. Pinch zoom is not disabled (no `user-scalable=no`, no `maximum-scale=1`).
6. Autofill works for e-mail, name and password; a password manager can fill and paste into the
   password fields (WCAG 3.3.8 Accessible Authentication).

## Part E. Motion and time

1. Turn on the OS "reduce motion" setting. Entrance animations and hero motion stop or become a
   fade; nothing loops (WCAG 2.3.3 is AAA but the project honours it).
2. Nothing flashes more than three times per second.
3. Any timeout (session expiry, login, resend e-mail cool-down) is stated in text before it
   happens and the user can recover without losing entered data.

## Part F. Cognitive and content

1. Instructions say what to do first. Error messages say what happened, why, and how to fix it.
2. The same help, contact route and navigation appear in the same place on every page
   (WCAG 3.2.6 Consistent Help).
3. Information entered earlier in a flow (name, e-mail, program) is not asked for again in the
   same flow (WCAG 3.3.7 Redundant Entry).
4. Reading level of the main pages is plain English; acronyms are expanded on first use (KIIT,
   KNEST, IST for times).
5. Dates and times: lab times state the time zone (IST) and are not ambiguous.

## Part G. Lab check-in (only when the attendance flag is on)

1. The camera permission prompt is preceded by text that explains why it is needed, and denial
   leaves a working alternative (typed code or manual entry) with equal prominence.
2. The scan result is announced to a screen reader (role status), not only shown as a colour or a
   sound.
3. A student's pass can be shown at full screen brightness with sufficient contrast and has a
   text alternative of the booking details.
4. The installed (home screen) app works with VoiceOver and TalkBack and honours text size
   settings.

## Result table

Fill in one row per screen and part. Severity: Critical (blocks a task), Major (workaround
exists), Minor. Reference the WCAG criterion.

| Screen | Part | Result (pass, fail, n/a) | WCAG criterion | Severity | Note | Reviewer | Date | Build SHA |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Release rule

Release is blocked by any open Critical or Major finding on the sign-up, application, booking and
staff review flows. Minor findings are logged to the backlog with an owner. The completed table is
stored with the release record. Until a human has filled it in, the product must not be described
as accessibility-reviewed; it may be described as passing automated WCAG 2.2 AA scanning.

## Added in this release

(to be filled in by the documentation pass once the other branches are merged)
