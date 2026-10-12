# Design tokens: what "pipeline" means in KNEST (module 4)

Status: decision recorded by the CONTENT agent, 2026-10-12. Needs the owner's acknowledgement only because the contract wording says "token pipeline" (see CONTRACT-TRACEABILITY.md row 4).

## Decision

The shipped application has **one token source: `src/styles/tokens.css`** (a Tailwind v4 `@theme` block). Every colour, type size, spacing step, radius, shadow, focus-ring width and decorative duration used by the product is a CSS custom property defined there, and components refer to them through `var(--...)` or the Tailwind utilities generated from them.

The DTCG JSON files in `tokens/` and `scripts/build_tokens.mjs` belong to the **design kit** that sits beside the product. They are reference material and tooling for design work; nothing in the build reads them, and the product does not depend on them. They are not a second source of truth and must not be edited to change the product's look.

"Pipeline" is therefore met in the sense the contract can be held to: a single source, enforced by a gate, that every screen renders from. It is not a generated-artefact build chain, because with one web target and one theme a generator would add a second place where values can drift and nothing else.

### Why not wire `tokens/*.json` into the build

- One platform (web), one theme (light, with dark deferred), one brand. The cases that justify Style Dictionary (iOS, Android, multi-brand) do not exist here.
- The kit JSON and `tokens.css` already disagree on values (the identity was re-done in CSS after the kit was generated). Generating from the JSON would silently change the live look.
- Revisit if a native client, a second brand or a dark theme is commissioned. The migration path is: adopt `tokens/*.json` as input, generate `tokens.css` from it, and make the generated file read-only.

## The gate

`python3 scripts/lint_hardcodes.py src` runs in CI (job "static") and must exit 0. It fails on:

- a hex colour literal;
- a pixel length other than `0px` and `1px`;
- a duration literal (`ms`/`s`);
- a raw Tailwind palette colour (`bg-green-50`, `text-red-600`, ...);
- a literal `font-family`.

Not flagged, by design: token definitions (`--name: value`), anything inside `var(--...)`, text inside block comments, SVG path data, and media conditions (`@media`, `matchMedia(`, `(min-width: ...)` in `sizes`) because CSS cannot use `var()` there.

A justified exception is a `ds-allow-hardcode` comment (single line) or a `ds-allow-hardcode:start` / `:end` pair. There is currently exactly one: `src/app/opengraph-image.tsx`, whose renderer cannot read CSS variables. It repeats four token values and says so.

## Conventions the sweep established

- `--spacing` is `0.5rem`, so a numeric Tailwind size is 8px per unit: `max-w-90` is 720px, `h-50` is 400px, `lg:pt-2.75` is 22px. Use these instead of `[720px]`.
- Decorative motion durations are tokens: `--motion-instant`, `--motion-fast`, `--motion-rise`, `--motion-sheen`, `--motion-settle`. Use them as `duration-(--motion-sheen)` or `var(--motion-fast)`.
- The focus ring is `--focus-width` and `--focus-offset`.
- The staff console (`src/payload/custom-admin.css`, `BeforeDashboard.tsx`) now reads the same tokens through `@import '../styles/tokens.css'`, so its look follows the public site.
- New tokens added in this pass: `--color-paper-raised`, `--color-positive-wash`, `--focus-width`, `--focus-offset`, `--motion-*`.

## Visual change to review

The staff console previously used its own neutrals (`#f6f4ee`, `#76232f`, `#1a1a1a`). It now uses the site tokens (`--color-paper`, `--color-signal`, `--color-ink`). The differences are small but visible; a staff member should glance at `/admin` once.
