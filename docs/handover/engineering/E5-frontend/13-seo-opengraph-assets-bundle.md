# E5.13 Open Graph image, sitemap, robots, static assets and the bundle budget

## 1. Metadata model

- Root metadata in `layout.tsx:9-22` supplies the title template, `metadataBase`, Open Graph site name, locale `en_IN`, Twitter `summary_large_image` and icons. Pages add `title` and `description` through `export const metadata` (static pages) or `generateMetadata` (detail pages), using the CMS `seo.title`/`seo.description` with fallback to title and tagline (`programs/[slug]/page.tsx:20-23`, same pattern for events, startups, resources, articles). Mentors use name and bio (`mentors/[slug]/page.tsx:17-20`); a mentor bio is the entire meta description, uncapped in length.
- A missing record returns `{}` from `generateMetadata`, so the 404 page keeps the root title.
- There is no per-page `canonical`, no `openGraph.title/description` override and no JSON-LD in any file read. Next derives Open Graph tags from `title`/`description` only if set; whether it does so automatically in 16.4 was not verified (no `node_modules`).
- No `alternates`, no `hreflang`; single-language site.

## 2. Open Graph image

`src/app/opengraph-image.tsx` uses `ImageResponse` from `next/og` and exports `alt`, `size` (1200x630) and `contentType` `image/png` (`:8-10`). The file convention makes Next serve `/opengraph-image` and add the `og:image` tags for every route without its own image (root comment `layout.tsx:14`).

- Content: parchment background, 24px oxblood left bar, "KIIT UNIVERSITY", a 168px "KNEST", and two sentences that repeat the site description (`:38-49`). No dynamic data.
- Static or dynamic: the comment says it is generated at build time because nothing reads the request (`:3-7`). Standard Next behaviour for a no-argument image route; the actual output was not available to confirm.
- Colours are four literals in `ds-allow-hardcode` markers because satori cannot read CSS variables (`:12-20`). Fonts: no custom font is loaded into `ImageResponse`, so the renderer's default font is used and the card will not match the site's Fraunces (not observed).
- Constraint: there are no per-page images, so every program, event or startup shared on social media shows the same card.
- `twitter.card: summary_large_image` expects an image; Next adds a twitter image from the same file convention only if `twitter-image` exists or it reuses `opengraph-image` (framework behaviour, not verified).

## 3. `robots.ts`

`robots.ts:12-20`, `force-dynamic`:
- If `SITE_INDEXING !== 'on'`: `User-agent: * / Disallow: /`.
- Otherwise: allow `/`, disallow `/api/`, `/admin`, `/dashboard`, `/apply`, `/onboarding`, `/login`, `/signup`, `/verify`, `/reset`, and advertise `absoluteUrl('/sitemap.xml')`.

Defence in depth: `src/proxy.ts:15` sets `x-robots-tag: noindex, nofollow` on every response when the flag is off, because robots.txt does not stop a URL being listed from external links. The integration test asserts `x-robots-tag` on privacy and terms (`31-public-pages.test.ts`). `/lab-device` carries page-level `robots: {index:false, follow:false}` (`lab-device/page.tsx:16`). `privacy` and `terms` set `robots.index:false` in metadata until KIIT approves text.

Failure modes: the exact-string rule means `SITE_INDEXING=ON` or `true` leaves the site blocked, which is the safe direction. If the flag is turned on but `SITE_URL` is unset, the sitemap URL is `http://localhost:3000/sitemap.xml` (E5.01). With the flag on, the `noindex` header is absent, so nothing else prevents indexing of pages not listed in the disallow list (for example `/search?q=...`, `/lab-device`, `/events/<slug>/calendar.ics`).

## 4. `sitemap.ts`

`sitemap.ts:26-50`, `force-dynamic`. Output: twelve static paths (`/`, `/about`, `/programs`, `/events`, `/mentors`, `/startups`, `/resources`, `/blog`, `/ecosystem`, `/invest`, `/get-involved`, `/contact`), then one entry per published program, event, mentor, startup, hosted resource (only those with a `body`), and article (up to 500), with `lastModified` from `updatedAt` when present.

Properties:
- Each collection is loaded inside `safely()` so a failing collection logs and contributes nothing, never turning the sitemap into a 500 (`:16-24`). The cost is that a persistent failure silently produces a sitemap missing a whole collection; there is no alert.
- Past events are included (`listEvents()` without the upcoming filter).
- `/privacy` and `/terms` are intentionally omitted (`:13`).
- Public lists are capped at 100 per collection by the content readers (`programs.ts:36`); a collection over 100 entries is silently truncated in the sitemap too, except articles (500).
- Search engines get the sitemap only when indexing is on, because robots lists it only then. The route itself answers regardless.
- Each request issues six content queries; there is no cache. A crawler fetching often loads the database accordingly.
- `changefreq` and `priority` are not set.

## 5. Static assets (`public/`)

| File | Use |
|---|---|
| `images/knest_icon.png` | favicon, shortcut and apple icon (`layout.tsx:17-21`); also admin icon |
| `images/knest_logo.png`, `@2x`, `_white`, `_white@2x`, `knest_logo.jpg` | `Logo`, footer, admin; the `@2x` variants are not referenced by `Logo` (it picks only the 1x file with `width=325`) |
| `images/hero_bg_modern.jpg` | hero |
| `images/stage_*.jpg`, `hero_*.jpg`, `triple_helix_triangle.jpg` | journey, page headers; several (for example `stage_brainstorming`, `stage_coding`, `stage_mentoring`, `stage_validation`, `hero_neon`, `hero_team`) are not referenced by the files read (`STAGE_CONTENT` uses six others) |
| `auth-cover.jpg` | auth layout cover (1200x1600 declared) |
| `logo.png`, `logo.jpg` | no reference found in `src` |
| `icons/*`, `manifest.webmanifest`, `sw.js`, `offline.html` | lab attendance PWA (scope `/lab-device`) |
| missing: `noise.svg` | referenced by `next-step-card.tsx:29`; absent |

Unreferenced images still ship in the container (`postbuild` copies `public/`, `package.json:10`). `next/image` is used for the logo, page header, hero, journey and auth cover; `Avatar` uses raw `<img>` for arbitrary CMS media. `next.config.ts` has no `images` block, so only same-origin and static imports are optimised; CMS media at `/api/media/file/...` is same-origin.

Caching of static files is Next's default for `/_next/static` and `public/` (not set in `next.config.ts`); only `/sw.js` has `Cache-Control: no-cache` (`next.config.ts:74`). The service worker caches only `/lab-device` shell assets (E5.03 notes the PWA is out of scope here).

## 6. Bundle budget

`scripts/check_bundle_budget.mjs` (61 lines) with limits in `scripts/bundle-budget.json`:

| Metric | Limit (bytes, gzip level 9) | Measured when set (2026-10-12, `agent/content`) |
|---|---|---|
| `jsGzipBytes` | 1,350,000 | 1,162,749 |
| `cssGzipBytes` | 120,000 | 103,478 |
| `largestJsChunkGzipBytes` | 420,000 | 365,155 |

Method: walks `.next/static`, gzips each `.js` and `.css` file, sums them, and exits 1 over a limit; `--print` prints and exits 0 for re-basing; exit 2 if `.next/static` is missing (`:33-36,57-61`). It runs in CI after `pnpm build` in the integration job (`ci.yml:106-109`).

What it does and does not measure:
- It is a pure function of the build output: no browser, network or timing, so it cannot flake. It does not claim to predict Lighthouse.
- It sums every chunk in `.next/static`, including chunks for routes a visitor never loads (Payload admin, lab device). 1.16 MB gzipped JS is a build total, not the per-page payload; the real home-page JS is a subset not measured here.
- Limits sit about 15% above the baseline, so growth below that passes unnoticed, and the limit was set from a measurement on a feature branch, not on `codex/production-v1`.
- Server code, fonts and images are not counted.
- The "largest chunk" 365 KB gzipped is large for a client chunk; its content was not identified (likely Payload admin or Lexical). It has been accepted by the baseline, not investigated.
- Edits require "a reason in the commit message" (`:59`), enforced by convention only.

Biggest known client weight drivers from the code: framer-motion imported by eight client modules (including the home page journey components, `the-journey.tsx` and `journey-selector.tsx`); the Turnstile script is third-party and not in the budget; `RichText` pulls Payload's Lexical React renderer into pages that show CMS rich text (server component, so not client JS).
