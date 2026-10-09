# Accessibility review: what a scanner cannot see

Standard: WCAG 2.2 Level AA, plus the project rules in `.claude/rules/accessibility.md`
Method: source reading only. Nothing was built, run or tested, and no assistive technology was used.
Scope: forms, dialogs and menus, the lab booking picker and lab staff controls, the mobile navigation, tables and report regions, status display, link text, heading order, target sizes, focus handling, announcements and cognitive load.
Baseline: `tests/integration/35-accessibility.test.ts` (axe-core, WCAG 2.0 to 2.2 A and AA) already passes.

## How to read this

Every finding below was found by reading the code. Where the behaviour depends on a browser or screen reader, the finding says so and the item is repeated in "Needs a human with a screen reader" at the end. File references are `path:line` relative to the repository root. Severity uses: Critical (blocks a task for some users), Serious (major barrier or a workaround is needed), Moderate (real difficulty, workaround exists), Minor.

What the axe suite does not cover, and why that matters here:

- It scans each page once in its resting state. It never opens the mobile menu, picks a date so that the slot list appears, triggers a form error, submits anything, or exercises a success message. Most findings below live in those states.
- `/admin/applications/[id]` (the status form) is not in its page list, so its unlabelled select was never scanned.
- It runs with `reducedMotion: 'reduce'` and waits 1.5 seconds, so it measures the settled state only.
- Its "focus is visible" check passes if the element has any `box-shadow`. The form controls get a faint 15 percent ring from `focus:ring-2`, so the check passes without proving a 3:1 indicator (see 10).

Totals: 10 Serious, 14 Moderate, 11 Minor. No Critical findings, because every flow can in principle be completed, but findings 1, 3 and 5 are close to it.

---

## Serious

### 1. The booking picker deletes its own confirmation and its conflict error
- Where: `src/app/(member)/dashboard/lab-booking/[slug]/booking-picker.tsx:53`, `:109`, `:112-114`
- WCAG: 4.1.3 Status Messages (AA), 3.3.4 Error Prevention (AA)
- Evidence: `submit()` sets the success message (line 112) and then calls `load(date)` (line 114). On success `load()` runs `setMessage(null)` (line 53). The same happens on a conflict: the error is set (line 108), `load(date)` is called (line 109), and the refreshed list clears it (line 53). The message exists for roughly the length of one fetch. Sighted users see a flash, and a screen reader may or may not announce it, because the node is inserted and removed within a few hundred milliseconds. The one sentence that tells the member "Request sent" or "someone else just took that time" is the one that is lost.
- Impact: a member cannot tell whether the request went through, may submit again, or may not understand why their chosen times vanished.
- Fix: do not clear the message in `load()` unless it is a load error. Pass an option, for example `load(date, { keepMessage: true })`, or set the success and conflict messages after the reload resolves. Render the message region once and keep it mounted:

```tsx
<div role="status" aria-live="polite" className={message ? '' : 'sr-only'}>
  {message?.kind === 'ok' ? message.text : ''}
</div>
<div role="alert">{message?.kind === 'error' ? message.text : ''}</div>
```

- Verify: submit a request with NVDA running and confirm "Request sent" is spoken and still visible five seconds later; force a conflict (two sessions, same slot) and confirm the error remains.

### 2. The mobile navigation drawer is not modal, leaks focus, and can lock the page
- Where: `src/components/layout/site-header.tsx:37`, `:41-56`, `:135-161`, `:164-180`
- WCAG: 2.4.3 Focus Order, 2.4.7 Focus Visible, 1.3.1 Info and Relationships, 2.1.1 Keyboard (all A and AA)
- Evidence, each read directly from the code:
  - The panel is a fixed full-screen overlay but the page behind it is not made inert and there is no focus trap. After the last link ("Log in" or "Dashboard"), Tab continues into `<main>` and the footer, which are covered and invisible. Focus is on elements the user cannot see. Shift+Tab from the first link goes to the toggle and then the logo, which is acceptable, but the forward direction is the failure.
  - The panel has no dialog semantics (no `role="dialog"`, `aria-modal`, or label), so a screen reader user can still browse the covered page with the virtual cursor.
  - The close effect runs on `pathname` change only (line 37). Choosing the link for the page you are already on does not change the pathname, so the drawer stays open over the page.
  - When the route does change, the clicked link is unmounted and focus falls to the document body.
  - `document.body.style.overflow = 'hidden'` (line 50) is released only when `open` becomes false. If the viewport crosses the `lg` breakpoint while open (tablet rotation, window resize), the panel is hidden by `lg:hidden` but `open` stays true. The toggle is also hidden at `lg`, so the page stays unscrollable until a route change.
  - The toggle (lines 139 and 143) combines `aria-expanded` with a label that changes between "Open menu" and "Close menu". Screen readers announce "Close menu, expanded", which double-states.
  - The mobile links carry no `aria-current` while the desktop links do (line 85).
  - Possible total failure, needs a real-browser check (raised by the UI reviewer, and the CSS supports it): the header has `backdrop-blur-md` or `backdrop-blur-2xl` (lines 61-65), and `backdrop-filter` makes an element the containing block for `position: fixed` descendants. The panel is `fixed inset-x-0 bottom-0 top-[4.5rem]` (line 168), so it may be sized against the 72px header instead of the viewport and collapse to zero height, leaving a menu that opens with nothing visible. The axe suite never opens the menu, so it would not notice. If confirmed, move the panel out of the `<header>` (render it as a sibling) or drop the blur while open.
- Fix: use the native `<dialog>` with `showModal()` or the `inert` attribute on `<main>` and `<footer>` while open; add a `resize` or `matchMedia('(min-width:1024px)')` listener that closes the drawer; close on link click as well as on pathname change and return focus to the toggle; give the toggle a fixed name "Menu" and rely on `aria-expanded`; copy `aria-current` to the mobile links.

```tsx
useEffect(() => {
  const mq = window.matchMedia('(min-width: 1024px)')
  const close = () => mq.matches && setOpen(false)
  mq.addEventListener('change', close)
  return () => mq.removeEventListener('change', close)
}, [])
```

- Verify: keyboard only at 375px width, open the menu, press Tab repeatedly, and confirm focus never leaves the panel; rotate a tablet through 1024px with the menu open.

### 3. Controls that act the moment they change, including a privilege change
- Where:
  - `src/app/(staff)/admin/members/member-actions.tsx:47-51` (note: line numbers in this file are 47 for the select and 51 for `onChange`)
  - `src/components/ui/filter-bar.tsx:46-48`
  - `src/app/(member)/dashboard/lab-booking/[slug]/booking-picker.tsx:59-62`, `:124`
  - `src/app/(public)/mentors/need-select.tsx:18-23`
- WCAG: 3.2.2 On Input (A), 3.3.4 Error Prevention (AA)
- Evidence:
  - The staff-role `<select>` calls the API in `onChange`. The call changes the person's role and ends their sessions (the component comment says both are audited). In Chrome and Edge on Windows, pressing Down on a closed select fires `change` for every option passed, so a keyboard user moving from "Not staff" to "Reviewer" can save "Reviewer", "Content admin" and so on in turn, including `super_admin` if it is in the path. Screen reader users in forms mode change the value the same way. This is the most consequential instance because the side effect is a permission grant and a forced sign-out.
  - `FilterBar` navigates (`router.push`) on every select change. Keyboard users arrowing through the options trigger a page navigation per key press.
  - The booking date input fires `setDate` on every `change`. In Chrome, typing the year digit by digit produces a valid date after each digit, so each digit starts a fetch, and the out-of-range ones return an error that is announced through `role="alert"`. A screen reader user typing a date hears a stream of error messages.
  - `NeedSelect` navigates on selection, and (also a semantics fault, see 14) clicking the selected option deselects it, which a radio never does.
- Impact: unintended privilege changes, lost keyboard position, noisy announcements.
- Fix: stage the choice and commit it with an explicit button. For the role select add "Save role" and a confirmation naming the person and the role. For filters, either add an "Apply" button or commit on `blur` or `Enter`. For the date, validate against `min` and `max` locally and add a "Show times" button, or debounce 500 ms and suppress alerts for incomplete dates.
- Verify: with NVDA or the keyboard alone on Windows Chrome, focus the role select and press Down three times; confirm the network log shows no requests until Save is pressed.

### 4. Focus Not Obscured: sticky header, fixed bars, and the skip-link target
- Where: `src/styles/globals.css` (no `scroll-padding-top` anywhere in `src`), `src/components/layout/site-header.tsx:61`, `src/app/(member)/onboarding/step-shell.tsx:73`, `src/components/layout/skip-link.tsx:6`
- WCAG: 2.4.11 Focus Not Obscured (Minimum) (AA, new in 2.2, called out in the project rules)
- Evidence: the header is `sticky top-0 z-50` and 4.5rem tall. No `scroll-padding-top` or `scroll-margin-top` exists except three `scroll-mt-24` anchors on `ecosystem` and `mentors`. When a keyboard user tabs backwards up a page, or the browser scrolls a newly focused control to the top edge, the control lands beneath the header. The skip link jumps to `#main`, whose first heading is then scrolled to the top of the viewport behind the header. On the onboarding mobile layout the Back and Continue bar is `fixed bottom-0` (`step-shell.tsx:73`); the page has a spacer (`h-24`, line 94) for the end of the page, but a field in the middle of the page that is focused near the bottom of the viewport sits under the bar.
- Fix:

```css
html { scroll-padding-top: 6rem; scroll-padding-bottom: 7rem; }
```

  Also give `<main id="main" tabIndex={-1}>` so the skip link moves focus in all browsers (Safari does not move focus to a non-focusable target).
- Verify: tab backwards through `/programs` and the lab picker at 200 percent zoom and confirm every focused control is at least partly visible.

### 5. Focus is lost and the outcome is not announced after most actions
- WCAG: 2.4.3 Focus Order (A), 4.1.3 Status Messages (AA), 3.3.4
- The pattern: an action succeeds, the page re-renders with `router.refresh()` or swaps a component, the button that had focus disappears, and focus falls to the document body. Nothing says what happened. Instances:
  - Lab staff decisions: `controls.tsx:16-30` (`useCall` sets `done` but `DecisionControls`, `AttendanceControls` and `CancelControls` never read it), `:62-72` (Approve), `:140` (Mark attended), `:190` (Cancel and tell them). The request leaves the "waiting" list; the next row shifts up; the user is dropped at the top of the document.
  - Member booking actions: `booking-actions.tsx:22` (`router.refresh()` replaces the buttons), `:31-41`.
  - Hours, blackout and staff `Remove` buttons: `controls.tsx:329`, `:366`, `:415`. The list item is removed; focus is lost; no announcement.
  - Event registration toggle: `src/app/(public)/events/[slug]/register-button.tsx:39-40`. The label flips from "Register" to "Cancel registration" with no status message; focus stays but a name change on the focused button is not reliably spoken.
  - Resend verification: `src/app/(auth)/verify/resend-button.tsx:19-21`. The button is replaced by text, focus is lost, and the text "Sent. Check your inbox." is inserted without a live region.
  - Contact form success: `contact-form.tsx:46-55` and password reset success `reset-form.tsx:42-63`. The whole form is replaced by a confirmation; the focused submit button is destroyed. The contact version has `role="status"` on a node that already contains its text when inserted, which many screen readers do not announce.
  - Onboarding: `step-shell.tsx:58-92`. On every step change the heading `h1` and body are swapped by `AnimatePresence`, but focus stays on (or is lost from) the Continue button and nothing announces "Step 3 of 6: What brings you here?". `onboarding-flow.tsx:203` ("Dismiss") removes its own button.
  - Application form: `application-form.tsx:150-169` (submitted), `:171-218` (review), and each step change at `:82-87`. The question heading changes under a focused "Save and continue" button with no announcement.
  - Notifications: `notifications-list.tsx:67-76`. "Mark read" removes itself.
  - Admin: `applications/[id]/status-form.tsx:42`, `members/member-actions.tsx:110`, `enquiries/mark-handled.tsx:166` (`router.refresh()` with no focus management).
- Fix: one shared pattern. After a successful action, move focus to a stable target with `tabIndex={-1}` (the list heading, the next row, or a status paragraph) and write the outcome to one persistent live region mounted at page load:

```tsx
// mount once per page section, always in the DOM
<p role="status" aria-live="polite" className="sr-only">{announcement}</p>
```

  For step changes, call `headingRef.current?.focus()` in an effect keyed on `index`, and render the "Step n of N" text inside the focused heading's accessible name or a status node.
- Verify: for each action above, with NVDA, confirm the outcome is spoken and that the next Tab press goes somewhere sensible.

### 6. Form errors are never tied to the field they belong to
- Where: `src/components/ui/field.tsx:48-57` (wiring exists), but no call site passes `error`. Search shows `aria-invalid` appears only in `field.tsx`. Call sites: `login-form.tsx:95`, `signup-form.tsx:110`, `contact-form.tsx:58`, `booking-picker.tsx:119`, `controls.tsx` (all forms), `application-form.tsx`, `reset-confirm-form.tsx`.
- WCAG: 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA), 1.3.1, 4.1.2
- Evidence: the well-built `Field` error mechanism (`aria-describedby`, `aria-invalid`, `role`-free message linked by id) is dead code. Every form uses `noValidate` (login, signup, contact, reset, booking picker) with the `required` attribute left on, so the browser never validates; the server returns one string (`{ error, code }`, see `src/server/labs/http.ts:11`) and the form shows it in a single banner. Consequences:
  - The `required` attributes do nothing visually and the picker's fields (`booking-picker.tsx:167`, `:174`) are never checked before sending.
  - After a failed login or signup, focus is moved to the first field (`login-form.tsx:40`, `signup-form.tsx:46`). The `role="alert"` banner and the focus move compete, and the screen reader usually speaks the field label and drops the alert.
  - No field shows `aria-invalid`, so nothing identifies which field is wrong.
  - The "Optional" convention marks the exception (`field.tsx:39-43`) but no page says "All fields are required unless marked optional", so sighted users get no `required` cue at all (3.3.2).
- Fix: have the API return `{ error, field }` where possible, or validate on the client first, then pass `error` to `Field` so the existing wiring works. Point the banner and the field at each other: keep the banner, add `aria-describedby` on the offending input, and focus the first invalid field with its error in the description. Add one visible sentence at the top of each form: "All fields are required unless marked optional."
- Verify: submit each form empty and with a bad value; confirm the screen reader says which field and why, and that `aria-invalid="true"` is present in the accessibility tree.

### 7. Application questions are not the label of their answer, and option groups have no name
- Where: `src/app/(member)/apply/[program]/application-form.tsx:243-249`, `:252`, `:266`, `:279-292`; `src/components/ui/option-list.tsx:65`, `:87`; `onboarding-flow.tsx:268`, `:276`
- WCAG: 1.3.1 Info and Relationships (A), 3.3.2 Labels or Instructions (A), 4.1.2 Name, Role, Value (A)
- Evidence: the question is an `h1` (`application-form.tsx:245`), but every text or textarea answer is labelled "Your answer" (lines 252 and 266). In forms mode a screen reader says "Your answer, edit" for every question and never the question. The `helpText` paragraph (line 248) is not referenced by `aria-describedby`. For select and multiselect questions, `SingleSelect` renders `role="radiogroup"` with no name (`option-list.tsx:65`), and `MultiSelect` renders a plain `div` with no group role at all (`option-list.tsx:87`). The mentor onboarding steps put the question in a bare `<p>` beside the group (`onboarding-flow.tsx:268`, `:276`), so the group is unnamed.
- Fix: pass the question as the label (`<Field label={question.label} hint={question.helpText}>`) and visually hide the duplicate heading text only if needed; give both option components a required `label` prop and render `role="radiogroup"` or `role="group"` with `aria-labelledby` pointing at the visible question.
- Verify: tab through three application questions with NVDA and confirm each announces the question text.

### 8. A blocked or failed human check silently disables submit forever
- Where: `src/components/security/turnstile-widget.tsx:59-79`, `:86`; consumers: `login-form.tsx:16`, `:149`, `signup-form.tsx:18`, `:168`, `contact-form.tsx:15`, `:100`, `reset-form.tsx:14`, `:105`, `application-form.tsx:50`, `:209`, `booking-picker.tsx:38`, `:193`
- WCAG: 3.3.1 Error Identification, 2.1.1 Keyboard, 3.3.8 Accessible Authentication (Minimum) for the login path
- Evidence: if the Cloudflare script is blocked (content blockers, school networks, offline), `loadScript()` rejects, `callback.current(null)` is called, `captchaToken` stays null, and `captchaPending` keeps the submit button `disabled` with no message and no retry. The button is out of the tab order when disabled. A user is locked out of sign-in, sign-up, password reset, contact, booking and application submit, and nothing says why. The widget renders a `role="group" aria-label="Human verification"` container with a fixed 65px height whether or not anything is in it.
- Fix: surface a failure state ("The security check did not load. Check your connection or turn off content blockers, then try again." with a Retry button), keep the submit button focusable with `aria-disabled` and `aria-describedby` explaining the wait, and render the Turnstile `error-callback` into the message. Keep widget mode non-interactive where possible.
- Verify: block `challenges.cloudflare.com` and attempt login; confirm a clear message and a way forward.

### 9. Controls without a usable name, and many identical names
- Where and WCAG: 4.1.2, 1.3.1, 3.3.2, 2.4.6 (all A or AA)
  - Unlabelled select: `src/app/(staff)/admin/applications/[id]/status-form.tsx:47-57` has no label or `aria-label`. Its options read "Move to: Accepted", but the control itself has no name. The note field below (`:58-62`) is a `Textarea` labelled only by a placeholder, which disappears when typing and is not a label.
  - Row-less labels: `controls.tsx:319-328` gives each opening-hours row the same `aria-label` values "Day", "Opens" and "Closes". With seven rows a screen reader user hears the same three names repeated and cannot tell which window they are editing.
  - Identical button names across list rows: Approve, Decline… and Suggest another time… (`controls.tsx:62-78`), Mark attended and Mark no-show… (`:140-143`), Cancel this booking… (`:175`), Remove (`:329`, `:366`, `:415`), Cancel booking, Accept the new time and Decline (`booking-actions.tsx:31-41`), Edit (`application-form.tsx:189-198`), Mark read (`notifications-list.tsx:68-75`), Deactivate/Reactivate (`member-actions.tsx:60`), Mark handled (`mark-handled.tsx:171-179`). In a list of buttons, a screen reader user and a voice-control user (Dragon: "click Approve") cannot tell which person or booking is meant.
  - The staff decision select is wrapped in a `<label>` but fetched later with `document.getElementById` (`controls.tsx:53`, `:67`), an imperative read that bypasses state.
- Fix: add context to the accessible name without changing the visible text, for example `aria-label={`Approve request from ${name}, ${range}`}`; for voice control the visible text "Approve" must remain at the start of the name (2.5.3 Label in Name). For repeated rows use `aria-labelledby="{rowId} {buttonId}"`. Give the status select a visible label "Move application to" and a real label on the note textarea. Replace the hours row labels with `aria-label={`${WEEKDAYS[w.weekday]} opens`}` style names or a `fieldset` per row with a legend.
- Verify: open the screen reader's list of form controls or buttons on `/dashboard/lab-staff/[slug]` with three requests and confirm every item is distinguishable.

### 10. Control boundaries and focus indication on the shared form fields
- Where: `src/components/ui/field.tsx:62-69` (class string `control`), `src/components/ui/password-input.tsx:30-35`, `src/styles/tokens.css:27`
- WCAG: 1.4.11 Non-text Contrast (AA), 2.4.7 Focus Visible (AA), project rule "UI 3:1" and "Focus ring meets 3:1"
- Evidence (computed from the token values): `Input`, `Select`, `Textarea` and `PasswordInput` use `border-[var(--color-line)]/70`. `--color-line` is #ddd0a8. At 70 percent over white that is about 1.34:1, far below the 3:1 needed to find a text box. The project's own rules say the default border is decorative only and essential control borders use the strong border. The same fields remove the browser outline (`focus:outline-none`, line 66) and replace it with a 1px border colour change and `focus:ring-2 ring-[var(--color-signal)]/15`, a 15 percent ring that has no meaningful contrast. The oxblood border (#7a1f2b) does contrast, but it is 1px. The axe suite's focus test accepts any `box-shadow` (see the baseline note), so this passes without proving anything.
- Related: the lab, report and admin controls use `border-[var(--color-line-strong)]` (26 uses under `src`), but `--color-line-strong` is not defined anywhere in `src/styles`. A `var()` with no definition makes the declaration invalid at computed-value time, so the border falls back to `currentColor`, which happens to be dark and gives good contrast by accident. Defining the token to something lighter later would silently break contrast on those controls.
- Fix: define `--color-line-strong` as a value at least 3:1 against white and paper (for example #8a7d52 or a darker neutral), use it for every input border, and remove `focus:outline-none` so the global 2px `:focus-visible` outline (`globals.css:34-38`) applies, or replace the ring with `focus-visible:ring-2 ring-[var(--color-signal)]` at full opacity.
- Verify: take a screenshot of the login form at 100 percent and apply a contrast checker to the empty field edge; tab into each field type and confirm the indicator is clearly visible.

---

## Moderate

### 11. File upload: no visible focus, silent result, and a promise it does not keep
- Where: `application-form.tsx:296-311`
- WCAG: 2.4.7 Focus Visible, 4.1.3 Status Messages, 3.3.2
- The file input is `sr-only` inside a `<label>`. Keyboard focus lands on the one-pixel hidden input, where the global focus ring is effectively invisible, and the label box has only `hover:border-signal`, no `focus-within` style. The chosen filename appears in the label text without any announcement. The text says "Drop a file, or choose one", but no drag-and-drop is implemented.
- Fix: add `focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-signal)]` to the label; put the filename in a `role="status"` node; change the copy to "Choose a file" unless drop is added.

### 12. Slot picker semantics and announcements
- Where: `booking-picker.tsx:75`, `:83`, `:121-124`, `:127-155`, `:157-161`, `:193`
- WCAG: 4.1.3, 3.3.1, 3.3.2, 1.3.1
- Evidence:
  - The entire results area, including the fieldset of every slot button, sits inside one `aria-live="polite"` container (line 127). When times load, the screen reader may read the whole list of buttons as one announcement, and every re-render of the list is re-announced.
  - The "Your request: 10:00 to 11:30 IST" summary (lines 157-161) is not live. The only announcement of a selection is each button's `aria-pressed`, so a user never hears the combined range.
  - Choosing a non-adjacent slot, or going over the limit, silently throws the old selection away and keeps only the new one (line 75). Nothing says so.
  - Taken slots are `disabled`, so they leave the tab order and a keyboard user cannot discover that a time is taken (the "taken" text is only reachable in browse mode).
  - The "Pick a time first" message (line 83) can never appear because the Send button is disabled until a slot is chosen (line 193). A disabled button gives no reason.
  - The date label does not state the allowed range even though `min` and `max` are set.
- Fix: announce "12 times available on Monday 12 October" in a small live region and keep the list outside it; announce "Selected 10:00 to 11:30, 3 blocks" when selection changes and "Selection cleared: times must be next to each other" on reset; use `aria-disabled="true"` on taken slots with `aria-describedby` so they stay focusable; keep the Send button enabled and show "Choose a time first" on press; add "Pick a date from today to {latest}" as the date hint.

### 13. Disabled primary buttons with no stated reason
- Where: `step-shell.tsx:87`, `application-form.tsx:327`, `booking-picker.tsx:193`, `onboarding-flow.tsx:152`, `:174`, `:196`, `:257`, `:309`, and the captcha gates in finding 8
- WCAG: 3.3.2 Labels or Instructions, 2.4.3; also the cognitive-load guidance in `.claude/rules`
- A disabled button is skipped by Tab and announced as "dimmed" or not announced at all. Users do not learn what is missing. Either keep the button enabled and explain on press, or add visible helper text such as "Choose one to continue" connected with `aria-describedby`.

### 14. Option cards: keyboard model and selection semantics
- Where: `option-list.tsx:24-27`, `:65`, `:87`; `need-select.tsx:18-23`; `journey-selector.tsx:81-88`
- WCAG: 4.1.2, 2.1.1
- Cards use `role="radio"` and `role="checkbox"` on `<button>` elements, with each card its own tab stop. The WAI-ARIA radio group pattern expects one tab stop and Arrow keys to move and select; the checkbox cards have no group. In the journey selector, selecting an option also reveals new content and a link, which is a disclosure, not a radio. In `NeedSelect`, clicking the selected option clears it, which a radio group cannot do.
- Fix: for single choice use native `<input type="radio">` inside `<fieldset><legend>`, styled with `peer`; for multi choice use native checkboxes in a fieldset. For the journey selector use `aria-pressed` buttons (a toggle group) or tabs. Native inputs bring Arrow key behaviour for free.

### 15. Journey selector: sensory instruction and an announcement that may not fire
- Where: `journey-selector.tsx:131`, `:159`
- WCAG: 1.3.3 Sensory Characteristics (A), 4.1.3
- "Select your current building phase on the left" depends on position, which is wrong in the stacked mobile layout and meaningless for a screen reader. The `LiveRegion` is rendered inside the keyed `motion.div` that mounts with the selected content (line 131), so the live region and its text appear together; most screen readers announce only text that changes inside a region that already existed.
- Fix: say "Choose one of the options above"; mount one `LiveRegion` outside the `AnimatePresence` and update its message.

### 16. Status messages inserted into the DOM already containing their text
- Where: `controls.tsx:294`, `:342` (`{done && <span role="status">Saved.</span>}`), `contact-form.tsx:48`, `booking-picker.tsx:184-188`
- WCAG: 4.1.3
- `role="alert"` is tolerant of insertion; `role="status"` and `aria-live="polite"` generally are not. "Saved." is also never cleared, so after a second edit the old message can mislead.
- Fix: render a permanent `<p role="status" aria-live="polite" className="sr-only">` and change its text; clear it when the form changes.

### 17. Table primitives: headers, captions, and hidden overflow
- Where: `src/components/ui/table.tsx:35-45`, `src/components/labs/report-table.tsx:14-15`, `:55-56`, `:34`, `:36`
- WCAG: 1.3.1, 2.1.1, 1.4.10 (Reflow), and the project's composition rule 7
- Evidence:
  - `Table` header cells are `<th>` without `scope`, there is no caption, and the scroll wrapper is not focusable. The mobile card layout drops the column labels.
  - The report tables have the right bones (`scope="col"`, `scope="row"`, sr-only caption, `role="region"` with `tabIndex={0}` and an `aria-label`). The `aria-label` mentions "scrolls sideways" but sighted users get no edge fade, scroll hint or sticky first column (the composition rule 7 in `.claude/rules/components.md`). At phone width a `min-w-[56rem]` table hides nine columns, and while you scroll the lab name leaves the screen, so the numbers lose their row. Counts are left aligned, which makes columns harder to compare.
  - The generic `Table` also keys columns by `col.header`, so two columns with the same header text would collide.
- Fix: add `scope="col"` in `Table`, accept a `caption` prop, make `th` `scope="row"` for the first cell, apply `sticky left-0 bg-white` to the row-header cell, add a right-edge gradient mask or a "Scroll for more columns" hint, right-align numeric cells with `tabular-nums`.

### 18. The report silently changes the date range the user typed
- Where: `src/app/(member)/dashboard/lab-staff/[slug]/report/page.tsx:25-27`, `:44`, `:49`
- WCAG: 3.3.1, 3.3.3
- If "To" is before "From", the server uses `to = from` (line 27) while the input keeps showing what was typed (line 44 uses `defaultValue={to}` of the unmodified value). The table caption shows the corrected range, but nothing tells the user their input was changed, and invalid strings are replaced by defaults the same way. The CSV link uses the corrected range.
- Fix: show "The end date was before the start date, so the report covers one day: {from}" in a visible `role="status"` note and set the input to the corrected value.

### 19. Irreversible or high-consequence actions with no confirmation or undo
- Where: `booking-actions.tsx:40` (Cancel booking), `controls.tsx:329` (Remove hours window), `:366` (Remove closed dates), `:415` (Remove staff, including a head), `status-form.tsx:64` (Update status to accepted or rejected, a final state), `member-actions.tsx:60` (Deactivate account)
- WCAG: 3.3.4 Error Prevention (Legal, Financial, Data), best practice for the rest
- These act on a single click. The staff and application ones change other people's access or outcome. Add a confirm step (an inline "Are you sure?" with named consequence, not a modal unless it is a proper `<dialog>`) or an undo toast.

### 20. Lab staff console: density and unexplained numbers
- Where: `controls.tsx:218-227`, `:252-271`, `:363`, `lab-staff/[slug]/page.tsx:61`, `:136-166`
- WCAG: 3.3.2, 3.3.5 (AAA), cognitive guidance in `.claude/rules/accessibility.md`
- Eight number fields have labels but no units, limits or examples (for example "Cancel up to (minutes before)" with `min={0}` where zero is invalid for capacity). Closed dates print as raw ISO ("2026-10-09 to 2026-10-12"). Five sections appear on one page with no in-page links.
- Fix: add hints ("Between 1 and 20 people"), print dates as "Fri 9 Oct to Mon 12 Oct 2026" (reuse `DAY` in `lab-format.ts`), add a short "On this page" list linking to the section headings.

### 21. No forced-colors (Windows High Contrast) support
- Where: all of `src`; there is no `forced-colors` or `prefers-contrast` rule. Selection is shown by fill colour in the slot buttons (`booking-picker.tsx:143`), option cards (`option-list.tsx:33-47`), status dots (`tag.tsx`), the progress bars (`step-shell.tsx:48-55`, `application-form.tsx:236-241`) and the active nav underline (`site-header.tsx:89`).
- WCAG: 1.4.11, 1.4.1; project `accessibility/vision.md`
- In forced colors, backgrounds are replaced, so a selected slot (dark fill, white text, `border-[var(--color-ink)]`) and an unselected slot (white, `border` that falls back to `currentColor`) look identical. The `aria-pressed` state remains for screen readers but not for low-vision users.
- Fix: add `@media (forced-colors: active)` rules: `[aria-pressed="true"], [aria-checked="true"] { outline: 3px solid Highlight; }` and give progress and status indicators a `border` or a text cue.

### 22. Links that rely on colour or weight alone
- Where: `login-form.tsx:169`, `signup-form.tsx:188` (semibold and colour, underline only on hover), `verify-confirm.tsx:38` and `:53` (actual lines, `font-medium` only), `application-form.tsx:195` (button styled as link with no underline)
- WCAG: 1.4.1 Use of Color (A)
- The link colour #7a1f2b against the surrounding #2b3350 text is 1.22:1, so colour does not distinguish the link. In `login-form` and `signup-form` the link sits in a sentence and has bold weight as a cue, which is a weak pass. In `verify-confirm` the link is only slightly heavier.
- Fix: underline inline links by default (`underline underline-offset-4`), as the lab pages already do.

### 23. Verification screen shows nothing while checking and does not announce the result
- Where: `src/app/(auth)/verify/confirm/verify-confirm.tsx:27-53`
- WCAG: 4.1.3, 2.4.3
- "Confirming…" is a plain paragraph with no live role; the page has no `h1` until the state resolves; the result `h1` replaces the content without moving focus. Add `role="status"` to the checking text and move focus to the result heading.

### 24. Resend button reports success whether or not it succeeded
- Where: `src/app/(auth)/verify/resend-button.tsx:9-17`
- WCAG: 3.3.1, 4.1.3
- `fetch` has no error handling and the code sets `sent` unconditionally. A network failure rejects, leaving the button stuck on "Sending…" with an unhandled rejection; an HTTP error still shows "Sent. Check your inbox." Check `res.ok`, show an error, and announce the result.

---

## Minor

### 25. Heading levels
- `src/app/(public)/search/page.tsx:49` renders result titles as `h3` directly under the page `h1` with no `h2`. `founder-view.tsx:36` makes "Lab & Infrastructure" an `h3` under the Next milestone `h2`, which is not its parent. Use `h2` for results and for the lab card. (WCAG 1.3.1, 2.4.6)

### 26. Repeated link text
- `lab-booking/page.tsx:45` ("See times and book" for every lab), `lab-staff/page.tsx:45` ("Open console") and `:66` ("Open"). The list context makes the purpose determinable, so 2.4.4 passes, but the links list of a screen reader is ambiguous. Add `<span className="sr-only"> for {lab.name}</span>`. (2.4.4, 2.4.9)

### 27. Contrast at the margin
- The positive tag (`src/components/ui/tag.tsx:9`, text #15803d on a 12 percent tint) is 4.27:1 at 12px bold uppercase; AA needs 4.5:1. The footer legal row (`site-footer.tsx:89`, `text-white/45` on #0d1321) is 4.51:1, a pass by 0.01, and drops below 4.5 on a dithered or gradient background. Darken the green to #166534 and raise footer legal text to `text-white/65`. (1.4.3)

### 28. Very small text
- 9px unread badge (`site-header.tsx:114`), 11px "(optional)" and "Forgot password?" (`field.tsx:42`, `login-form.tsx:125`), 11px auth footer links (`(auth)/layout.tsx`), 12px error text across forms and the lab tools. Not a failure by itself but poor for low vision and below the 14px floor the cognitive rules suggest. Raise errors and hints to 14px.

### 29. Small plain-text buttons
- "Mark read" (`notifications-list.tsx:68`), "Edit" (`application-form.tsx:189`), "Dismiss" (`onboarding-flow.tsx:203`), "Skip for now" (`step-shell.tsx:83`), "Clear all" (`filter-bar.tsx:60`) have no padding. Their height is the line height (about 22px at 14px), under 24px. The spacing exception in 2.5.8 probably saves most, but add `min-h-6 px-2` to be safe. (2.5.8)

### 30. Honeypot field
- `contact-form.tsx:85-90` hides a focusable input behind `aria-hidden="true"`. An `aria-hidden` ancestor containing a focusable control is an ARIA error; use `hidden` with `inert`, or position it off screen without `aria-hidden` and keep `tabIndex={-1}`. (4.1.2)

### 31. Decorative images
- `src/app/(public)/hero.tsx:52` (`alt="Knest Infrastructure"`) and `src/app/(auth)/layout.tsx:62` (`alt="KNEST Innovation Hub"`) are decoration behind text and add noise. Use `alt=""` unless the image carries information. (1.1.1)

### 32. Arrow glyphs inside accessible names
- "Log In →", "Create account →", "← Back" (`login-form.tsx:161`, `signup-form.tsx:180`, `application-form.tsx:207`, `:322`) are read as "rightwards arrow" and "leftwards arrow". Wrap the glyph in `<span aria-hidden="true">`.

### 33. Admin navigation does not show the current page
- `src/app/(staff)/admin/layout.tsx:41-46` has no `aria-current` and no visual current state, and the links have no underline. Mirror the public header: `aria-current="page"` plus an underline on the active item. (2.4.8 AAA, 1.3.1)

### 34. Vague empty-slot message
- `booking-picker.tsx:129`: "the lab is closed, or it is too soon or too far ahead" does not say which, nor offer the next open date. (3.3.3, plain language) The server already knows the reason; return it with the empty list.

### 35. Placeholder text that looks like a value
- Login and signup placeholders "••••••••••••" and "you@kiit.ac.in" (`login-form.tsx:104`, `:117`, `signup-form.tsx:132`, `:144`). The bullets are read aloud by some screen readers and the KIIT example suggests only KIIT addresses are accepted. Drop the password placeholder and use "name@example.com".

---

## What is working well

- `html lang="en"` is set; `<main id="main">` and a skip link exist on public, auth, member and staff layouts; Next's route announcer handles page titles.
- A global `:focus-visible` outline (`globals.css:34-38`) at 2px in a 9:1 colour covers every button and link that does not opt out.
- `prefers-reduced-motion` is handled twice: the CSS override in `globals.css:41-50` and `MotionConfig reducedMotion="user"` in `src/components/motion-provider.tsx`.
- Status is never colour alone: `StatusDot` and `Tag` always pair colour with a text label (`tag.tsx`), and the lab status labels in `lab-format.ts:28-36` are plain words.
- The `LinkCard` pattern keeps the heading outside the link and gives the link a real `sr-only` name (`card.tsx:58-63`), which is better than wrapping the whole card.
- `PasswordInput` supports paste and `autoComplete` values for password managers (WCAG 3.3.8), and its toggle changes its accessible name with state.
- List pages announce result counts through `LiveRegion` (`events/page.tsx`, `mentors/page.tsx`, `programs/page.tsx`) and the notifications list announces unread counts.
- The report tables use `scope`, a caption and a focusable, labelled scroll region, which is more than most tables get.
- The lab and booking pages use real headings in the right order (`h1`, then `h2`), plain labels ("Not approved", "Waiting for the lab head"), and underlined links.
- Mobile nav closes on Escape and returns focus to the toggle (`site-header.tsx:43-48`), and removes the page scroll while open.
- The onboarding and application flows save per step and send an expired session to log in with a return path, which protects people who take time (3.3.7, 2.2.1).

---

## Needs a human with a screen reader

These are the points where the code can only say what should happen. Test each with NVDA plus Chrome and Firefox on Windows, VoiceOver plus Safari on macOS and iOS, and TalkBack plus Chrome on Android. A short pass with Dragon or Voice Control covers 2.5.3.

1. Booking picker, end to end: choose a date by typing it and with the picker; hear what is announced as times load; select one slot, then three, then a non-adjacent slot; submit; confirm what is announced and that the message persists (finding 1, 12).
2. Lab head decisions: Approve, Decline, Suggest another time and Mark no-show with a list of at least three requests; check each button's name and where focus goes afterward (5, 9).
3. Mobile menu at 375 and 768 wide: open, Tab through, Escape, link to the same page, rotate across 1024 (2).
4. Staff role select in `/admin/members` with Down and Up arrows and with typed first letters; confirm nothing is saved until you confirm (3).
5. Login, sign-up, contact and reset: submit empty, submit invalid, with and without the Turnstile script allowed; confirm the error is read, tied to a field, and that blocking the script does not strand the user (6, 8).
6. Application form and onboarding: read three consecutive steps; confirm the question is announced, group names are read, step changes are announced, and the file upload shows focus (5, 7, 11, 13).
7. Report page at 200 and 400 percent zoom and in a forced-colors profile (Windows contrast themes): can you scroll the table by keyboard, see the first column while scrolling, and still tell selected slots from unselected ones (17, 21).
8. Windows keyboard behaviour of closed selects in Chrome, Edge and Firefox, to confirm finding 3 on each.
9. Focus Not Obscured: tab backwards through `/programs`, `/events` and onboarding on a phone at 200 percent zoom (4).
10. Sticky aside cards (`events/[slug]/page.tsx:104`, `programs/[slug]/page.tsx:186`, `startups/[slug]/page.tsx:93`, all `sticky top-24`) at 200 and 400 percent zoom: confirm they never cover text or controls. The spacing token is `--spacing: 0.5rem` (`tokens.css:73`), twice Tailwind's default, so `top-24` and every `h-*`, `size-*` and `gap-*` utility renders at twice the size its number suggests. Check real rendered target sizes in the browser before relying on the pixel counts in finding 29.
11. Plain-language read-through of the lab pages with a non-expert (lab "head", "assistant", "blocks", "consecutive") and of the journey selector copy ("Next Tactical Step", "Self-Assessment", "dedicated trajectory") for students new to the terms.
12. Cognitive and time: confirm the session expiry path in the application form returns to the same step with answers kept.

## Suggested order of work

1. Findings 1, 3 and 5 (they cause wrong or lost outcomes). The first is a two-line change; the third needs a Save button in `member-actions.tsx`; the fifth needs one shared announcer and focus helper.
2. Findings 2, 4 and 6 (shared components: `site-header.tsx`, `globals.css`, `field.tsx`). These fix every page at once.
3. Findings 7, 8, 9 and 10, then add axe scans for the states the suite misses: menu open, picker with slots loaded, each form in an error state, and `/admin/applications/[id]`.
4. Moderate items, then Minor items in routine maintenance.
5. Add an automated check that any `<select>` or `<input type="date">` with an `onChange` that calls `fetch` or `router.push` is flagged, and one that fails if `--color-line-strong` (or any `var(--color-*)`) is used but not defined in `tokens.css`.
