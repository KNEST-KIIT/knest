# Live containment (2026-10-08)

## What was done
- Approved by the owner: serve a reversible maintenance response on the production hostname, because Vercel-side Deployment Protection was not reachable from the engineer's login (the project is in team `knest1`; the local login is a different account).
- `claude/knest-ecosystem-platform-g9erjs` (the branch Vercel deploys to Production) was **fast-forwarded `00181d4 -> aa725f4`** with a plain, non-force push. The only change is one new file, `src/proxy.ts`, which answers every request with HTTP 503 and a neutral page. It reads no environment variable, database or cookie.
- Vercel's GitHub integration deployed it: GitHub deployment record **6939184349**, environment Production, state **success** (before it, a protected Preview of the same commit, deployment 6938875477, also succeeded).

## Verification (unauthenticated requests, no cookies, no bypass credentials)
| Check | Result |
|---|---|
| `GET /`, `/blog`, `/programs`, `/privacy`, `/admin`, `/dashboard`, `/login`, `/api/lab-bookings?limit=0&depth=0`, `/api/programs?limit=0`, `/api/auth/providers`, `/api/analytics/track`, `/_next/static/x.js` on `https://knest-kiit.vercel.app` | **503** each, body is the maintenance page, headers `Cache-Control: no-store`, `Retry-After: 86400`, `X-Robots-Tag: noindex` |
| `POST /api/auth/password/login` (no body) | 503 |
| Invented content ("Hostel Dorm", "CAPITAL IS WAITING", "Campus Labs", "MOST DANGEROUS", "Ignite Ideation") in `/` and `/blog` | 0 occurrences |
| Immutable deployment URLs (the previous `00181d4` production deployment `...hz6zussx8...` and the new one `...2u4za7tej...`) | 302 to Vercel SSO: protected |

## What this does and does not establish
- The **production hostname** no longer serves the vulnerable application or any application route. This is a maintenance response, not Deployment Protection.
- The previous vulnerable deployment still exists as an immutable URL behind Vercel SSO. Anyone with dashboard access to team `knest1` could re-promote it (Instant Rollback). **Do not roll back to it.**
- Other aliases or domains attached to the project were not enumerated (no dashboard access); the GitHub deployment records show only the one production URL. UNVERIFIED for any other alias.
- No database was connected or changed. No Vercel setting was changed.

## Rollback of the containment
Revert commit `aa725f4` on the default branch and push (a normal fast-forward). Do this only when a **fixed** build is being released, never to restore `00181d4`.

## Release implication
`src/proxy.ts` now exists on the default branch but not on `delivery/p1-containment`. Releasing the fixed build means merging into the default branch with `src/proxy.ts` deleted in the same change, behind a release manifest and the owner's approval.
