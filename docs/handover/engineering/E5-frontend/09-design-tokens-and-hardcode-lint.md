# E5.09 Design tokens, the pipeline decision and the hardcode lint

Sources: `src/styles/tokens.css` (100 lines), `src/styles/globals.css` (112), `src/styles/fonts.ts` (36), `docs/delivery/TOKEN-PIPELINE.md`, `scripts/lint_hardcodes.py` (156), `scripts/build_tokens.mjs` (158), `.github/workflows/ci.yml:51-54`.

## 1. The single source: `tokens.css`

`tokens.css` is one Tailwind v4 `@theme` block imported by `globals.css:2` (`@import 'tailwindcss'; @import './tokens.css';`). PostCSS has only `@tailwindcss/postcss` (`postcss.config.mjs`). Theme variables become CSS custom properties and Tailwind utilities (`bg-ink` style names are not used; the code consistently writes `bg-[var(--color-ink)]`).

| Group | Tokens (`tokens.css`) |
|---|---|
| Ground | `--color-ink #0d1321`, `--color-ink-soft #2b3350`, `--color-ink-muted #43415a`, `--color-paper #f8f4e9`, `--color-paper-soft #ede4c9`, `--color-paper-raised #ffffff`, `--color-line #ddd0a8`, `--color-paper-invert`, `--color-line-invert` (`:21-30`) |
| Accent | `--color-signal #7a1f2b`, `-deep #6e1c27`, `-wash #f4e4e2`, `-on-ink #f2b6bd` (`:35-39`) |
| Secondary | `--color-archive #7d5f18`, `--color-archive-soft #ece3c4` (`:44-45`) |
| Status | `--color-positive #15803d`, `--color-caution #92400e`, `--color-critical #b91c1c`, `--color-positive-wash` (`:48-51`) |
| Type | `--font-display`, `--font-text`, `--font-accent`, `--font-mono`; `--text-hero/display/title/heading/body` as `clamp()` values; `--text-small 0.875rem`, `--text-micro 0.75rem` (`:61-72`) |
| Space | `--spacing: 0.5rem` (`:75`) |
| Focus | `--focus-width 2px`, `--focus-offset 2px` (`:78-79`) |
| Motion | `--motion-instant 0.01ms`, `-fast 0.2s`, `-rise 0.7s`, `-sheen 1.5s`, `-settle 2s` (`:84-88`) |
| Radius | `--radius-sm 0.25rem`, `-md 0.375rem`, `-lg 0.625rem` (`:92-94`) |
| Elevation | `--shadow-raised`, `--shadow-floating` (`:98-99`) |

Fonts: `Fraunces` (display; weights 400-700 and italic) and `Instrument_Sans` (text; 400-600) via `next/font/google`, exposed as `--font-display-family` and `--font-text-family` on `<html>` (`fonts.ts:21-36`, `layout.tsx:26`). `display: 'swap'` and explicit fallbacks. Fonts are fetched at build time and self-hosted, so the CSP `font-src 'self' data:` suffices. A build host without internet access to Google Fonts fails the build; this is a `next/font/google` property, not verified here.

There is no dark theme: `tokens.css` and `globals.css` define no `[data-theme]` or `prefers-color-scheme` rules. `suppressHydrationWarning` and the kit's dark-mode guidance are therefore unused by the product.

## 2. The pipeline decision

`docs/delivery/TOKEN-PIPELINE.md` records the decision: the product has one source, `tokens.css`; the DTCG JSON in `tokens/` and `scripts/build_tokens.mjs` belong to the design kit, are not read by the build, and "must not be edited to change the product's look". "Pipeline" in the contract (module 4) is satisfied as "a single source, enforced by a gate". Reasons given: one platform, one theme, one brand; kit JSON and CSS already disagree (the identity was redone in CSS); a generator would add a second place for values to drift. Migration path if a second brand, native client or dark theme is commissioned: make `tokens/*.json` the input, generate `tokens.css`, make the output read-only.

Evidence of the disagreement: `tokens/colors.json` primitives are generic grays and blues (`"500": "#6b7280"`, `"#3b82f6"`), unrelated to the oxblood/parchment palette in `tokens.css`. `scripts/build_tokens.mjs` generates `--color-*` names plus `--space-*`, `--text-*`, `--radius-*` under different naming (`:105-109`), so its output could not replace `tokens.css` without renaming every `var()`.

`build_tokens.mjs:24` derives `ROOT` from `new URL(import.meta.url).pathname`, which yields a `/C:/...` path on Windows and fails; kit-only, not part of the product build.

## 3. Conventions the codebase relies on

1. Numeric Tailwind sizes are `n x 0.5rem`, double the default. `max-w-90` is 720px, `h-9` is 72px. A reader who assumes the default scale will misjudge widths and tap targets by a factor of two (TOKEN-PIPELINE "Conventions"; accessibility review line 321). Arbitrary `[...rem]` values avoid the ambiguity.
2. Colours are referenced `bg-[var(--color-x)]`, with opacity as `/70`. Tailwind's `color-mix` handling of `var()` colours with an opacity suffix is framework behaviour, not verified here.
3. Type sizes are `text-[length:var(--text-small)]`; the `length:` hint is required so Tailwind does not treat the value as a colour.
4. Decorative durations use `duration-(--motion-sheen)` and `var(--motion-fast)`.
5. The focus ring is `--focus-width`/`--focus-offset` in the global `:focus-visible` rule (`globals.css:34-38`).

## 4. Variables used but not defined

A scan of every `var(--name)` in `src` against the definitions found two undefined tokens:

| Token | Uses | Effect |
|---|---|---|
| `--color-line-strong` | 37 occurrences in 23 files (member lab pages, staff console, contact form `contact-form.tsx:72`, `pagination.tsx:14`, `site-header.tsx:218`, lab device) | An undefined custom property makes the declaration invalid at computed-value time. A `border` shorthand with an invalid colour var falls back to its initial colour, `currentColor`, which is dark text colour here. It looks right by accident and will silently change if someone defines the token lighter. The project rules call this token the required border for controls. |
| `--radius-xl` | `next-step-card.tsx:26`, `onboarding-flow.tsx:357`, `the-ecosystem.tsx:8` | `border-radius` becomes invalid and is dropped, so those panels have square corners rather than the intended large radius. |

Also: `next-step-card.tsx:29` uses `bg-[url('/noise.svg')]`, a file that does not exist in `public/` (the directory lists `auth-cover.jpg`, `icons/`, `images/`, `logo.*`, `manifest.webmanifest`, `offline.html`, `sw.js`). The browser requests it and gets a 404 on every dashboard view. `globals.css:19-28` draws its own noise inline instead.

## 5. The hardcode lint

Command: `python3 scripts/lint_hardcodes.py src`, run in CI job "static" (`ci.yml:51-54`). It requires Python 3; Python is not installed on this Windows host, so it was not run for this volume.

What it does (`lint_hardcodes.py`): walks files with extensions `.css .scss .tsx .jsx .ts .js .vue .svelte .swift .kt .dart .html` (`:22-23,42-50`), and for each line reports
- `hex`: `#` followed by 3-8 hex digits (`:25`);
- `px`: any pixel length other than `0px` and `1px` (`:26,39`);
- `time`: any `ms` or `s` number (`:27`);
- `tailwind-palette`: `bg|text|border|ring|fill|stroke|from|via|to|...-<palette>-<50..950>` (`:30-32`);
- `font-family`: a literal `font-family:` without `var(` (`:34`).
It skips: the line when it contains `ds-allow-hardcode` or matches `TOKEN_CTX` (`var(--`, `theme(`, `tokens.`, `{token}` or `--name:`) (`:36,60-61`); SVG `d="..."` path data (`:54,62`); lines with `matchMedia(` or `(min|max)-width:` (`:56,63-64`); comment lines (`:66-67`); everything inside a multi-line `/* */` (`:127-133`); and regions between `ds-allow-hardcode:start` and `:end` (`:134-141`). Exit 1 on any finding; exit 1 on a missing path or an empty file set so scanning nothing cannot pass (`:107-116`).

### Known blind spots (all verified against code in this checkout)

1. **The per-line exemption is too wide.** Any line containing `var(--` is skipped entirely, so a literal hex or raw palette class on a line that also uses a token is invisible. Concrete examples that pass CI today:
   - `login-form.tsx:145`, `signup-form.tsx:146`, `reset-form.tsx:109`: `to-[#5a141e] hover:from-[#8f2433]`;
   - `button.tsx:29`: `to-red-800`; `journey-selector.tsx:141`: `hover:to-red-900`; `onboarding/step-shell.tsx:53`: `to-red-500`; `login-form.tsx:127`, `signup-form.tsx:128`: `bg-red-50 border-red-200`;
   - `triple-helix.tsx`: `bg-[#f4e4e2]` and `rgba(122,31,43,0.15)` shadows.
2. **`rgb()`/`rgba()`/`hsl()` are not patterns at all.** `button.tsx:17-18,24,29`, `card.tsx:17,50,53`, `site-header.tsx:85`, `page.tsx:90` carry token colours as `rgba(...)` literals that cannot follow a token change.
3. **Custom property definitions are exempt (`--name: value`).** That is intended for `tokens.css`, but it also exempts `src/payload/custom-admin.css:10-21` (`--theme-elevation-0: #f6f4ee`, `--theme-success-400: #76232f`, `--theme-text: #1a1a1a`), which contradicts the TOKEN-PIPELINE note that the console "now reads the same tokens"; only the selectors below line 24 do.
4. **`em`/`rem` values and unitless numbers are not checked**, which is deliberate (rem is the token unit), but `style={{ width: '1.375rem' }}` in `payload/components/Branding.tsx:9` and `BeforeDashboard.tsx` inline styles are therefore free.
5. **TypeScript object literals** are scanned as lines, so `themeColor: '#0d1321'` in `lab-device/page.tsx:22` needed `// ds-allow-hardcode`, and `lab-device/parts.tsx:20` has `fill="#000"` (QR code SVG, black on white by necessity). That line carries no allow comment; it passes because the `TOKEN_CTX` pattern `\{[\w.\-]+\}` (meant for DTCG references such as `{color.ink}`) also matches the JSX expression `{drawn.path}` on the same line. Any line that holds a simple `{a.b}` expression is therefore exempt, a second way the whole-line exemption hides literals.
6. Only `src` is scanned. `public/sw.js`, `public/manifest.webmanifest` (`background_color`, `theme_color`) and `public/offline.html` hold literals by necessity (they cannot read CSS variables).

### The one sanctioned exception

`src/app/opengraph-image.tsx:12-20` wraps four constants in `ds-allow-hardcode:start/end` because the image renderer cannot read custom properties. They must be kept equal to `--color-ink`, `--color-paper`, `--color-signal`, `--color-line` by hand; there is no test asserting equality.

### Recommendation for maintainers

Tighten the lint rather than trust it: remove the whole-line `var(` exemption (match tokens per match, not per line), add `rgb(`/`rgba(`/`hsl(`, and add a CI check that every `var(--x)` in `src` is defined in `tokens.css` (the accessibility review proposed this; two undefined tokens exist today).

## 6. Related scripts not wired into CI

`scripts/validate_tokens.py`, `validate_contrast.py`, `validate_theme_refs.py`, `verify_*.mjs`, `axe_audit.mjs`, `taste_audit.mjs`, `lint_taste.py`, `slop_tells.mjs` belong to the design kit and operate on kit tokens or static HTML harnesses (for example `axe_audit.mjs` takes `<file.html>` and opens `file://`, `:8,34`). `ci.yml` runs none of them. Contrast of the live palette is therefore asserted only by comments in `tokens.css` and by the axe suite on rendered pages.
