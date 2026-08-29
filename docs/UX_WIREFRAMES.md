# KNEST — UX Wireframes

> Screen-by-screen specification for everything in this slice. Layout, hierarchy,
> the one primary action, every state, and responsive behaviour — decided here so
> components implement a spec rather than invent one.
>
> Copy comes from `CONTENT_SPEC.md`. This document covers structure and behaviour.

---

## Global rules

**Grid.** 12 columns ≥1024px · 8 columns 640–1023px · 4 columns <640px.
Gutters 24px desktop, 16px mobile. Content max-width 1280px; prose max-width 68ch.

**Mobile is not a shrunk desktop (§42).** Every screen below states its mobile
behaviour explicitly where it differs structurally.

**Every screen declares exactly one primary action (§41).** One filled button per
viewport. Everything else is secondary or a text link. A screen that cannot name its
primary action does not get built.

**Four states, always.** Loading, empty, error, and content. A screen is not done
until all four are designed. Loading is a skeleton matching final layout — never a
spinner over blank space, never a layout shift on arrival.

**Touch targets** ≥44×44px. **Focus** visible on every interactive element.
**Headings** in document order, one `h1` per page.

---

## 1. Public shell

```
┌──────────────────────────────────────────────────────────────┐
│ KNEST    Programs Startups Ecosystem Events Resources About  │
│                              [START BUILDING]  Log in        │  64px, sticky
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                        page content                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Explore        KNEST          Get involved                  │
│  …              …              …                             │
│  © 2026 KNEST, KIIT University        Privacy · Terms        │
└──────────────────────────────────────────────────────────────┘
```

Header is sticky, becomes opaque with a hairline border after 40px of scroll.
**Mobile:** logo + hamburger; nav opens as a full-screen panel with **START BUILDING**
pinned to the bottom, inside the safe area. Focus is trapped while open; `Esc` closes.

---

## 2. Homepage

Ten sections, CMS-toggleable, fixed order. A disabled section collapses completely —
no empty spacer.

### 2.1 Hero — signature 01

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   WHAT IF YOU                                                │
│   ACTUALLY BUILT IT?          ← --text-hero, up to 8rem      │
│                                  display face, leading 0.92  │
│   Most ideas stay ideas. Not because they were bad —         │
│   because nobody ever took the next step.                    │
│                                                              │
│   [ START YOUR JOURNEY ]   EXPLORE PROGRAMS →                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Full-bleed, ~86vh, never a locked 100vh (mobile browser chrome makes that lie).
Type is the hero; no stock photography. Optional CMS hero media sits behind at low
contrast, and the type must remain AA-legible with it absent or still loading.

**Motion:** headline rises 12px and fades in over 500ms, one time, on load. Nothing
loops. Under `prefers-reduced-motion` it is simply present.

**Mobile:** hero type clamps to ~2.75rem; CTAs stack full-width, primary first.

### 2.2–2.4 Problem · Person · KNEST

Centred prose, max 68ch, generous vertical rhythm (128px desktop / 72px mobile).
Section 2.3 sets its four "maybe…" lines as separate lines, not a paragraph — the
line breaks carry the rhythm. Each line fades in on scroll, 60ms apart, once.

### 2.5 Journey selector — signature 02

**The most important interaction on the site.**

```
┌──────────────────────────────────────────────────────────────┐
│   WHERE ARE YOU RIGHT NOW?                                   │
│   There's no wrong answer, and no stage that's too early.    │
│                                                              │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│   │ I'M CURIOUS │ │ I HAVE AN   │ │ I'M         │  …         │
│   │             │ │ IDEA        │ │ BUILDING    │            │
│   └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│   ┌──────────────────────────────────────────────┐           │
│   │ You don't need an idea yet. Start by finding │  ← reveals│
│   │ problems worth solving.                      │    in situ│
│   │                              [ EXPLORE → ]   │           │
│   └──────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

**Behaviour.** Five cards. Selecting one reveals its response *in place* beneath the
row — no navigation, no modal. The response is the product's first act of listening;
navigating away immediately would waste it. The CTA inside the panel is the only way
onward. Choice persists to `sessionStorage` and pre-fills onboarding step 3.

**States:** nothing selected (no panel, no reserved gap) · selected (panel expands
200ms, height-animated, focus moves to the panel heading) · re-selected (content
crossfades 120ms, panel does not collapse and re-open).

**Keyboard:** cards are a radio group — arrows move, `Enter`/`Space` selects.
**Mobile:** cards become a 2-column grid (last spans full width); the panel appears
directly beneath the grid and scrolls into view.

### 2.6 The journey — signature 03

Horizontal 6-stage progression on desktop; vertical on mobile — a rotated desktop
diagram is unreadable on a phone, so the mobile version is a different layout of the
same data, not a scaled one. Each stage lists its programs from the CMS; a stage with
none reads *"Programs for this stage are being built."*

Scroll-linked highlight of the active stage, `transform`/`opacity` only.
Under reduced motion, all stages render at full contrast at once.

### 2.7 What you get · 2.8 Ecosystem (signature 04) · 2.9 Built with KNEST (signature 05)

Five cards, no icons unless they carry meaning · ecosystem node diagram (static SVG,
`<title>`/`<desc>`, with a text list beneath for screen readers) · startup grid, which
at launch renders the **THE FIRST GENERATION IS BEING BUILT** empty state at full
section size, not a collapsed strip.

### 2.10 Closing

Full-bleed inverted panel (ink ground, paper type). Signal-orange primary CTA.

---

## 3. `/programs`

```
┌──────────────────────────────────────────────────────────────┐
│  FIND WHERE YOU FIT.                                         │
│  Every program is built for a particular stage.              │
├──────────────────────────────────────────────────────────────┤
│  Stage ▾   Sector ▾   Who for ▾   Format ▾   Status ▾        │
│  [idea ×] [AI ×]  Clear all                  6 programs      │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐                   │
│  │ APPLICATIONS OPEN│ │ OPENS 1 APR      │  ← status first   │
│  │ Founder Launchpad│ │ Venture Builder  │                   │
│  │ For students with│ │ For teams with   │                   │
│  │ an early idea    │ │ a working MVP    │                   │
│  │ Idea · 12 weeks  │ │ MVP · 6 months   │                   │
│  │ Next: April 2026 │ │ Next: April 2026 │                   │
│  │ VIEW PROGRAM →   │ │ VIEW PROGRAM →   │                   │
│  └──────────────────┘ └──────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

**Filters are URL search params** (`?stage=idea&sector=ai`) — server-rendered,
shareable, back-button correct, and they survive a refresh. No client-side filter
state. Result count is live and announced via `aria-live="polite"`.

Grid: 3 columns desktop / 2 tablet / 1 mobile. Status badge is the first element in
the card because "can I apply right now" is the first question asked.

**Mobile filters** open in a bottom sheet with an **APPLY FILTERS** button — applying
each filter individually would trigger a reload per tap.

**States:** loading (6 skeleton cards) · filtered-empty (*"No programs match…"* +
**Clear all**) · fully empty (**PROGRAMS ARE BEING FINALISED** + account CTA).

---

## 4. `/programs/[slug]`

Order is the argument: fit is established before commitment is requested.

```
┌──────────────────────────────────────────────────────────────┐
│  APPLICATIONS OPEN · CLOSES 12 MARCH                         │
│  FOUNDER LAUNCHPAD                                           │
│  Twelve weeks from idea to something real.                   │
│  Idea stage · 12 weeks · Cohort of 20 · Starts April 2026    │
├────────────────────────────────────┬─────────────────────────┤
│  WHO THIS IS FOR                   │  ┌───────────────────┐  │
│  WHAT YOU'LL BUILD                 │  │ Closes 12 March   │  │
│  WHAT YOU'LL GET                   │  │ 5 days left       │  │
│  HOW IT RUNS      (timeline)       │  │                   │  │
│  WHO YOU'LL MEET  (mentors)        │  │ [ APPLY ]         │  │
│  WHAT WE ASK OF YOU                │  │ ~20 min · save    │  │
│  QUESTIONS        (FAQ accordion)  │  │ and come back     │  │
│                                    │  └───────────────────┘  │
│  READY?  [ APPLY TO THIS PROGRAM ] │      sticky ≥1024px     │
└────────────────────────────────────┴─────────────────────────┘
```

Sticky apply card on desktop; on mobile it becomes a **fixed bottom bar** appearing
only after the "WHO THIS IS FOR" section has been scrolled past — so the phone
experience still leads with fit rather than the ask.

Mentors and startups on this page are pulled through the cohort relation, never
re-entered. Empty sub-sections are omitted entirely rather than shown as empty
headings.

**Apply CTA states:** open · closing soon (signal-orange countdown) · not yet open
(**NOTIFY ME**) · closed (next cohort date + **NOTIFY ME**) · already applied
(**VIEW YOUR APPLICATION**) · signed out (**APPLY** → `/signup?next=/apply/[slug]`).

---

## 5. Auth screens

Single centred column, 420px max. No marketing sidebar — the decision is already made;
anything else is noise.

```
┌────────────────────────────────┐
│           KNEST                │
│  START YOUR JOURNEY.           │
│  One account. It follows you   │
│  from your first event to      │
│  your first venture.           │
│                                │
│  [ Continue with Google ]      │  ← only if configured
│  ───────── or ─────────        │
│  Your name    [____________]   │
│  Email        [____________]   │
│  Password     [____________]   │
│  At least 12 characters.       │
│                                │
│  [   CREATE ACCOUNT   ]        │
│  Already have one? Log in.     │
└────────────────────────────────┘
```

Errors render inline beneath the field, in `--color-critical`, with `aria-describedby`
and `aria-invalid`. A failed submit moves focus to the first invalid field. Password
has a show/hide toggle labelled for screen readers. Submitting disables the button and
switches its label — never a full-screen overlay.

---

## 6. Onboarding

```
┌──────────────────────────────────────────────────────────────┐
│  KNEST                                    Step 3 of 6        │
│  ████████████░░░░░░░░░░░░                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   WHERE ARE YOU RIGHT NOW?                                   │
│   Be honest — there's no stage that's too early.             │
│                                                              │
│   ┌────────────────────────────────────────────┐             │
│   │ ● I have an idea                           │             │
│   ├────────────────────────────────────────────┤             │
│   │ ○ Validating it                            │             │
│   └────────────────────────────────────────────┘             │
│                                                              │
│   ℹ You told us this on the way in — change it if            │
│     that's not right.                                        │
│                                                              │
│   ← BACK                          [ CONTINUE ]               │
└──────────────────────────────────────────────────────────────┘
```

One question per screen. No global nav — this flow has one exit, and a nav bar invites
abandonment. Progress bar is honest: six steps, never a fake near-complete state.

**Persistence:** each step writes on CONTINUE, so closing the tab loses at most the
current step. Returning resumes at the first unanswered step.

**Adaptive:** step 3 is skipped for mentors, investors and partners (they have no
founder stage); step 5 asks them for expertise and availability instead. Steps 4 and 5
show a **Skip for now** text link — optional means optional.

**Step 6 — the payoff:**

```
┌──────────────────────────────────────────────────────────────┐
│   YOUR KNEST PATH                                            │
│   ┌────────────────────────────────────────────┐             │
│   │  VALIDATE                                  │             │
│   │  You have an idea. The next job is         │             │
│   │  finding out if it's real.                 │             │
│   │                                            │             │
│   │  Why this: you have an idea but haven't    │  ← always   │
│   │  tested it yet — validation comes before   │    shown    │
│   │  building.                                 │             │
│   │                                            │             │
│   │  [ FIND A PROGRAM ]                        │             │
│   └────────────────────────────────────────────┘             │
│   Not quite right? Change your answers.                      │
└──────────────────────────────────────────────────────────────┘
```

The reason is a permanent element, not a tooltip. A recommendation you cannot
interrogate is a recommendation you cannot trust.

**Mobile:** options are full-width stacked rows; CONTINUE is a fixed bottom bar within
the safe area.

---

## 7. `/dashboard`

```
┌──────────────────────────────────────────────────────────────┐
│  WELCOME BACK, PRIYA.                                        │
│  Here's where you are.                                       │
│                                                              │
│  YOUR JOURNEY                                                │
│  ○──────●──────○──────○──────○                               │
│      Exploring   Idea   Validation  Building                 │
│                                                              │
│  YOUR NEXT STEP                                              │
│  ┌────────────────────────────────────────────┐              │
│  │  Join the next ideation session            │              │
│  │  Thursday, 14 March · 5pm · Startup Studio │              │
│  │  [ RESERVE A PLACE ]                       │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  WHAT'S COMING UP        ·        WORTH READING              │
└──────────────────────────────────────────────────────────────┘
```

**One next step. One card. One button.** This is the single most important layout
constraint in the member surface: a first-time student shown twelve panels learns they
are behind on eleven things.

Secondary sections are quieter — smaller type, no filled buttons.

**Role variants** (§10): founder leads with applications and program; mentor leads
with profile status and supported programs. Same shell, different content, one
`h1` pattern.

**Empty:** *"Nothing on your calendar yet. Here's what's coming up at KNEST."*
Never an empty dashboard — there is always a next step, even if it's "come to an event".

---

## 8. `/dashboard/applications`

Desktop table: Program · Submitted · Status · Action.
**Mobile becomes cards, not a horizontally scrolling table** — four columns cannot be
scanned on a phone.

```
┌──────────────────────────────────┐
│ Founder Launchpad                │
│ Submitted 2 March                │
│ ● UNDER REVIEW                   │
│ Someone is reading your          │
│ application now.                 │
│ View application →               │
└──────────────────────────────────┘
```

Status is a coloured dot plus a **text label** — never colour alone (§44). Each status
carries its sub-line from `CONTENT_SPEC.md §5`, because a bare label leaves the
applicant guessing what it implies. Drafts sort first and show **CONTINUE**.

---

## 9. `/apply/[program]`

```
┌──────────────────────────────────────────────────────────────┐
│  APPLY TO FOUNDER LAUNCHPAD          Section 2 of 4          │
│  ████████████░░░░░░░░░░░░                      Saved 14:32   │
├──────────────────────────────────────────────────────────────┤
│   ABOUT YOUR IDEA                                            │
│                                                              │
│   What problem are you trying to solve?                      │
│   ┌────────────────────────────────────────────┐             │
│   │                                            │             │
│   └────────────────────────────────────────────┘             │
│   140 left                                                   │
│                                                              │
│   Who has this problem? (optional)                           │
│   …                                                          │
│                                                              │
│   ← BACK                    [ SAVE & CONTINUE ]              │
└──────────────────────────────────────────────────────────────┘
```

Questions render from the program's configured set — six field types: text, textarea,
select, multi-select, URL, file. **Nothing about this screen is program-specific in
code.**

**Save behaviour.** Writes on every section transition and on a 10-second idle debounce.
The "Saved [time]" indicator is always visible: an applicant who is not sure their work
is safe will not leave the page, and will lose it when their browser reloads. Character
counters appear at 80% of the limit, not before.

**Upload:** drop zone plus a real `<input type="file">` (drag-and-drop alone is
unusable by keyboard). Shows name, size, progress, and remove. Type and size validated
client-side for feedback and **again server-side** for enforcement.

**Review step:** every answer grouped by section, each with an **Edit** link returning
to that section with focus on that field. Then **SUBMIT APPLICATION**.

**Confirmation** is a full page, not a toast: it carries what happens next and by when.
A toast is dismissible and forgettable, and this is the moment the applicant most
needs reassurance.

**Deadline passed while drafting:** the form becomes read-only with an explanation and
a link to the next cohort. Their answers are preserved, never discarded.

---

## 10. `/admin`

Payload's console, gated by `staffRole` (404 for everyone else).

```
┌────────────┬─────────────────────────────────────────────────┐
│ KNEST      │  DASHBOARD                                      │
│            │                                                 │
│ Dashboard  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│ Content    │  │   0    │ │   0    │ │   0    │ │   0    │    │
│ Programs   │  │ apps   │ │ active │ │ upcom. │ │ new    │    │
│ Applicat.  │  │ today  │ │ progs  │ │ events │ │ users  │    │
│ Startups   │  └────────┘ └────────┘ └────────┘ └────────┘    │
│ Mentors    │                                                 │
│ Events     │  NEEDS YOUR ATTENTION                           │
│ Resources  │  Nothing waiting. ← honest, not padded          │
│ Users      │                                                 │
│ Settings   │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

**Counters read real tables and render `0` (§21).** Zero is information; a fabricated
demo number is a lie that outlives the demo.

Sidebar items render only for areas the `staffRole` can reach — a reviewer sees
Applications, not Settings. That is a rendering decision; `requireAdminArea()` enforces
it server-side regardless.

**Homepage editor:** a fixed list of predefined sections, each with an enable toggle
and drag-to-reorder *within the list*. Content fields per section. **No free-form
canvas, no arbitrary block nesting** — the design system is not editable through the
CMS, deliberately and permanently (§22).

**Application review:** list with filters (program, status, date), then a detail view
showing answers in configured order, documents inline, applicant profile alongside, and
a status control. Changing status prompts for an optional note, notifies the applicant,
and writes an audit entry.

---

## 11. Motion budget

Motion appears in exactly the five signature moments and nowhere else. Everything
outside them is instant or a ≤150ms opacity change.

| # | Moment | Motion | Duration |
|---|---|---|---|
| 01 | Hero | Headline rise + fade, once | 500ms |
| 02 | Journey selector | Panel height expand, content crossfade | 200 / 120ms |
| 03 | Journey stages | Scroll-linked highlight | continuous, transform only |
| 04 | Ecosystem | Node/edge draw-in on first view, once | 800ms |
| 05 | Built with KNEST | Staggered card fade | 60ms apart |

**Rules.** `transform` and `opacity` only — never layout properties. Nothing loops.
Nothing blocks interaction. Nothing delays content. Under `prefers-reduced-motion`,
every one of these renders in its final state immediately, with no loss of information
(§43/§44).

---

## 12. Responsive summary

| Screen | Desktop | Tablet | Mobile |
|---|---|---|---|
| Nav | Full inline | Full inline | Hamburger → full-screen panel |
| Hero | Up to 8rem type | ~5rem | ~2.75rem, CTAs stacked full-width |
| Journey selector | 5 across | 3 + 2 | 2-col grid, panel below |
| Programs grid | 3 col | 2 col | 1 col |
| Program filters | Inline bar | Inline bar | Bottom sheet + APPLY |
| Program detail | 2-col, sticky apply | 2-col | 1-col, fixed bottom apply bar |
| Onboarding | Centred, 640px | Centred | Full-width, fixed bottom CONTINUE |
| Dashboard | 2-col below fold | 1 col | 1 col |
| Applications | Table | Table | Cards |
| Application form | Centred 720px | Centred | Full-width, fixed bottom actions |

---

## 13. Accessibility checklist (§44)

Applies to every screen above; verified in the Phase 12 pass.

- Semantic landmarks (`header`/`nav`/`main`/`footer`), one `h1`, no skipped levels
- Full keyboard operation; visible focus everywhere; logical tab order
- Skip-to-content link as the first focusable element
- Every input has a `<label>`; errors linked by `aria-describedby` + `aria-invalid`
- Status conveyed by text, never colour alone
- 4.5:1 contrast for body text, 3:1 for large text and UI boundaries
- Alt text on meaningful images; `alt=""` on decorative ones
- Live regions for async changes (filter counts, save indicator, submit result)
- Focus trapped in modals and the mobile nav; `Esc` closes; focus returns to trigger
- `prefers-reduced-motion` honoured — the full motion budget above degrades to static
