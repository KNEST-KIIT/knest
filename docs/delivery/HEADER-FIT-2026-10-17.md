# Public header fit regression

Base: `8acb13894cae7054db0582b29ea4853ef1c03e2e`. This change is separate from retention PR #2 and its test-only IST-midnight fixture correction. `CONTINUATION-2026-10-17.md` is deliberately unchanged.

## Reproduction

Chromium against the unchanged production build at `/privacy`, after fonts loaded:

| Viewport | Signed out document width | Signed in document width |
|---|---:|---:|
| 1024 | 1200 | 1196 |
| 1280 | 1292 | 1288 |

Anonymous measurement at 1100 also reached 1200. At narrower desktop widths the last navigation link touched the login control; at 1280 the signup control extended 12px beyond the viewport. The logo/nav/auth groups are non-shrinking, while side padding and gaps increase at the lg/xl breakpoints. KNEST's spacing unit is 8px, so those utility values consume more width than the default Tailwind scale.

The new browser assertions failed on the unchanged build in all four targeted cases (1024 and 1280, anonymous and signed in). This is a reproduced layout regression, not an inferred policy-page defect.

## Change

Only five spacing classes in `src/components/layout/site-header.tsx` change: narrower lg side padding, smaller logo/navigation gaps, smaller navigation-link padding and a smaller account-control gap. Typography, labels, destinations, logo, header height, the 1024 menu breakpoint, mobile behavior and keyboard logic remain intact. No overflow clipping, horizontal scrolling, hidden desktop links or redesign was introduced.

## Verification

- Production build using `next build --webpack`: passed, including TypeScript. Expected CMS fallback diagnostics came from an intentionally unreachable loopback database. No hosted database or provider was contacted. This explicitly uses the webpack build option; the normal Turbopack build remains an exact-SHA CI check.
- `36-header-fit.test.ts`: **22 passes** against the rebuilt production server, using disposable PostgreSQL 16, real synthetic login and local provider stubs.
- Widths: 768, 1023, 1024, 1100, 1279, 1280, 1366, 1440, 1535, 1536 and 1920, for both account states.
- At every width: document scroll width equals viewport width; visible controls are inside the viewport and do not overlap; all six main destinations and the appropriate account link remain available. Tablet drawer links can each be scrolled fully into their own viewport, and Escape closes the drawer.
- Typecheck, focused ESLint, design-token hardcode lint and diff whitespace checks passed. No new hardcoded design values were introduced.

Local setup: use the pinned repository binaries on PATH, a workspace-local `npm_config_cache`, `TEST_DATABASE_URL` on disposable loopback PostgreSQL, and an installed browser via `PW_CHANNEL`/`PLAYWRIGHT_BROWSERS_PATH`. The runner starts Next from a temporary directory; the default nonexistent `/home/agent` npm cache caused the first setup attempt to fail before tests. The existing integration teardown also reports a ten-second Vite process-close warning after the successful run; test exit status is zero. These setup/teardown diagnostics were not suppressed and no assertions or timeouts were weakened.

This is local browser/build evidence. Exact-SHA CI, hosted/device acceptance and public cutover remain separate. No AWS access, billable provisioning, migration, real student data, rollout or DNS change occurred.
