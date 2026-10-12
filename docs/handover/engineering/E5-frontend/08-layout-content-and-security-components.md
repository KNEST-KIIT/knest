# E5.08 Layout, content, error and security components

All under `src/components` except where noted. Line numbers are per file.

## SiteHeader (`layout/site-header.tsx`, client, 235 lines)

Props: `signedIn` (default false), `unreadCount` (default 0). Rendered by the `(public)` and `dashboard` layouts.

- Structure: sticky `top-0 z-50` header of fixed height `h-[4.5rem]` (`:81-89`); logo link with `aria-label="KNEST Home"`; desktop `<nav aria-label="Main">` shown from `lg`; right cluster (log in / "Start building", or Dashboard plus log out); a mobile toggle shown below `lg`.
- Visual states: transparent gradient at the top of the page, bordered translucent with blur once `scrollY > 40` or the drawer is open (`:28-33,82-87`).
- Active link: `pathname.startsWith(item.href)` sets `aria-current="page"` and an underline (`:102-112`). Prefix matching is correct for the current routes; a route such as `/programs-archive` would also match.
- Unread badge: the Dashboard link receives an `aria-label` "Dashboard — N unread notification(s)" and a 9px `aria-hidden` count (`:127-141`). The badge text is below the 12px minimum used elsewhere.
- Mobile drawer (`open` state, `:20,189-232`): the panel is `absolute top-full` with height `100dvh - 4.5rem`, so it is positioned relative to the header, not `fixed` (this removes the `backdrop-filter` containing-block risk raised in the older accessibility review). While open:
  - Escape closes and returns focus to the toggle (`:50-53`);
  - Tab wraps between the toggle and the panel's links/buttons (`:54-66`), a manual trap because the page behind is not made `inert`; screen reader virtual-cursor browsing can still reach it;
  - body scroll is locked via `document.body.style.overflow = 'hidden'` and restored in the effect cleanup (`:68-77`);
  - crossing the `lg` breakpoint closes it (`matchMedia`, `:44-48,70`), which fixes the stuck-scroll case in the older review;
  - the first link receives focus on open (`:72`);
  - route change closes it (`:35-38`, with an eslint waiver for set-state-in-effect).
- Remaining gaps: choosing the link for the current page does not change `pathname`, so the drawer stays open; mobile links have no `aria-current` (`:196-204`); the toggle is both `aria-expanded` and has a name that flips between "Open menu" and "Close menu" (`:164,168`), so it is announced as "Close menu, expanded"; the CSS `lg:hidden` panel is unmounted rather than hidden when closed, so there is no hidden-focus risk. The integration test exercises open, Tab containment, Escape and resize release (`tests/integration/35-accessibility.test.ts:216-238`) and an axe scan of the open menu (`:328-340`).
- Navigation list is a constant `NAV` (`:10-17`): programs, startups, ecosystem, events, resources, about. Mentors, blog, invest, contact and search are reachable only from the footer, home page links or direct URL. There is no visible search entry (a "remove search button" commit is in history).

## SiteFooter (`layout/site-footer.tsx`, server)

Three nav columns (`<nav aria-label="Explore|KNEST|Get involved">` each with an `h2`), brand blurb, copyright with `new Date().getFullYear()`, and Privacy and Terms links (`:36-102`). Because the public layout is dynamic the year is current; a statically exported page would freeze it. Duplicate destinations: "Apply" and "Programs" both go to `/programs`, "Become a mentor" and "Partner with us" and "Contact" all go to `/contact` (`:28-30,22`). The giant watermark text `KIIT KNEST` is a `<span>` inside the footer with 1.6% white; being text it is read by screen readers (`:44-46`) and is not `aria-hidden`. The bottom row is `text-white/45` on ink, which the review measured at 4.51:1.

## SkipLink (`layout/skip-link.tsx`)

A bare anchor to `#main`, `sr-only` until focused, then `fixed left-4 top-4 z-[100]` on an ink background (`:4-9`). It is the first element in every layout that has a `<main id="main">`. The target is a non-focusable `<main>` (no `tabIndex={-1}`), so in browsers that do not move focus to a non-focusable fragment target (reported for Safari) activation scrolls but keyboard focus stays on the link. The integration test checks that the first Tab lands on `#main` and that the element exists, not that focus moved (`35-accessibility.test.ts:200-214`).

## PageHeader (`layout/page-header.tsx`)

Props: `kicker?`, `title`, `description`, `imageSrc?`, `imageAlt = ''`, `badgeText?`, `className?`, `children?`. Renders the page `h1` (display size overridden to `text-3xl lg:text-4xl`, `:42-48`) with a signal left rule; an optional side image via `next/image fill` with `sizes` and a grayscale-to-colour hover (`:63-74`). Callers pass non-empty `imageAlt` such as "KNEST Programs" for a decorative image. Used by about, programs, events, resources, startups, ecosystem, blog, contact, get-involved. `h1` size is intentionally modest (not the 2.5x display rule in the composition guide).

## LogoutButton (`layout/logout-button.tsx`, client)

Prop `className`. POSTs `/api/auth/password/logout` via `formRequest`, on failure shows an inline `role="alert"` message and re-enables; on success wipes lab device caches (best effort) and does a full navigation to `/` so the router cache holds nothing from the session (`:15-28`). `aria-busy` is set while pending.

## RouteError (`errors/route-error.tsx`, client)

Prop `reset`. Heading "Something went wrong on our end.", body "Not your fault. Please try again in a moment.", a "Try again" button calling `reset()` and a "Go home" link (`:15-31`). It is the `h1` of the error state. It imports `Button` from the path, not the barrel. No error id or digest is displayed, which matters for support: there is no way for a user to quote a reference.

## RichText (`content/rich-text.tsx`)

`{data, className}` wraps Payload's `RichText` with `defaultJSXConverters` inside a `prose-knest` container; returns `null` for empty data (`:11-19`). The converters are Payload's: headings, lists, links and marks. Link `href`s come from editors. Styling is the `.prose-knest` block in `globals.css:82-111` (headings forced uppercase, links underlined in signal colour). Rich text images and uploads are not styled.

## LegalPending (`content/legal-pending.tsx`)

Props `kind: 'privacy' | 'terms'`, `preview: boolean`. Says the text is "being finalised with KIIT" and offers a link to `/contact`; with `preview` it appends a reviewable outline under a "Draft, not approved" banner on every item (`:40-71`). The `preview` flag is `LEGAL_DRAFT_PREVIEW === 'true'` read on a force-dynamic page (`privacy/page.tsx:13`). Both pages set `robots: {index:false}` and the sitemap omits them (`sitemap.ts:13`). Failure mode: setting the env var in production would expose draft section titles; the banner text makes that obvious but it is not blocked.

## TurnstileWidget (`security/turnstile-widget.tsx`, client)

Props: `siteKey`, `onToken(token|null)`, `resetSignal = 0`, `action?`. Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once (module-level promise reset on error, `:16-33`), renders into a `div role="group" aria-label="Human verification"` with a reserved height (`:86`). Callbacks: success passes the token, expiry and widget error pass `null` (`:68-71`); a script load failure also passes `null` (`:73`). `resetSignal > 0` calls `turnstile.reset` (`:81-83`). Renders nothing when `siteKey` is empty (local development). The CSP allows the script and frame (`next.config.ts:19-21`). Failure mode: a blocked script leaves submit disabled with no message or retry (E5.03). The widget renders a visible challenge when Cloudflare decides; focus handling of that iframe is Cloudflare's.

## GoogleButton (`auth/google-button.tsx`)

`{label, next}`; a real `<form method="post" action="/api/auth/google/start">` with an optional hidden `next` (`:10-12`) and a secondary `Button type="submit"` with a decorative `aria-hidden` SVG. It is a server-renderable component; it works without JavaScript. Rendered only when `googleConfigured()` is true.

## ReportTable (`labs/report-table.tsx`)

Lab usage report table with `scope`, caption, and a focusable labelled scroll region (reviewed positively in the accessibility review). Uses `--color-line-strong`.

## MotionProvider (`motion-provider.tsx`, client)

`<MotionConfig reducedMotion="user">` wrapping `children` in the root layout (`:6-8`). Covers every framer-motion element in the app; see E5.10.

## TripleHelix (`content/triple-helix.tsx`, client)

Covered in E5.06 section 4: hover-only popovers, heading skips, literal colours.
