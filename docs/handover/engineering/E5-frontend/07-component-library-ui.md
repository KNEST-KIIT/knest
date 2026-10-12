# E5.07 Component library: `src/components/ui`

Barrel: `ui/index.ts`. Exports Avatar, Button, ButtonLink, Card, CardTitle, LinkCard, EmptyState, Field, Input, Select, Textarea, FilterBar, Heading, LiveRegion, MultiSelect, SingleSelect, PasswordInput, Prose, Section, SectionHeading, Skeleton, SkeletonCard, SkeletonGrid, StatusBadge, StatusDot, Tag, Table, Timeline, Reveal, RevealHeading, Logo (`index.ts:1-23`). Not in the barrel: `Pagination` (imported by path, `admin/applications/page.tsx:5`) and `Button` is imported by path in many files (`@/components/ui/button`).

Common facts: components are plain function components (React 19 `ref` as prop, no `forwardRef`, no `cva`; the project rules mention both but the code uses `cn()` string concatenation, `lib/cn.ts:2-4`, which does not de-duplicate conflicting Tailwind classes, so a caller `className` can lose to a base class depending on CSS order). There are no component unit tests: vitest includes only `src/**/*.test.ts` (`vitest.config.mts:7`), so behaviour is covered only indirectly by the browser suite (E5.11). Styling references tokens through `var(--...)` arbitrary values.

## Button, ButtonLink (`button.tsx`)

- Props: `variant` `'primary' | 'secondary' | 'ghost' | 'danger'` (default primary), `size` `'sm' | 'md' | 'lg'` (default md), `fullWidth`, plus all native button attributes (`ButtonLink`: all `next/link` props). Sizes are `h-9`, `h-11`, `h-12` (`:33-35`). Tailwind v4 computes numeric utilities as `calc(var(--spacing) * n)` and the project sets `--spacing: 0.5rem` (`tokens.css:75`), so these are 4.5, 5.5 and 6rem (72, 88, 96 px at a 16px root), twice the Tailwind default. This was derived from the code, not measured in a browser; E5.09 explains the scale and why it is easy to misread.
- States: hover lifts 2px and brightens shadow; focus uses `focus-visible:ring-2` in `--color-signal` with `outline-none` (`:10`); active scales to 0.97; disabled `opacity-50` and `cursor-not-allowed`. There is no loading variant: callers swap the label and disable (composition rule 8 in the project rules is not met; for example `login-form.tsx:145` special-cases `disabled:opacity-100`).
- Accessibility: `Button` does not default `type`, so inside a `<form>` it submits; callers set `type="button"` where needed. `ButtonLink` stays a link.
- Defects: `danger` uses `to-red-800` and literal `rgba(185,28,28,...)` (`:29`); `primary` and `secondary` hard-code `rgba(122,31,43,...)` and `rgba(13,19,33,...)` shadows (`:17-18,24`), duplicates of token values that the lint does not detect (it has no `rgb()` pattern, E5.09). Transition is `duration-500` and the sheen 1.5 s (`:9,21`), beyond the 100-300 ms guidance for UI transitions in the project rules; reduced motion neutralises both globally.

## Card, LinkCard, CardTitle (`card.tsx`)

- `Card({className, children})`: bordered white block with hover border and shadow, `rounded-none`.
- `LinkCard({href, label, className, children})`: whole-surface link done correctly: the `Link` is an absolutely positioned sibling with an `sr-only` span carrying `label` (`:58-63`), so headings and tags stay outside the link text. Focus is shown with `focus-within:outline` on the card (`:51`) and the link itself removes its outline (`focus:outline-none`, `:60`). Constraint: because the link is `absolute inset-0` and later in the DOM, any interactive child (button, second link) in `children` sits under it and is unclickable; `student-view.tsx` nests a `LinkCard` inside another bordered block but not interactive elements inside one. `[overflow-wrap:anywhere]` and `min-w-0` protect narrow widths (`:48`).
- `CardTitle`: `Heading as="h3"`.

## Heading (`heading.tsx`)

`as` `'h1'..'h4'` (default h2), `size` `'hero' | 'display' | 'title' | 'heading'` (default title), `uppercase` (default false), `className`, `style`. Sizes map to `--text-hero/display/title/heading` with line-height and weight (`:16-21`). The component does not enforce hierarchy; skipped levels exist (E5.11). Callers frequently override size through `className` (for example `text-3xl md:text-5xl`, `the-journey.tsx:76`), defeating the token scale because both are arbitrary classes and order decides.

## EmptyState (`empty-state.tsx`)

Props: `heading`, `body`, optional `action`, `size` `'default' | 'compact'`, `className`, `headingLevel` `'h2' | 'h3'` (default h2). Dashed bordered panel with generous vertical padding so an empty section reads as deliberate (`:35`). Heading is the display heading, body capped at 46ch. Has no `role`; announcements are done by sibling `LiveRegion`s on list pages.

## Field, Input, Textarea, Select (`field.tsx`, client)

- `Field({label, hint, error, optional, children})` is a render-prop wrapper: it generates an id with `useId`, renders the `<label htmlFor>`, calls `children({id, 'aria-describedby', 'aria-invalid'})`, then a hint (hidden while an error is shown) and an error paragraph (`:13-60`). `optional` marks the exception with "(optional)"; required fields are unmarked (`:39-43`).
- `Input`, `Textarea`, `Select` apply one shared class string (`:62-69`): white 80% background with blur, 1px border at `--color-line` 70%, `rounded-lg`, focus changes border to signal and adds a 2px ring at 15% opacity while removing the outline, `aria-[invalid=true]` border in critical, disabled paper-soft. `Input` is `h-10` (5rem at the project spacing, `:76`), `Textarea` `min-h-28`, `Select` wraps a native select with `appearance-none` and a decorative chevron (`:86-105`).
- States: default, hover, focus, invalid, disabled. No loading.
- Defects: `error` is never passed by any caller (searched `<Field ... error`), so invalid wiring is dead; the border `--color-line` at 70% over white is far below 3:1 for a control boundary (the project's own rule reserves `--color-line` for decoration and `--color-line-strong` for controls); `Select` forwards `className` to the wrapper, not the select, and `ref` is not forwarded; `blur` on every control costs paint on low-end devices.

## FilterBar (`filter-bar.tsx`, client)

Props: `basePath`, `filters: readonly {key, label, options}[]`. URL-state filters with "Any" option and "Clear all" (E5.05 section 2). Wrapped by each page in `<Suspense>`. A select change navigates immediately; there is no apply button.

## LiveRegion (`live-region.tsx`, client)

`{message}` renders `<span role="status" aria-live="polite" class="sr-only">`. It announces only if the element already exists and its text changes; mounting it with its text does not reliably announce. Used for result counts (list pages), saved state (application form), notification counts, and (incorrectly mounted) the journey selector.

## MultiSelect, SingleSelect (`option-list.tsx`, client)

Props: `options: {value,label}[]`, `value` (string|null or string[]), `onChange`. Each option is a framer-motion `button` with `role="radio"`/`"checkbox"` and `aria-checked` (`:24-27`); `SingleSelect` wraps them in `role="radiogroup"` with no name, `MultiSelect` has no group role (`:65,87`). States: selected (wash background, signal border and dot), hover scale 1.02, tap 0.98. Each card is its own tab stop and there is no arrow-key handling, so it departs from the ARIA radio-group pattern. Neither accepts a `label` prop, so the group has no accessible name (accessibility review findings 7 and 14). Used by onboarding, application questions and `NeedSelect`.

## PasswordInput (`password-input.tsx`, client)

Props: native input props plus required `id`. Local `visible` state toggles `type`. The toggle is a `<button type="button">` whose accessible name is `Show password`/`Hide password` via `sr-only` text with an `aria-hidden` visible "Show"/"Hide" (`:41-49`); it has no `aria-pressed`. Supports paste and `autoComplete` (password managers). Re-declares the input class string instead of reusing `Input` (`:29-37`), so the two can drift.

## Section, SectionHeading, Prose (`section.tsx`)

`Section({className, children, inverted, id})` renders `<section>` with `px-6 py-10 md:px-10 md:py-16` and an inner `max-w-160` container (`max-w-160` is 160 units, 1280px at 0.5rem per unit). The doc comment says "128px desktop, 72px mobile" but the classes are `py-10 md:py-16`, which at the project spacing are 5rem and 8rem of padding per side (`:4,20`); the figures in the comment do not match any derivation from the code and look stale. `SectionHeading` is deprecated, an alias for `Heading size="display"`. `Prose` caps the measure at 68ch.

## Skeleton, SkeletonCard, SkeletonGrid (`skeleton.tsx`)

`Skeleton({className})` is a pulsing paper-soft block; `SkeletonCard` a card-shaped group; `SkeletonGrid({count = 6})` a 3-column grid. Purely visual: no `aria-busy`, no `role`. The pulse is `animate-pulse`, which the global reduced-motion rule shortens (`globals.css:41-50`).

## StatusBadge, Tag, StatusDot (`status-badge.tsx`, `tag.tsx`)

- `Tag({tone, children, className})`: tones `neutral | signal | positive | caution | critical | archive`; 12px uppercase semibold. Tints use `color-mix(... 12%, white)` for positive, caution, critical (`tag.tsx:9-11`).
- `StatusDot({tone, label})`: coloured dot (`aria-hidden`) plus a text label, so status is never colour-only (`:42-59`).
- `StatusBadge({status, config, variant})`: lookup renderer; `variant="pill"` renders a `Tag`, default `dot` renders `StatusDot` plus optional sub-line (`status-badge.tsx:14-35`). An unknown status key throws at `info.label` (no guard): `ApplicationStatusBadge` guards by coercing to `draft` (`applications/status-badge.tsx:30`), `ProgramStatusBadge` and `AvailabilityBadge` do not.
- Contrast note from the review: positive tag text `#15803d` on its 12% tint is about 4.27:1 at 12px (finding 27); not re-measured here.

## Table (`table.tsx`)

Generic `Table<T>({rows, columns, renderCard, rowKey, className})`. Desktop (`sm` and up) renders a real `<table>` in a horizontally scrollable bordered wrapper; below `sm` it renders `renderCard(row)` per row in a column (`:35-66`). Both trees are in the DOM and hidden with CSS, so a screen reader at any width sees only the visible one but the server HTML contains both. Gaps: header cells have no `scope`, no caption prop, the scroll wrapper is not focusable or labelled, columns are keyed by `header` text (duplicate headers collide, `:40,50`), and no overflow cue. `components/labs/report-table.tsx` is the better-built variant (scope, caption, focusable labelled region).

## Timeline (`timeline.tsx`)

`entries: {label, date?, detail?}[]` as an `<ol>` with a signal left border; renders nothing for an empty list.

## Avatar (`avatar.tsx`)

`name`, `src?`, `size` `'sm' | 'md' | 'lg'`, `className`. With `src` renders a raw `<img alt="">` (eslint-disabled `no-img-element`, because sources are arbitrary CMS URLs, `:37`); without it an `aria-hidden` initials circle (first plus last initial, `:17-22,46-56`). Always decorative: the person's name must appear next to it, which every call site does. No `width/height`, so layout shift is bounded only by the `size-*` class.

## Logo (`logo.tsx`)

`size` `'xs'..'xl'`, `inverted`, `className`. `next/image` of `/images/knest_logo.png` or `_white.png`, `alt="KNEST — KIIT University"`, `priority`, and a hover scale (`:19-29`). Because `alt` is set, the auth layout's link `aria-label="KNEST Home"` plus nested image alt yields a doubled name for some readers. `priority` is used here while `hero.tsx:50` uses `preload`; which is current for Next 16.4 could not be checked (no `node_modules`).

## Reveal, RevealHeading (`reveal.tsx`, `reveal-heading.tsx`, client)

Scroll-triggered entrance wrappers using framer-motion `useInView({once:true, margin:'-10% 0px'})`; `Reveal` fades and rises 30px over 0.8 s; `RevealHeading` splits `children` on `\n` and slides each line from `y:'100%'` inside an `overflow-hidden` line box, with `as` default h1. Both files start with a BOM (`reveal.tsx:1`, `reveal-heading.tsx:1`). See E5.10 for the no-JS and visibility failure modes.

## Pagination (`pagination.tsx`, not in barrel)

`{info: PageInfo, hrefFor(page)}`. Renders nothing for one page, or "N in total"; otherwise a `<nav aria-label="Pages">` with "Showing a-b of n", real links with `rel="prev"/"next"`, and `aria-disabled` spans at the ends (`:8-41`). Uses `--color-line-strong` (undefined). Pure server component; `hrefFor` preserves filters.
