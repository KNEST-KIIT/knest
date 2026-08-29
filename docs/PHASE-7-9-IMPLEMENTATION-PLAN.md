# Phase 7-9 Implementation Plan — Dashboard, Homepage Narrative, Ecosystem Surfaces

> Written before any Phase 7-9 code. Every data-model claim below was checked against
> the actual current collections (`src/payload/collections/events.ts`,
> `startups.ts`, `mentors.ts`) as they exist today, not against what Phase 2's plan
> intended them to become — several gaps below are real, verified absences, not
> hypothetical ones. This plan also carries forward the priority list from
> `docs/PHASE-5-6-RETROSPECTIVE.md`: item 1 (design system consolidation) is §1 of
> this document and is the gate before any Phase 7-9 UI is written.

---

## 0. The standard this phase is held to

Restated because it's the difference between shipping this well and shipping a
CRUD app that happens to be about entrepreneurship:

- The homepage is a **narrative**, not a page with sections. A visitor reads it
  top to bottom and arrives at "start your journey" having been told a story, not
  shown a feature list.
- The five signature experiences (WHAT IF? · WHERE ARE YOU? · THE KNEST JOURNEY ·
  THE ECOSYSTEM · BUILT WITH KNEST) are the **entire** motion/interaction budget
  for the public site, per the interaction-budget rule already set in
  `UX_WIREFRAMES.md §11`. Nothing else on the site gets bespoke motion.
- Every institutional claim (mission, objectives, the Triple Helix framing) comes
  from `CONTENT_SPEC.md §0` — sourced from KNEST's own pitch deck — not invented.
  Every startup, mentor, testimonial, and metric comes from the CMS or doesn't
  render at all; `EmptyState` is not a fallback, it's a first-class outcome (§46).
- The program → application → cohort → mentor → event → startup chain is real
  relational data, queried through it, not five collections that happen to share a
  homepage.

---

## 1. Design system audit & canonical primitives

Direct response to retrospective §9 (`PHASE-5-6-RETROSPECTIVE.md`): the heading
utility string was hand-copied 35 times, `SectionHeading` was used in 3 places out
of many eligible ones, and no `Table` or `Avatar` primitive exists. This section is
the gate — no Phase 7-9 page gets written until it's done.

### 1a. Audit of what exists (`src/components/ui/`, as of Phase 1-6)

| Primitive | File | Status |
|---|---|---|
| `Button` / `ButtonLink` | `button.tsx` | Solid, well-adopted |
| `Field`, `Input`, `Select`, `Textarea` | `field.tsx` | Solid, well-adopted |
| `PasswordInput` | `password-input.tsx` | Solid, single-purpose |
| `Card`, `LinkCard`, `CardTitle` | `card.tsx` | Adopted for programs/startups grids |
| `Section`, `SectionHeading`, `Prose` | `section.tsx` | **Under-adopted** — see below |
| `Tag`, `StatusDot` | `tag.tsx` | Solid, but status-badge *wrapper* logic (label+tone lookup) has been rewritten twice (`ProgramStatusBadge`, `ApplicationStatusBadge`) instead of sharing one generic wrapper |
| `EmptyState` | `empty-state.tsx` | Solid, correctly used everywhere content can be absent |
| `SingleSelect`, `MultiSelect` (option-list) | `(member)/onboarding/option-list.tsx` | Good component, **wrong location** — it's a design-system primitive (already reused by the application form in Phase 6) living inside a feature folder instead of `src/components/ui/` |
| `RichText` | `src/components/content/rich-text.tsx` | Solid, correctly scoped outside `ui/` since it's CMS-specific |

### 1b. Fixes required before Phase 7-9 UI (do these first, as one small pass)

1. **Move `SingleSelect`/`MultiSelect` into `src/components/ui/`** as `OptionList`
   (or keep the names, just relocate + add to the barrel export). It's already a
   cross-feature primitive in practice (onboarding, applications); its location
   should say so. Mentor directory filtering (§4.5) and event RSVP forms will use
   it next.
2. **Adopt `SectionHeading` everywhere** the 35-instance pattern currently appears
   by hand. Mechanical, low-risk, but must happen before Phase 7-9 adds ~15 more
   heading instances across events/resources/startups/mentors/ecosystem/about —
   otherwise the count doubles instead of collapsing.
3. **Add `Heading`** as a more general primitive than `SectionHeading` (which is
   sized for hero-scale section titles). Phase 7-9 needs card-level and
   subsection-level headings (a startup's "THE PROBLEM" story-arc heading, a
   mentor card's name, an event card's title) that are the same display face at
   smaller, explicit sizes — `<Heading as="h3" size="heading">` rather than a new
   hand-rolled className each time.
4. **Add `Avatar`** — circular photo with initials fallback, two sizes (`sm` for
   inline mentions, `md` for cards/profile headers). Needed immediately by: mentor
   cards (§4.5), founder attribution on startup profiles (§4.4), event speakers
   (§4.2), and the dashboard's "Welcome back, [name]" (§4.1). Zero instances exist
   today — every one of these would otherwise hand-roll a `<img>`-or-fallback
   pattern independently, repeating the exact mistake §9 already flagged once.
5. **Add `Table`** — one instance exists today (staff applications queue) with no
   responsive fallback, contradicting `UX_WIREFRAMES.md §8`'s own mobile-table rule.
   Build it once, correctly (collapses to a card list under a breakpoint, per the
   rule that already exists but wasn't applied), and retrofit the existing staff
   table onto it. Needed again by the mentor directory's optional table view and
   any future admin list.
6. **Add `StatusBadge<T>`** — generic version of the twice-duplicated
   `{label, tone}` lookup pattern (`ProgramStatusBadge`, `ApplicationStatusBadge`).
   Phase 7-9 adds at least one more status-bearing entity (event registration:
   open/full/closed; see §4.2) — that's the third instance the retrospective said
   should trigger extraction.
7. **Add `loading.tsx` and `error.tsx` boundaries** at the App Router segment level
   for every new route group added in this phase (`(public)/events`,
   `(public)/resources`, `(public)/startups`, `(public)/mentors`,
   `(member)/dashboard`), using a shared `<Skeleton>` primitive that mirrors the
   final layout's grid shape (per `UX_WIREFRAMES.md`'s "loading is a skeleton
   matching final layout" rule — currently unmet everywhere, per retrospective
   §10). `error.tsx` renders `CONTENT_SPEC.md §9`'s 500 copy, not Next's default.
8. **Establish the `aria-live` convention** once, as a tiny `<LiveRegion>`
   primitive (a visually-hidden `aria-live="polite"` container with a `message`
   prop), and use it in: the programs filter (retrofit — this was already a
   written, unmet requirement per retrospective §10), the events filter (new), the
   application form's save indicator (retrofit), and the mentor directory filter
   (new). One primitive, four call sites, instead of four independent
   almost-right implementations.
9. **`Dialog`** — audited, not built. Nothing in this phase's confirmed scope needs
   a modal (event RSVP is a full action, not a dialog; status changes already use
   an inline form). Noted so it isn't silently forgotten when something in Phase
   10-12 does need it — not built speculatively now.

### 1c. Explicitly not duplicated

Metadata (SEO title/description) already has one path (`seoField` in
`src/payload/fields/seo.ts`, consumed via `generateMetadata` per page) — every new
page in this plan uses that exact pattern, no new metadata helper.

---

## 2. Information architecture & relationships

### 2a. The relational chain, made concrete

The brief's chain — program → application → cohort → participation → milestones →
events → mentors → startup — maps to real fields as follows. Two links are
**currently missing** and are called out as required schema work, not assumed:

```
Program (cms)
  │
  ├─ has many Cohorts (cms: Cohort.program → Program)
  │     │
  │     ├─ has many Startups (cms: Startup.cohort → Cohort)      ✅ exists
  │     ├─ has many Mentors  (cms: Cohort.mentors → Mentor)      ✅ exists
  │     └─ has many Events   (cms: Event.cohort → Cohort)        ❌ MISSING —
  │                            Event only links to Program, not the specific
  │                            Cohort running it. Adding Event.cohort (optional,
  │                            falls back to Program if unset) is required so
  │                            "your cohort's events" is queryable, not just
  │                            "this program's events in general."
  │
  ├─ has many Applications (app: Application.programId → Program.id)   ✅ exists
  │     └─ Application.status = 'accepted' is "participation" —
  │        no separate participation table; an accepted application IS
  │        the participation record. Nothing new needed here.
  │
  ├─ has "milestones" via Program.timeline (cms array field)     ✅ exists,
  │     reused as-is — a founder's "next milestone" (§4.1) is the next
  │     unelapsed entry in their accepted program's own timeline, not a
  │     separate per-founder milestone-tracking table (that stays deferred,
  │     per PRODUCT_ARCHITECTURE.md §7's "founder workspace" boundary).
  │
  └─ Event.speakers is a freeform array (name/title/org typed by hand),
       NOT a relationship to Mentor.                              ❌ GAP —
       when a KNEST mentor speaks at their own event, they're re-typed as
       a stranger instead of linked to their real profile. Add an optional
       Event.mentorSpeakers relationship (hasMany, relationTo: mentors)
       alongside the existing freeform speakers array (kept for outside
       guests who aren't in the Mentors collection at all).
```

Two required CMS additions fall out of this, both additive (no migration of
existing content, both optional fields):

| Collection | Field to add | Why |
|---|---|---|
| `Events` | `cohort` (relationship → `cohorts`, optional) | Ties an event to the specific run of a program, not just the program in general — needed for a cohort's "your events" and for the dashboard's stage-matched event recommendations to be precise rather than program-wide |
| `Events` | `mentorSpeakers` (relationship → `mentors`, hasMany, optional) | Connects a real mentor profile to the event they're speaking at, so their bio/photo render from one source instead of being retyped |
| `Mentors` | `userId` (text, optional, mirrors `Founders.userId` which already exists) | Without this, a signed-in mentor's dashboard (§4.1) has no way to find their own public profile — `Founders` already solved this exact problem in Phase 2 and `Mentors` never got the same field |

### 2b. New operational (app-schema) data required

**Event registrations** — currently, `Events.registrationUrl` is an *external*
link field; KNEST has no internal record of who's coming to its own events. That
makes `CONTENT_SPEC.md §7`'s dashboard section ("Upcoming: Registered") and the
event-reminder email impossible to build honestly. New table:

```
app.event_registrations
  id            text (uuid) PK
  userId        text FK → app.users, cascade
  eventId       integer                    -- Payload Event.id, same
                                            -- plain-integer-not-FK pattern as
                                            -- Application.programId (spec §32)
  registeredAt  timestamp
  UNIQUE (userId, eventId)                 -- idempotent register, same
                                            -- pattern as applications_user_program_idx
```

Capacity (`Events.capacity`, already exists) is enforced at registration time by
counting existing rows — no denormalized counter, to avoid a second source of
truth that can drift.

**No new table for startups, resources, or mentors.** Resource views/saves and
startup-follow are explicitly out of scope for this phase (see §5) — building
tracking tables for interactions nobody asked for yet would be exactly the
"stubbing to look big" the plan has avoided since Phase 0.

### 2c. Site map

```
PUBLIC
  /                      homepage — the 5-experience narrative (§4.7)
  /programs, /programs/[slug]         (exists, Phase 5)
  /startups, /startups/[slug]         NEW (§4.4)
  /events, /events/[slug]             NEW (§4.2)
  /resources, /resources/[slug]       NEW (§4.3)
  /mentors, /mentors/[slug]           NEW (§4.5)
  /ecosystem                          NEW (§4.7d — Triple Helix, infrastructure, partners)
  /about                              NEW (§4.7e — mission, objectives, tagline)
  /invest                             NEW (§4.6)

MEMBER
  /dashboard                          REBUILT — role-aware (§4.1)
  /dashboard/applications             (exists, Phase 6, unchanged)
  /dashboard/events                   NEW — "my events" (§4.1/§4.2)
  /onboarding, /apply/[program]       (exist, unchanged)

ADMIN
  /admin (Payload)                    Events/Resources/Startups/Mentors already
                                       manageable here since Phase 2 — this phase
                                       adds the two new relationship fields (§2a)
                                       to the existing collections, nothing new
  /admin/applications                 (exists, Phase 6, gets the retrospective's
                                       fixes — see §0/priority carried forward)
```

---

## 3. Build order

Sequenced so nothing links to a page that doesn't exist yet, and so the homepage
(which features real content from every other surface) is built last:

```
1. Design system consolidation (§1)         — gate, no page work starts before this
2. Schema + CMS field additions (§2a, §2b)   — migration + Payload field additions
3. Events (§4.2) — public pages + registration
4. Resources (§4.3) — public pages
5. Startups (§4.4) — public pages + story-arc CMS fields
6. Mentors (§4.5) — public directory
7. Investor foundation (§4.6) — /invest, assembles existing content, no new schema
8. Ecosystem + About (§4.7d/e) — institutional pages, Triple Helix diagram
9. Dashboard (§4.1) — now every "what's coming up" data source exists to pull from
10. Homepage narrative (§4.7) — last; every link target and every "featured" pull
    now points at something real
```

---

## 4. Feature specifications

### 4.1 Dashboard (role-aware)

**User problem.** A signed-in person opens `/dashboard` and should not have to
work out what to do — the screen answers "what should I do next," differently for
a student, a founder, and a mentor, per `CONTENT_SPEC.md §5`.

**User journey.** Land on `/dashboard` → see identity confirmed ("Welcome back,
[name]") → see exactly one primary next action → see secondary context (upcoming
events, resources, or program status) below it. A student who dismisses/completes
their one action sees the next one on return, not a static card.

**Data model.** No new tables. Reads: `users` (role, stage, name),
`applications` (status, program), `notifications` (unread — **this is the fix for
retrospective §6**: the dashboard is where the already-written notifications table
finally gets read), `event_registrations` (§2b, for "your events"), plus CMS reads
for recommended events/resources filtered by stage/interests.

Founder's "next milestone" reads `Program.timeline` (existing field, §2a) for
their accepted program, not a new milestones table — the next entry whose implied
date hasn't passed, or the first entry if none carry dates.

Mentor's "your mentor profile" resolves via the new `Mentors.userId` field (§2a):
if no matching published Mentor document exists, render an honest empty state
("Your mentor profile is with our team" — this is already the copy in
`CONTENT_SPEC.md §4` step 6's mentor path) rather than a blank section.

**Route structure.** `/dashboard` (rebuilt), `/dashboard/events` (new, "my
events" list, mirrors `/dashboard/applications`'s existing pattern).

**Permissions.** `requireUser()` for the layout (per the retrospective-adjacent
fix already made in Phase 6: onboarding completion is NOT required to view
`/dashboard/applications`, but IS required for the root `/dashboard` page itself,
since it needs stage/role data to personalize — this existing split is correct and
unchanged). `/dashboard/events`: `requireUser()` only, same reasoning as
`/dashboard/applications`.

**Components.** `Heading`, `Avatar` (new, §1b), `StatusBadge` (new, §1b) for
notification/application status, `EmptyState`, `Card`. One new component:
`NextStepCard` — the single-action hero card, role-variant via a `variant` prop
rather than three separate components (variants share layout, differ in content
source).

**CMS requirements.** None beyond §2a's field additions (already required for
Events/Mentors regardless of dashboard).

**Analytics events.** `dashboard_view` (with `role`), `next_step_click`,
`notification_read`.

**Empty states.** No applications: existing copy from `dashboard/applications`,
reused. No upcoming events matching stage/interests: falls back to *any* upcoming
event rather than showing nothing (a near-match beats an empty dashboard) — if
zero events exist at all, the honest `CONTENT_SPEC.md §8` events empty state.
Mentor with no profile yet: see above.

**Acceptance criteria.**
- A student who has completed onboarding but taken no other action sees exactly
  one next-step card, sourced from `recommend()`'s output (already built, Phase 4)
  — not re-derived independently.
- A founder with an accepted application sees their program name, the next
  timeline entry, and a link to their application detail.
- Unread notifications (§2, retrospective fix) surface as a visible count/list —
  the first UI in the entire app to read the `notifications` table.
- Marking a notification read updates `readAt` and removes it from the unread
  count without a full page reload.

**E2E tests.** Script pattern following `scripts/verify-auth-flows.sh`'s style:
seed a student with an in-progress application, load `/dashboard`, assert the
next-step card and application status both render; trigger a status change via
the admin API (already exists, Phase 6), assert the resulting notification
appears unread on next dashboard load, mark it read, assert it's gone from the
unread count.

---

### 4.2 Events

**User problem.** Someone who is only curious needs a way to participate before
they're ready to apply to anything (`USER_JOURNEYS.md` Journey 1) — events are
that first action, not a secondary content type bolted onto programs.

**User journey.** `/events` → filter by type/format/stage → open an event →
understand what it is, who's speaking, whether it connects to a program → register
(signed in) or sign up first (signed out, `?next=` preserved, matching the
existing `/apply` pattern) → appears on `/dashboard/events` and gets a reminder
email close to the date.

**Data model.** `Events` CMS collection (exists) + two new fields (§2a:
`cohort`, `mentorSpeakers`) + new `app.event_registrations` table (§2b).

**Route structure.** `/events` (list, filtered via URL search params — same
pattern as `/programs`), `/events/[slug]` (detail).

**Permissions.** Public read (list/detail) via `readPublished`, unchanged from
existing Events access config. Registration requires `requireUserOrThrow()`,
mirroring `startApplication`'s pattern exactly — including its **fix from the
retrospective** (§4 of the retrospective: use `onConflictDoNothing().returning()`
for the idempotent register, not check-then-insert, so this feature doesn't
introduce the same race condition freshly).

**Components.** `EventCard` (uses `Avatar` for speakers, `StatusBadge` for
open/full/closed), `Table`/`LinkCard` grid for the list (grid, not table — cards
suit events better; `Table` primitive is for the mentor directory's optional dense
view and admin lists), `LiveRegion` for the filter count.

**CMS requirements.** The two field additions from §2a. No new collection.

**Analytics events.** `event_view`, `event_register`, `event_register_full`
(attempted registration on a full event).

**Empty states.** No events at all: `CONTENT_SPEC.md §8`'s exact copy ("NOTHING
SCHEDULED RIGHT NOW"). Filtered-empty: same pattern as `/programs`'s
"widen a filter" copy, adapted.

**Acceptance criteria.**
- Registering twice for the same event is idempotent (no duplicate row, no
  error) — this is the retrospective's race-condition fix applied proactively
  rather than repeated.
- A full event (registrations = capacity) shows a disabled register action with
  an honest reason, not a silent failure.
- An event with `cohort` set shows on that cohort's program page; an event with
  only `program` set (no cohort) shows on the program page generally — both
  paths tested.

**E2E tests.** Create an event with `capacity: 1` via the CMS API, register one
user (succeeds), register a second (rejected as full), assert the first user's
`/dashboard/events` shows it and the second user's doesn't.

---

### 4.3 Resources

**User problem.** "I have an idea" should lead to validation material and "I am
raising" to fundraising material without the reader knowing what to search for —
the whole point of indexing by stage rather than by topic alone (`CONTENT_SPEC.md
§6`).

**User journey.** `/resources` → filter by stage/format → open a KNEST-hosted
resource (richText body) or follow out to an external one → optionally reached
directly from a dashboard recommendation matching the reader's own stage.

**Data model.** `Resources` CMS collection — already exists, already has `stages`
(hasMany) and `format`. No changes required; this is the one feature in this
phase needing zero schema work.

**Route structure.** `/resources` (list), `/resources/[slug]` (detail, only for
KNEST-hosted ones — an externally-hosted resource's card links straight out,
skipping the detail page, since there's nothing to render there beyond a
redirect).

**Permissions.** Public read only. No write surface beyond the existing CMS.

**Components.** `ResourceCard` (format-tagged via `Tag`, not a new primitive),
`LiveRegion` for filters.

**CMS requirements.** None.

**Analytics events.** `resource_view`, `resource_external_click`.

**Empty states.** `CONTENT_SPEC.md §8`'s existing copy.

**Acceptance criteria.** A resource with `externalUrl` set and no `body` renders
its card with an outbound link and generates no `/resources/[slug]` route (avoids
a page with nothing on it). A resource with `body` set renders full content at its
own slug.

**E2E tests.** Filter `/resources?stage=idea`, assert only stage-matching
resources appear; open one KNEST-hosted resource, assert body renders; assert an
external-only resource's card links out rather than to a blank detail page.

---

### 4.4 Startups

**User problem.** A startup profile that's a single paragraph reads as a listing,
not a story. The brief asks for problem → idea → experiment → program → product →
progress — that's a narrative arc the current schema doesn't structure.

**User journey.** `/startups` → filter by sector/stage/cohort → open a profile →
read the arc from "what was broken" to "where it stands now" → see the program
and cohort it came through (already relational, §2a) → see achievements as a
timeline, not a bulleted afterthought.

**Data model — CMS change required.** `Startups.description` (a single richText
blob) is replaced with a `story` field: an array of typed entries, each
`{ stage: 'problem' | 'idea' | 'experiment' | 'product' | 'progress', heading:
text, body: richText }`, `minRows: 0` (a startup can populate as many stages as
it's actually reached — a startup still at "product" has no honest "progress"
entry yet, and the page should render only the stages that exist, in order,
rather than showing empty ones). This mirrors the array-of-typed-entries pattern
already used for `Programs.timeline` — not a new pattern, an existing one applied
to a second collection. `achievements` (existing array field) stays as-is; it's
already timeline-shaped and correctly scoped to "only what actually happened, no
projections" (spec §46) per its own existing admin description.

Existing `description` field is dropped in favor of `story` — this is a breaking
change to the collection, acceptable because **zero startups have been seeded**
(spec §46 discipline: no fabricated content exists to migrate).

**Route structure.** `/startups` (list), `/startups/[slug]` (detail — the story
arc, achievements timeline, founders via `Avatar`, program/cohort link).

**Permissions.** Public read only (`readPublished`, unchanged).

**Components.** `StoryArc` (new, small — renders whichever `story` stages are
populated as a vertical sequence, reusing `Heading` and `RichText`), `Avatar` for
founders, `Timeline` primitive (new — the achievements list; also the natural
home for a *future* founder-workspace milestone view, per PRODUCT_ARCHITECTURE.md
§7, so building it generically now rather than as a one-off achievements list is
worth the small extra care).

**CMS requirements.** The `story` field replacement above.

**Analytics events.** `startup_view`.

**Empty states.** `CONTENT_SPEC.md §1.9`'s exact copy ("THE FIRST GENERATION IS
BEING BUILT") — this is the one empty state most likely to actually render at
launch, given zero startups are seeded, and it appears at **full section height**
on the homepage too (§4.7), not just on `/startups`.

**Acceptance criteria.** A startup with only `problem` and `idea` stages
populated renders exactly those two, not three empty placeholders. A startup's
cohort link resolves to its program page and that program page's cohort-startups
section (existing, Phase 5) includes it — the relational chain from §2a verified
in both directions.

**E2E tests.** Create a startup with two `story` stages via the CMS API, assert
`/startups/[slug]` renders exactly those two headings in order; attach it to a
cohort, assert it appears on `/programs/[program-slug]` (regression test —
this relationship already works per Phase 5's own E2E verification, this test
just needs to keep passing after the `description` → `story` schema change).

---

### 4.5 Mentors

**User problem.** A founder arrives knowing what they're stuck on (fundraising,
technology, go-to-market), not which named person they want — a browsable
marketplace with photos and bios first is the wrong entry point below the mentor
count KNEST will actually launch with. This is already the design decision
encoded in the existing `Mentors` collection (`expertise` is `required`,
indexed, described in its own admin text as driving "the 'I need help with…'
entry") — this phase builds the UI that decision was waiting for, it doesn't
redesign the decision.

**User journey.** `/mentors` → **"I NEED HELP WITH →"** as the primary entry
(`CONTENT_SPEC.md §1.5`'s language, applied to this page rather than only the
homepage selector) → pick an expertise area → see matching mentors → each
mentor's card states availability honestly (open / limited / unavailable) → a
mentor's own page (optional light profile) links out to LinkedIn for actual
contact — no in-app request flow, matching the deliberate absence already
documented in `PRODUCT_ARCHITECTURE.md §7` ("Mentor matching / booking... below
that threshold, honest is better").

**Data model.** `Mentors` CMS collection (exists) + `userId` field addition
(§2a, needed for the dashboard, §4.1). No new operational table — a mentor
"request" is a `mailto:`/LinkedIn link, not a tracked interaction, by design.

**Route structure.** `/mentors` (the need-first directory), `/mentors/[slug]`
(optional — a light profile page; build it since the collection already has a
`slug` field from Phase 2 and a bio worth more space than a card gives it, but
keep it genuinely light: photo, bio, expertise tags, LinkedIn link, nothing more).

**Permissions.** Public read only.

**Components.** `Avatar`, `Tag` (expertise, reused from existing taxonomy
pattern), the expertise-first filter reuses `OptionList` (relocated per §1b) as a
single-select "what do you need help with" control, not a generic multi-filter
bar like `/programs`' — the interaction model here is deliberately narrower
(pick one need, see matches), matching the CONTENT_SPEC's "I NEED HELP WITH"
framing rather than reusing the programs page's five-filter layout wholesale.

**CMS requirements.** `userId` field addition (§2a).

**Analytics events.** `mentor_directory_view`, `mentor_need_selected` (with
expertise area), `mentor_profile_view`.

**Empty states.** `CONTENT_SPEC.md §8`'s "OUR MENTOR NETWORK IS FORMING" copy —
also likely to render at launch given the current mentor count is zero.

**Acceptance criteria.** Selecting an expertise area filters to mentors whose
`expertise` array includes it, ordered by availability (`open` before `limited`
before `unavailable`, unavailable mentors still shown — honesty over hiding, per
the collection's own existing design intent) rather than hidden outright.

**E2E tests.** Seed two mentors with overlapping and non-overlapping expertise,
assert the "fundraising" filter returns only the matching one; assert an
`unavailable` mentor still appears (not silently filtered out) with the correct
availability label.

---

### 4.6 Investor experience — foundation

**User problem/constraint, stated plainly.** KNEST has no dealflow yet. A filterable
investor dashboard over an empty startup pipeline would communicate exactly one
true thing to an investor: that this ecosystem is younger than the page claims.
This "feature" is therefore explicitly **not** a dashboard, a saved-startups list,
or a deal pipeline — those stay in §5 (deferred), unconditionally, until real
dealflow exists. This section is the honest version.

**User journey.** `/invest` → **"INVEST IN THE ECOSYSTEM"** → upcoming demo days
(pulled from `Events` where `eventType = 'demo_day'` — real relational data, not
hardcoded), a startup showcase (pulled from `Startups` where `featured = true`,
same empty-state discipline as everywhere else), founder stories (`Articles`
where `startup` is set — collection already supports this via its existing
`startup` relationship field, unused until now), a contact pathway.

**Data model.** No new schema. This page is a pure content-assembly layer over
`Events`, `Startups`, and `Articles` — all three collections already exist with
the exact fields this page needs (verified, not assumed: `Events.eventType`,
`Startups.featured`, `Articles.startup` are all already in the Phase 2
collections).

**Route structure.** `/invest` only.

**Permissions.** Public read only.

**Components.** Reuses `EventCard`, startup `LinkCard`, and an `ArticleCard` (new,
small — thumbnail + summary + "read [startup]'s story" link).

**CMS requirements.** None — the point of this section is that nothing new needs
building, only assembling.

**Analytics events.** `invest_page_view`, `invest_contact_click`.

**Empty states.** No demo days scheduled / no featured startups / no founder
stories yet: each section gets its own honest `EmptyState`, independently — a
page that's mostly empty states at launch is the correct, honest rendering of
where KNEST's investor story actually stands, not a bug to paper over.

**Acceptance criteria.** The page renders correctly (no broken sections) when
all three source collections are empty — this is the state it will actually
launch in, so it's the state that must be tested, not just the populated one.

**E2E tests.** Load `/invest` against an empty DB, assert three independent empty
states render (not a single blank page); seed one demo-day event, assert only
that section populates while the other two remain empty states.

---

### 4.7 Homepage narrative & the five signature experiences

This is the section the rest of the plan builds toward — every "featured" pull
and every link target now points at a real page.

**The narrative arc** (unchanged from `CONTENT_SPEC.md §1`, built now against real
content instead of placeholder copy):

```
WHAT IF? → THE PROBLEM → THE PERSON → THE FIRST STEP → KNEST
         → WHERE ARE YOU? → THE KNEST JOURNEY → THE ECOSYSTEM
         → BUILT WITH KNEST → START YOUR JOURNEY
```

The five **signature experiences** — the entire motion budget for the public site
(`UX_WIREFRAMES.md §11`), nothing outside these five gets bespoke interaction:

**① WHAT IF?** — the hero. Unchanged design from `CONTENT_SPEC.md §1.1` /
`UX_WIREFRAMES.md §2.1`: type-only, one-time rise+fade, no stock photography, no
change needed from what was already specified — this phase just means it finally
gets *built* rather than remaining a spec.

**② WHERE ARE YOU?** — the journey selector (`CONTENT_SPEC.md §1.5`). One
addition this phase makes possible that wasn't before: the selection now
genuinely pre-fills `/onboarding?stage=...`, which is real and tested (built in
Phase 4) — this experience was designed correctly from the start and just needed
the destinations to exist.

**③ THE KNEST JOURNEY** — the six-stage progression (exploring → idea →
validation → building → launch → growth). **Now backed by real data**: each stage
lists programs from that stage via `listPrograms({ stage })` (existing function,
Phase 5) — a stage with none renders "Programs for this stage are being built,"
per the existing spec, using real `EmptyState`, not a hardcoded fallback string.

**④ THE ECOSYSTEM** — this is where `CONTENT_SPEC.md §0`'s Triple Helix material
(sourced from the pitch deck, added after Phase 4) becomes the actual diagram: KIIT
University / Schools of KIIT / Corporate Partners, credited as KNEST's own
framing (Etzkowitz & Leydesdorff, 1995), not an invented graphic. This replaces
the earlier, vaguer "ecosystem node diagram" placeholder concept from
`UX_WIREFRAMES.md §2.8` with the specific, real diagram now available. Below the
diagram: a live pull of featured `Partners` (existing collection) and a link to
the full `/ecosystem` page (§4.7d) for the depth version.

**⑤ BUILT WITH KNEST** — featured startups (`Startups.featured`), rendered at
**full section height** whether populated or empty — `CONTENT_SPEC.md §1.9`'s "THE
FIRST GENERATION IS BEING BUILT" is the expected launch state, and the section's
layout must not visibly change shape between zero startups and several (a
collapsed-height empty section reads as broken, per the existing `EmptyState`
design principle already established in Phase 1).

**Data model.** No new schema — the `Homepage` global (built in Phase 2) already
has `featuredPrograms`, `featuredStartups`, `featuredEvents`, `testimonials`,
`metrics` relationship fields and the fixed, reorderable `sections` array. This
phase is the first time that global gets a real front-end to render against.

**Route structure.** `/` only (rebuilds the current placeholder from Phase 1).

**Permissions.** Public. Reading the `Homepage` global is already public
(`access.read: () => true`, set in Phase 2).

**Components.** `Heading`/`SectionHeading` (adopted, not hand-rolled — this page
alone would otherwise reintroduce a dozen instances of the exact pattern §1
exists to eliminate), the Triple Helix diagram (new, small, inline SVG per
`artifact-diagramming` conventions if applicable — static, not a chart library),
`EmptyState` at full height for §5.

**CMS requirements.** None new — every field this page reads already exists on
the `Homepage` global.

**Analytics events.** `homepage_view`, `journey_selector_choice` (with the
selected stage), `signature_experience_scroll` (which of the five sections
became visible — useful for understanding whether the narrative actually gets
read top to bottom or abandoned early).

**Empty states.** Per-experience, as detailed above. The overall rule: this page
launches with real institutional voice and mostly-empty featured sections, and
that combination must read as "early and honest," never as "broken."

**Acceptance criteria.** Toggling a section off in the `Homepage` global (admin,
existing capability from Phase 2) removes it from the rendered page with no
layout gap — this was already a Phase 2 CMS requirement; this phase is the first
time it's verified against a real front-end rather than just the schema.
Reordering sections in the admin changes the rendered order. The five signature
experiences and only those five carry any motion; everything else on the page
renders in its final state immediately.

**E2E tests.** Disable "Built with KNEST" in the admin, load `/`, assert the
section is absent with no visual gap; re-enable it, assert it returns in the
same position. Select "I HAVE AN IDEA" in the journey selector, assert the
resulting `/onboarding` visit has `journeyStage` pre-filled to `idea` (regression
of the Phase 4 pre-fill contract, now exercised from the real homepage instead of
a direct URL).

---

## 5. Explicitly deferred (unchanged discipline from `PRODUCT_ARCHITECTURE.md §7`)

Restated because this phase touches the exact areas where scope creep is most
tempting:

- **Investor dealflow, saved startups, an investor dashboard** — no dealflow
  exists; §4.6 is the honest ceiling for this phase.
- **Mentor matching, booking, availability calendars, session feedback** — the
  directory in §4.5 is need-first browsing, not a marketplace; still true at
  current mentor counts.
- **A founder milestone-tracking system** distinct from a program's own timeline
  — §4.1 reuses `Program.timeline`; a founder-editable milestone list is
  workspace scope, still out of this phase.
- **Resource "saves," startup "follows," or any per-user interaction tracking**
  beyond event registration (§2b) and applications (existing) — nothing in this
  phase's confirmed scope needs it, and building the tracking table before the
  feature that needs it is the "stubbed to look big" failure mode the project has
  avoided since Phase 0.
- **A `Dialog` primitive** — audited (§1b(9)), not built; nothing here needs one.
