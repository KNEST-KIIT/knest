# Dependency triage

## Follow-up 2026-10-17

After pushing code commit `63d8093`, GitHub reported 44 open alerts (4 critical, 17 high, 19 medium and 4 low). All 44 were retrieved through `gh api repos/KNEST-KIIT/knest/dependabot/alerts?state=open&per_page=100` and their vulnerable ranges were compared programmatically with **every resolved version** of each affected package in `pnpm-lock.yaml`, using the installed semver implementation. Comma-separated GitHub ranges were normalized to npm comparator sets. No locked version satisfied any of the 44 vulnerable ranges.

| Package | Resolved version | Open alert numbers | Comparison |
|---|---|---|---|
| next | 16.4.0 | 19, 40–44 | Outside every vulnerable range; latest listed fix is 16.3.8 |
| payload | 3.90.2 | 1, 24–39 | Outside every vulnerable range; newer alerts list 3.90.0 as patched |
| nodemailer | 10.0.16 | 2–5, 8–9, 20–23 | Outside every vulnerable range |
| undici | 7.30.0 | 7, 10–18 | Outside every vulnerable range |
| fast-uri | 3.1.8 | 6 | Outside the vulnerable 3.1.6 range |

`pnpm audit --prod` again reported only the two existing ignored advisories documented below. No dependency or ignore list was changed and no alert was dismissed. The reason GitHub still lists these alerts was not established; this comparison certifies the checked lockfile, not the older deployed image. Re-check that image separately before public cutover. The original 2026-10-12 triage follows.

Date: 2026-10-12. Base: `codex/production-v1` at `b5ca498`. Author: HARDENING agent.

Method: `gh api repos/KNEST-KIIT/knest/dependabot/alerts` (23 alerts, all state `open`, default
branch is `codex/production-v1`), compared with the resolved versions in `pnpm-lock.yaml` and
`package.json`, and with `pnpm audit --prod` run on this branch. No alert was dismissed through
the API; the decisions below are recommendations.

## Result

All 23 open alerts name a version range that the installed version is outside of. Every alert
that has a patched release is fixed in the lockfile on this branch. None needs an upgrade or a
new override. The alerts are still open on GitHub, which means Dependabot has not re-scanned the
lockfile since commit `899a65f` (2026-10-08, the dependency upgrade) and `7798fe9` (2026-10-09).

Evidence that the fix is real and not only a manifest change: the lockfile resolves a single
version of each package, so no second, older copy is pulled in by a transitive dependency.

| Package | Installed (lockfile) | How it is held there |
|---|---|---|
| next | 16.4.0 | direct, exact pin in `package.json` |
| nodemailer | 10.0.16 | direct, `^10.0.16` |
| payload and `@payloadcms/*` | 3.90.2 | direct, exact pins |
| undici | 7.30.0 | override `undici@<7.29.1: >=7.29.1 <8` in `pnpm-workspace.yaml` |
| fast-uri | 3.1.8 | override `fast-uri@<3.1.8: >=3.1.8 <4` |

## Alert table

| Alert | Package | Severity | Vulnerable range | Fixed in | Installed | Decision | Reason |
|---|---|---|---|---|---|---|---|
| 19 | next | critical | >=16.2.0 <16.3.6 (RCE in `next/og` ImageResponse) | 16.3.6 | 16.4.0 | Fixed; recommend dismissing as "fix already applied" only if the alert does not auto-close | Installed is above the fix. The app does not import `next/og` either. |
| 23, 22 | nodemailer | high | <=10.0.5 (quadratic address parser DoS) | 10.0.6 | 10.0.16 | Fixed | Installed is above the fix. |
| 21, 20 | nodemailer | medium | <10.0.2 (nested recipient arrays, stack exhaustion) | 10.0.2 | 10.0.16 | Fixed | As above. |
| 9, 8 | nodemailer | medium | >=5.0.0 <10.0.2 (DNS cache reuses TLS servername) | 10.0.2 | 10.0.16 | Fixed | As above. |
| 5 | nodemailer | medium | <=9.1.0 (`resolveContent` bypasses file/url access limits) | 9.1.1 | 10.0.16 | Fixed | As above. |
| 4 | nodemailer | high | <9.1.0 (quadratic addressparser) | 9.1.0 | 10.0.16 | Fixed | As above. |
| 3 | nodemailer | medium | <9.1.0 (IDN/punycode allow-list bypass) | 9.1.0 | 10.0.16 | Fixed | As above. |
| 2 | nodemailer | medium | >=6.9.16 <9.1.0 (recipient domain validation bypass) | 9.1.0 | 10.0.16 | Fixed | As above. |
| 18, 17, 16, 15, 14, 13, 12, 11, 10, 7 | undici | low x3, medium x5, high x2 | >=7.0.0 <7.29.1 (WebSocket, retry, cache and TLS issues) | 7.29.1 | 7.30.0 | Fixed by override | Installed is above the fix. undici is reached through Payload and Next build tooling and server fetch, not through a code path of ours that accepts a remote WebSocket. |
| 6 | fast-uri | high | =3.1.6 (host confusion, unclosed bracket) | 3.1.7 | 3.1.8 | Fixed by override | Installed is above the fix. |
| 1 | payload | medium | <=3.88.0 (default account-unlock access lets authenticated users reset other accounts' lockouts) | no patched version listed | 3.90.2 | Not affected | Installed is outside the vulnerable range. In addition the Payload `staff` collection is a read-only mirror with the Auth.js strategy; there is no Payload login or lockout to reset. |

## Advisories accepted on purpose (not Dependabot alerts)

`pnpm audit --prod` reports two further advisories that `pnpm-workspace.yaml` ignores by GHSA id,
each with a recorded reason (KN-03). This triage re-checked that they still have no patched
release path and that both are reached only through build or development tooling:

| Advisory | Package | Why accepted | Revisit |
|---|---|---|---|
| GHSA-vfj7-8cjw-p6xm | braces (ReDoS on nested glob patterns) via sass and chokidar | Build-time file watching, no request path | When sass or chokidar releases a fixed range |
| GHSA-67mh-4wv8-2f99 | esbuild (dev server request exposure) via drizzle-kit | Developer tool, never started in production | When drizzle-kit drops the legacy loader |

## Recommendations

1. Trigger a Dependabot re-scan so the alerts close themselves: any push that changes
   `pnpm-lock.yaml` on the default branch does it; otherwise the owner can use the alert page
   "Dismiss: fix has already been applied" for each. Do not dismiss before confirming the
   deployed image was built from a lockfile at or after `7798fe9`.
2. Nothing here is a reason to hold the release. The CI step that runs `pnpm audit` remains the
   gate: any new advisory not on the ignore list fails the build.
3. Re-run this triage on the release SHA; the alert list is time-dependent.
