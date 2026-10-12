# E5.06 Homepage composition and the ecosystem section

Files: `src/app/(public)/page.tsx`, `hero.tsx`, `narrative.tsx`, `journey-selector.tsx`, `the-journey.tsx`, `ecosystem-section.tsx`; `src/server/content/homepage.ts`, `homepage-copy.ts`, `ecosystem-counts.ts`, `ecosystem-groups.ts`, `ecosystem-types.ts`. Unused: `the-ecosystem.tsx`, `built-with-knest.tsx`.

## 1. Composition model

The homepage is an ordered list of section keys held in the Payload `homepage` global (`sections: [{key, enabled}]`). `enabledSections()` filters out `enabled === false` and falls back to the fixed default order when the array is empty (`homepage.ts:63-68`). The default order is `hero, problem, person, knest, journey_selector, journey, offer, ecosystem, startups, closing` (`:7-18`). `page.tsx:50-165` is a `switch` over the key, so editors can reorder or hide sections but cannot add new ones.

Content fallback: if the global read fails or has no `heroHeadline`, `FALLBACK_HOMEPAGE` is used. It is the approved copy from CONTENT_SPEC section 1 and nothing else (`homepage.ts:20-33`). The failure is logged, not shown (`:54-58`). `id: 1` and `createdAt: new Date()` are synthesised; nothing persists it.

Observed behaviours of the switch:

| Key | Renders | Note |
|---|---|---|
| `hero` | `Hero` | Headline, optional subhead, primary CTA to `/signup`, optional secondary CTA to `/programs` (`hero.tsx:12-42`). Both destinations are fixed in code, the CMS supplies only the labels. |
| `problem` | `Narrative` | Renders all three prose blocks: problem, person (only if lines exist) and "what KNEST is" (only if body) (`narrative.tsx:14-57`). |
| `person`, `knest` | `null` (`page.tsx:58-63`) | Their content is rendered by `problem`. Consequence: disabling `problem` removes all three blocks; disabling `person` or `knest` in the CMS has no effect. The CMS toggle is misleading. |
| `journey_selector` | `JourneySelector` in a `Section` | Client component. |
| `journey` | `TheJourney` | Receives the program list and an `unavailable` flag. |
| `offer` | inline JSX | Five static items with links (`page.tsx:22-28,74-126`). Copy is in code, not CMS. |
| `ecosystem` | `EcosystemSection` | Counts, see section 3. |
| `startups` | `null` (`:131-133`) | `BuiltWithKnest` exists but is not mounted. |
| `closing` | inline JSX | Heading, optional body and CTA from the global; fixed link to `/programs` (`:134-161`). |

Dead code: `the-ecosystem.tsx` (a TripleHelix teaser using `Reveal`) and `built-with-knest.tsx` are imported nowhere (searched `src` and `tests`). They carry hardcoded copy such as "Institutional Framework" and should be deleted or documented as parked.

## 2. Hero, journey selector, journey

`Hero` is a server component; its motion comes from `RevealHeading` and `Reveal` (E5.10). The image is `/images/hero_bg_modern.jpg` with `alt="Knest Infrastructure"` and `preload` (`hero.tsx:50`). It is decorative and the alt text adds noise to a screen reader (accessibility review finding 31).

`JourneySelector` (`journey-selector.tsx`, client): five options, each a `role="radio"` button inside a `role="radiogroup"` (`:81-88`), choosing reveals a response and a CTA.
- Destination: stage options go to `/onboarding?stage=<x>`; signed-out visitors get `/signup?next=<encoded onboarding url>` (`:52-55`), so the choice survives sign-up. The helper-friendly "mentor" option goes to `/mentors`.
- Analytics: `fetch('/api/analytics/track', ...)` fire-and-forget with `{event:'journey_selector_choice', props:{path: cta}}` (`:57-69`); validated server-side against an allow-list (`api/analytics/track/route.ts`, test `route.test.ts`).
- Announcement: `LiveRegion` is mounted inside the keyed `motion.div` that appears with the answer (`:131`), so the region and its text arrive together; many screen readers do not announce initial content of a new live region.
- Defect: the decorative bar uses `animate-[fill-down_0.6s_ease-out_forwards]` (`:127`) but no `@keyframes fill-down` exists in `src` (the only keyframes are `rise-fade`, `globals.css:62-71`). The element starts `scale-y-0` and the animation is a no-op, so the accent bar never appears.
- `hover:to-red-900` on the CTA (`:141`) is a raw palette class that the lint misses because the same line contains `var(--...)`.

`TheJourney` (`the-journey.tsx`, client): a six-stage tab-like selector built from `STAGE_OPTIONS.slice(0, 6)` (`:48`). Programs for a stage are filtered client-side from the full list passed in: `program.stage?.includes(stage.value)` (`:59-63`). Stage copy and images are in code (`:18-43`); the file comment records that unapproved promises (free credits, co-founder matching) were removed (KN-18). States: programs present, none ("Programs for this stage are being built."), or unavailable (CMS error, "Programs could not be loaded right now.", `:45-46,198-203`). Prev/next buttons and the tab buttons have no `aria-pressed`/`aria-current` or `tablist` semantics (`:90-105,115-124`), so the selected stage is conveyed by colour and an unlabelled "Stage 01 / 06" string only. The "Next" wrap-around label reads "Back to Start (Exploring) ↺" (`:219`).

Edge: `STAGE_CONTENT` is keyed by stage; a stage value not in the map falls back to `exploring` content (`:62`), which would show the wrong image and text for a new stage added to `STAGE_OPTIONS`.

## 3. Ecosystem section ("Who is on the platform.")

Design rule (`ecosystem-section.tsx:5-12`): show only what the platform actually holds; a zero count never renders; with nothing to show the section is absent.

Data path:
1. `getEcosystemCounts()` runs ten `payload.count` calls in parallel with `overrideAccess: false` (`ecosystem-counts.ts`, `getEcosystemCounts`): programs, mentors, startups, upcoming events (`startsAt >= now`), infrastructure and partners by type (industry, investor, academic, government, community).
2. Each count is individually `try/catch`ed and becomes `null` on failure (`:4-13`); a failure to get the client returns `UNKNOWN_COUNTS` (`:17-23`). The page therefore never fails because of counters, and logs per counter.
3. `buildEcosystemGroups(counts)` maps counts into three groups (`ecosystem-groups.ts`, the `GROUPS` constant): Academia (programs, mentors, spaces, academic partners), Industry (industry partners, investors, startups), Government and community (government partners, community partners, upcoming events). `visibleCount` drops zero, null, negative and non-integer values; empty groups are dropped (`buildEcosystemGroups`, end of `ecosystem-groups.ts`). Tests: `ecosystem-groups.test.ts`.
4. `EcosystemSection` renders one `<section aria-labelledby>` per group with a `<ul>` of links to the relevant list page or `/ecosystem#infrastructure` / `#partners` (`ecosystem-section.tsx:27-51`). Singular/plural labels are chosen per value.

Constraints and failure modes:
- Counts are of published rows only because the read is `overrideAccess: false` and Payload drafts are hidden; this is the property that stops the section overstating.
- Placing "mentors" and "programs" under "Academia" is an editorial categorisation, not a data property; the section header states "Counted from the published records".
- Every homepage request issues ten `COUNT` queries plus the program list and global read; there is no cache (E5.02).
- A single partner of an unlisted type is counted nowhere.
- The destination anchors `#infrastructure` and `#partners` exist on `/ecosystem` (`ecosystem/page.tsx:181,279`).

## 4. The `/ecosystem` page

Mostly static: six "dimensions" and an infrastructure specification list are literals attributed to the official brochure (`ecosystem/page.tsx:12-60`, comment: "Nothing here is added to what the brochure states"). Spaces and partners come from `listInfrastructure()` and `listPartners()` (`:106`); empty partners shows an honest "Partners will be listed here" panel (inside the `id="partners"` section, from `:279`). Partner `websiteUrl` renders as `target="_blank" rel="noopener noreferrer"`, again with no scheme validation in the schema.

`TripleHelix` (`components/content/triple-helix.tsx`, 396 lines, client): an SVG triangle with three nodes. Detail popovers appear only on `onMouseEnter`/`onMouseLeave` of the node wrapper (`:222-223,278-279,334-335`); there is no focus, click or keyboard handler and the popover is `pointer-events-none`. The role text ("Policy and infrastructure.", etc., `:12-31`) is therefore unavailable to keyboard, touch and screen reader users. Headings inside are `h4` and `h5` after the page's `h2`, skipping `h3`. Node backgrounds use literal `#f4e4e2` and `rgba(...)` on lines that also contain `var(--...)`, so they pass the lint.
