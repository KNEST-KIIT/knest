# E5.11 Accessibility implementation

Sources: the components and layouts named below; `tests/integration/35-accessibility.test.ts`; `docs/handover/ACCESSIBILITY-REVIEW.md` (source reading only, 35 findings) and `docs/handover/ACCESSIBILITY-MANUAL-TEST.md`. The target is WCAG 2.2 AA (`ACCESSIBILITY-REVIEW.md:3`). Nothing here was run in a browser or with assistive technology.

## 1. What the implementation provides

| Mechanism | Where | Notes |
|---|---|---|
| Language | `<html lang="en">` (`layout.tsx:26`, `global-error.tsx:17`) | Whole site is declared English; Odia/Hindi content would need `lang` on inline spans. Not determined whether any exists. |
| Skip link | `SkipLink` first in `(public)`, `(auth)`, `dashboard`, `onboarding`, `apply`, `admin` layouts | Targets `#main`; every one of those layouts defines `<main id="main">` (E5.08). Lab device page has `#main` but no skip link (single-screen). |
| Landmarks | `header` in `SiteHeader`, `nav aria-label="Main"`, footer `nav` per column with labels, `<main>` | The 404 page's `<main>` has no `id`; the root `not-found.tsx` has no skip link. Two `nav aria-label="Main"` exist only if the drawer is open at `lg+`, which the resize handler prevents. |
| Focus indication | Global `:focus-visible` outline 2px `--color-signal`, offset 2px (`globals.css:34-38`); `Button` replaces it with a ring (`button.tsx:10`); `LinkCard` uses `focus-within` outline (`card.tsx:51`) | Controls using `focus:outline-none` plus a 15% ring (`field.tsx:66`) rely on the colour change of a 1px border. |
| Live regions | `LiveRegion` (`role="status" aria-live="polite"`) for result counts on programs, events, mentors, startups, resources, search; application "Saved."; notification counts | Persistent regions are the correct pattern; several are mounted with their text (E5.06 journey selector). |
| Error announcement | `role="alert"` paragraphs/banners on login, signup, contact, application, register, resend, logout | Alert is tolerant of insertion; status is not. |
| Names for icon controls | Toggle uses `sr-only` text (`site-header.tsx:168`); password toggle (`password-input.tsx:47`); `LinkCard` `sr-only` label | |
| Status not colour-only | `StatusDot` (dot plus word), `Tag` text, application status sub-lines | `tag.tsx:39-59`, `applications/status-badge.tsx` |
| Reduced motion | Provider plus CSS floor (E5.10) | |
| Reflow guard | `min-w-0`, `[overflow-wrap:anywhere]` on cards (`card.tsx:48`), `grid-cols-[minmax(0,1fr)]` on detail grids (`programs/[slug]/page.tsx:61`, `events/page.tsx:58`) | Matches the "narrow-width defences" in `.claude/rules/components.md`. Tested by the "no page scrolls sideways at phone width" test (`35-accessibility.test.ts:180-198`). |
| Password managers | `PasswordInput` allows paste and `autoComplete` (`current-password`, `new-password`), email `autoComplete="email"` | WCAG 3.3.8. |
| Return from errors | login/signup move focus to the first field on failure (`login-form.tsx:54`, `signup-form.tsx`) | The review notes this competes with the alert announcement. |

## 2. Automated coverage (axe and Playwright)

`35-accessibility.test.ts` (374 lines) uses `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` (`:50`). It fails the build on `serious` and `critical` only (`:53`); `moderate` and `minor` are printed, not failed.

Coverage:

| Group | Pages | Viewports |
|---|---|---|
| Public (19) | `/ /about /programs /events /mentors /startups /resources /blog /ecosystem /invest /get-involved /contact /privacy /terms /search /search?q=lab /login /signup /reset` (`:28`) | 1280x900 and 375x740 |
| Detail (4) | one program, event, mentor, article | both |
| Member (6) | `/dashboard`, `/dashboard/applications`, `/dashboard/events`, `/apply/<slug>`, `/dashboard/lab-booking`, `/dashboard/lab-booking/<slug>` | both |
| Lab head (3) | `/dashboard/lab-staff`, console, report | both |
| Staff (7) | `/admin/overview, applications, enquiries, members, audit, labs, labs/report` | both |
| Behaviour | no horizontal scroll at 375px for 23 URLs; skip link first and `#main` present; mobile menu opens full height, Tab contained, Escape closes, resize releases scroll; login network failure recovery; every input has a label on `/login /signup /contact`; login focus has an outline or box-shadow; reduced motion has no infinite animations | |
| States | axe on open mobile menu, login error state, booking picker with slots loaded | |

Not covered (verified by absence from the lists above): `/startups/[slug]`, `/resources/[slug]`, `/blog` detail beyond one, `/onboarding` (any step), `/verify`, `/verify/confirm`, `/reset/confirm`, `/admin/applications/[id]` (the unlabelled status select, `status-form.tsx:49-59`), `/admin/analytics`, `/admin/mail`, the Payload admin, `/lab-device`, 404 and error pages, the application form beyond step 1, keyboard operation of the journey selector and Trajectory tabs, forced-colors, zoom to 200/400%, and every post-submit success state. Dark mode does not exist.

Test mechanics that limit confidence:
- The "focus is visible" check passes if the element has any computed `box-shadow` (`:295`), so the faint 15% input ring satisfies it without proving a 3:1 indicator.
- The skip-link test confirms the element exists, not that focus moved (`:210`).
- Scans wait 1.5 s after `networkidle` so entrance fades finish (`:47`), and run with reduced motion, so mid-animation contrast is never measured.
- The suite needs the full integration environment (built app, Postgres, Chrome via `PW_CHANNEL`; `ci.yml:85-115`); it cannot be run from a bare checkout.
- axe cannot assess: reading order, meaning of link text, screen-reader announcement timing, cognitive load. The file header says a scan finds "roughly a third of real problems" (`:14`).

## 3. Status of the source review against the current code

`ACCESSIBILITY-REVIEW.md` was written from source before several fixes. Spot checks on this checkout (not exhaustive; findings not listed were not re-verified):

| Review finding | Current state | Evidence |
|---|---|---|
| 1 Booking picker deletes its confirmation | Still open. `load()` calls `setMessage(null)` on success after `submit` sets the "Request sent" message, then `void load(date)` | `booking-picker.tsx:55,112-116` |
| 2 Mobile drawer not modal | Largely fixed: Escape, Tab wrap, resize release, initial focus, panel is `absolute` not `fixed`. Open: not `inert`/dialog; same-page link keeps it open; mobile links lack `aria-current` | `site-header.tsx:42-78,196-204` |
| 3 Controls that act on change (role select) | Role select fixed: now staged with an "Apply role" button. `FilterBar`, `ResourceFilters` and `NeedSelect` still navigate on each change; booking date still loads on every change | `member-actions.tsx` (select plus button), `filter-bar.tsx:46-48`, `need-select.tsx:18-23` |
| 4 Focus not obscured | Open: no `scroll-padding` or `scroll-margin` beyond three `scroll-mt-24`; `<main>` has no `tabIndex` | search of `src` |
| 6 Form errors not tied to fields | Open: no call site passes `error` to `Field` | search `<Field ... error` |
| 7 Questions not labels; unnamed option groups | Open | `application-form.tsx` "Your answer"; `option-list.tsx:65,87` |
| 8 Turnstile failure silent | Open | `turnstile-widget.tsx:59-79` |
| 9 Unlabelled controls | Status select still unlabelled | `status-form.tsx:49-59` |
| 10 Control border contrast and undefined token | Open | `field.tsx:63`; `--color-line-strong` undefined (E5.09) |
| 21 Forced colours | Open: no `forced-colors` or `prefers-contrast` rule in `src` | search |
| 30 Honeypot inside `aria-hidden` | Open | `contact-form.tsx:87-92` |
| 31 Decorative images with alt | Open | `hero.tsx:50`, `(auth)/layout.tsx:62` |
| 33 Admin nav has no current-page state | Open | `(staff)/admin/layout.tsx:42-48` |

The test added with commit `ee72732` ("scan the open menu, an error state and the slot picker") responds to the review's suggestion to scan states a resting scan misses.

## 4. Additional findings from this reading

1. **Hover-only content** in `TripleHelix` (E5.06): popover text unreachable by keyboard, touch or screen reader (WCAG 2.1.1, 1.4.13).
2. **Trajectory tabs** (`the-journey.tsx:115-124`) are plain buttons with no selected state exposed.
3. **Application progress bar** is a div with a width style and no `role="progressbar"`; the "Section n of N" text carries the information (`application-form.tsx:316-321` region).
4. **Heading skips**: `/ecosystem` h2 to h4 to h5 inside `TripleHelix`; search results h3 under h1; dashboard founder view h3 under h2.
5. **Table fallback**: `Table` renders two trees and no `scope`, `caption` or scroll cue (E5.07).
6. **Pagination** disabled ends are `aria-disabled` spans, which are not focusable and so not announced in a Tab sweep; acceptable.
7. **Unverified claim in copy**: "Saved automatically" (E5.03).
8. **Avatar** is always `alt=""`; the person's name is adjacent at every call site read.
9. **404 and error pages** have an `h1` and actionable links, but only the 404 asserts its copy in a test.

## 5. Release guidance

Treat the automated suite as a regression gate, not evidence of conformance. `ACCESSIBILITY-MANUAL-TEST.md` is the human script; the review's own "Needs a human with a screen reader" list (twelve items) has not been executed. No claim of WCAG 2.2 AA conformance can be made from the code alone.
