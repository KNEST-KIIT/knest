# E5.01 App Router structure, layouts and boundaries

Scope: `src/app`. Every statement cites the file and line range it was read from. Next.js is 16.4.0 (`package.json:43`). `node_modules` is not present in this checkout, so nothing below was checked against `node_modules/next/dist/docs`; framework behaviour that is described but not proven from this repository is labelled "framework behaviour, not verified here".

## 1. Top-level layout of `src/app`

| Path | Role |
|---|---|
| `layout.tsx` | The only root layout. Renders `<html lang="en">`, `<body>`, the `MotionProvider`, loads `globals.css` and the two `next/font` fonts (`layout.tsx:24-32`). |
| `(public)/` | Marketing and content site. Has its own layout with site header and footer. |
| `(auth)/` | Login, signup, reset, verify. Split-screen layout with no site nav. |
| `(member)/` | Signed-in member screens: `dashboard/`, `onboarding/`, `apply/[program]/`. Three independent layouts, no shared member layout. |
| `(staff)/admin/` | The custom operational console (applications, enquiries, members, labs, audit, analytics, mail, overview). |
| `(payload)/` | Payload CMS admin shell (`/admin/[[...segments]]`) and Payload REST (`/api/[...slug]`). |
| `api/` | Route handlers (not UI; covered by the API volume). |
| `lab-device/` | The QR attendance PWA shell. Sits outside every route group, so it has no site chrome and no group layout. |
| `global-error.tsx`, `not-found.tsx` | Root error and 404 UI. |
| `opengraph-image.tsx`, `robots.ts`, `sitemap.ts` | Metadata routes; see E5.13. |

Route groups (parenthesised folders) do not appear in URLs. Two groups therefore share the `/admin` prefix: `(staff)/admin/<area>/...` and `(payload)/admin/[[...segments]]`. The staff areas are static segments (`overview`, `applications`, `enquiries`, `members`, `labs`, `audit`, `analytics`, `mail`), the Payload shell is an optional catch-all. Framework behaviour, not verified here: static segments take precedence over a catch-all, which is the only reason `/admin/overview` reaches the staff shell while `/admin` reaches Payload. The staff header links to `/admin` as "Full admin (content, programs, startups)" (`(staff)/admin/layout.tsx:50-53`). If Payload ever adds a built-in view whose path equals a staff area name, the staff page would shadow it silently.

## 2. Layouts, who guards, and what chrome each provides

| Layout | Guard | Chrome | `<main id="main">` |
|---|---|---|---|
| `layout.tsx` (root) | none | none | no (`:24-32`) |
| `(public)/layout.tsx` | none; reads the session only to switch the header CTA (`:10-11`) | `SkipLink`, `SiteHeader`, `SiteFooter` | yes (`:17`) |
| `(auth)/layout.tsx` | none | `SkipLink`, logo, cover image; no header/footer | yes (`:13`) |
| `(member)/dashboard/layout.tsx` | `requireUser('/dashboard')` (`:17`) | `SkipLink`, `SiteHeader signedIn`, `SiteFooter` | yes (`:24`) |
| `(member)/onboarding/layout.tsx` | `requireUser('/onboarding')` (`:11`) | `SkipLink`, wordmark only | yes (`:22`) |
| `(member)/apply/[program]/layout.tsx` | `requireUser()` with no return path (`:11`) | `SkipLink`, wordmark only | yes (`:22`) |
| `(staff)/admin/layout.tsx` | `requireStaff()` (`:29`); nav filtered by `canAccessArea` (`:30-31`) | `SkipLink`, admin nav, `LogoutButton` | yes (`:57`) |
| `(staff)/admin/{audit,analytics,applications,...}/layout.tsx` | `requireAdminArea('<area>')` | pass-through | n/a |
| `(payload)/layout.tsx` | `requireStaff()` (`:19`) | Payload's own `RootLayout` | Payload's markup |
| `lab-device/page.tsx` | feature flag, `notFound()` when off (`:25`) | none | yes, inside the page (`:27`) |

Why the guards are in layouts, and what that does and does not protect:

- `(staff)/admin/audit/layout.tsx:3-10` states the reason: a layout runs before any of the page is streamed, so a role without access gets a genuine 404 status rather than a 200 with a not-found body. The area layouts are three lines each; the real permission matrix is `canAccessArea` in `src/server/auth/roles`.
- A layout guard does not re-run on client navigation between sibling pages (framework behaviour, not verified here). That is acceptable because every data read behind these screens also authorises server-side (`requireStaff`, `requireSelf`, route-handler guards); the layout guard is the UX layer, not the only barrier. `guards.ts:9-15` states the rule: "a hidden button is not access control".
- Staff and Payload both answer with 404, never 403, so a stranger cannot confirm that an admin console exists (`guards.ts:64-72`, `(payload)/layout.tsx:16-19`).
- The `(member)` layouts differ on purpose. `dashboard` only calls `requireUser`, not `requireOnboardedUser`, so someone who applied before finishing onboarding can still reach `/dashboard/applications`; the root `/dashboard` page enforces onboarding itself (`dashboard/layout.tsx:7-15`, `dashboard/page.tsx:26`). `apply` calls `requireUser()` without a return path, but its page calls `requireUser('/apply/<slug>')` (`apply/[program]/page.tsx:24`), so the redirect still carries the destination. The layout's own bare call can in theory fire first and redirect to `/login` with no `next`; which wins depends on layout-before-page ordering, which is a framework behaviour not verified here.

Focused-flow layouts (`onboarding`, `apply`) deliberately drop global navigation. The comments cite UX_WIREFRAMES sections 6 and 9 (`onboarding/layout.tsx:5-9`, `apply/[program]/layout.tsx:5-9`). Consequence: there is no notification bell, no logout and no link out other than the wordmark; the only exits are the step controls and the browser back button.

## 3. Root layout

`layout.tsx:9-22` sets `metadata`: title default `KNEST` with template `%s — KNEST`, `metadataBase` from `siteUrl()`, Open Graph site name and locale `en_IN`, Twitter card `summary_large_image`, and all three icon slots pointing at `/images/knest_icon.png`. `siteUrl()` (`src/lib/site-url.ts:7-16`) prefers runtime `SITE_URL`, then build-inlined `NEXT_PUBLIC_SITE_URL`, then Vercel variables, then `http://localhost:3000`. Failure mode: a container started without `SITE_URL` and built without `NEXT_PUBLIC_SITE_URL` emits `http://localhost:3000` into canonical metadata, the sitemap and ICS `URL:` lines. Whether the production environment validation rejects this is a server concern; see `src/server/env.ts` (not read for this volume).

`<html suppressHydrationWarning>` (`:26`) is set although nothing in the app mutates `<html>` before hydration. The reason is not determined from the code; it is harmless but hides real mismatches on that element.

The title template means a page that sets `title: 'KNEST — What if you actually built it?'` (`(public)/page.tsx:17`) renders "KNEST — What if you actually built it? — KNEST". Not determined whether the home page is exempted; the metadata object has no `title.absolute`.

## 4. Error, loading and not-found coverage

`RouteError` (`components/errors/route-error.tsx`) is the single body of every segment `error.tsx`; each `error.tsx` is a 7-line client component that forwards `reset`. None logs the error (the `error` prop is accepted and ignored), and the copy deliberately omits "we have been told about it" because nothing reports errors yet (`route-error.tsx:6-14`, finding KN-21).

| Segment | `loading.tsx` | `error.tsx` |
|---|---|---|
| `(public)`: about, ecosystem, events, events/[slug], invest, mentors, mentors/[slug], programs, programs/[slug], resources, resources/[slug], search, startups, startups/[slug] | yes | yes |
| `(public)/blog` | no | yes (also covers `blog/[slug]`) |
| `(public)/contact`, `get-involved`, `privacy`, `terms`, home | no | no (home has neither) |
| `(member)/dashboard`, `dashboard/applications`, `dashboard/events`, `apply/[program]` | yes | yes |
| `(member)/dashboard/lab-booking*`, `lab-staff*`, `onboarding` | no | no (the dashboard `error.tsx` covers the lab pages by nesting) |
| `(staff)/admin/analytics`, `applications`, `applications/[id]` | yes | yes |
| `(staff)/admin/{audit,enquiries,labs,mail,members,overview}` | no | no |
| `(auth)` pages | no | no |

Failure modes worth knowing:

- Home, contact, get-involved, privacy, terms and all `(auth)` pages have no segment error boundary. A throw there is caught by `global-error.tsx`, which replaces the root layout and renders `RouteError` inside a bare `<html><body>` with only `globals.css` (`global-error.tsx:15-23`). The user sees no header or footer, and the system font stack because the `next/font` variables are set on `<html>` by the root layout it replaced (`:11-14`).
- The `(public)` layout awaits `countUnread` for signed-in users with no try/catch (`(public)/layout.tsx:11`; `countUnread` is `server/notifications/actions.ts:24-31` and itself calls `requireSelf`). A database error there throws from the layout, which no `(public)` boundary can catch (an error file catches errors from its own segment's children, not its sibling layout), so every public page fails to `global-error` for signed-in users while notifications are unreadable. `getSessionUser` is the part that fails closed (`guards.ts:17-33`); the unread count is not.
- `not-found.tsx` exists only at the root (`not-found.tsx:11-26`). It has its own `<main>` without `id="main"` and renders no `SkipLink`, header or footer. By boundary placement, a `notFound()` thrown inside `(public)` is expected to render this root UI in place of the `(public)` layout, so a missing program shows a chromeless 404. Framework behaviour, not verified here. The integration test `80-error-pages.test.ts:5-12` asserts the copy and the `/search` link only, not the chrome.

## 5. Async params and search params

Every dynamic page and `generateMetadata` types `params` and `searchParams` as `Promise<...>` and awaits them (for example `programs/[slug]/page.tsx:26-27`, `programs/page.tsx:84-89`). This matches the Next 15+ contract; no synchronous access remains in the files read. `searchParams` values are used as raw strings and passed into Payload `where` clauses as `equals` values (`server/content/programs.ts:26-30`), which Payload parameterises; unknown values simply match nothing.

## 6. What a new engineer should not assume

1. There is no shared `(member)` layout; adding a banner for all signed-in pages means editing three layouts.
2. `(auth)` pages have no `requireUser` inverse: a signed-in user can open `/login`. Not determined whether anything redirects them; none of the files read does.
3. The sitemap and robots files are route handlers in `src/app`, not `public/` files; there is no `public/robots.txt` or `public/sitemap.xml` (`ls public`).
