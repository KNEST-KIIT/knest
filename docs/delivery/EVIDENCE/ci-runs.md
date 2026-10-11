# CI runs on GitHub

Workflow: `.github/workflows/ci.yml` (verification only: no deploy, no cloud credentials, throwaway Postgres 16 service container).

| Run | Commit | Result | Notes |
|---|---|---|---|
| [37798886780](https://github.com/KNEST-KIIT/knest/actions/runs/37798886780) | `ab64190` (branch `delivery/p1-containment`) | **success**, 2026-10-08 15:13-15:16 UTC | Job "Lint, typecheck, unit tests, audit": install `--frozen-lockfile`, lint, typecheck, unit tests (incl. the content-honesty gate), `pnpm audit --prod --audit-level=moderate` all success (44 s). Job "Build, migrate from zero, integration tests": production build, then the integration suite from an empty PostgreSQL 16 (Drizzle + Payload migrations, production build served, stub SMTP, **real Chrome**) all success (3 min 14 s). |
| [37880663626](https://github.com/KNEST-KIIT/knest/actions/runs/37880663626) | `b222521` | **success**, 2026-10-09 03:44 UTC (3 min 7 s) | Includes the account-deactivation suite (R-03). Both jobs success. |
| [37888046945](https://github.com/KNEST-KIIT/knest/actions/runs/37888046945) | `3ce052c` | **success**, 2026-10-09 | Includes the R-04/R-05 concurrency suite. Both jobs success. |
| 37798351274 | `1afe3b6` | cancelled | Superseded by the next push (the workflow cancels in-progress runs on the same ref). Not a failure. |

What this adds beyond the local runs: the same suite passes on a clean GitHub-hosted runner (Linux, Chrome preinstalled, Postgres service container), which removes "works on this Windows machine" as an explanation.

What it does not show: the suites added after `ab64190` (see the tracker), any staging or production environment, or behaviour with real S3/SES/Google credentials.

## Failed runs recorded 2026-10-09 (omitted earlier)

| Run | Commit | Result | Cause |
|---|---|---|---|
| 37900955747 | `83143e2` | failure | Payload schema drift check: the media collection gains fields only when the S3 plugin is enabled, and CI has no S3 bucket set. |
| 37914486518 | `1427180` | failure | The same drift check; every other test (273) passed. Fixed in `1fc5fcc` by setting the bucket variables inside the check. |
| 37915526485 | `1fc5fcc` | success | |

## Runs recorded 2026-10-12 (from `gh run list`, branch `codex/production-v1`)

| Run | Commit | Result | Note |
|---|---|---|---|
| 38171899823 | `b5ca498` | success | Full release plan. |
| 38170442390 | `400db19` | success | Delivery audit. |
| 38168270179 | `acf04c8` | success | Fixes the failure below. |
| 38167492077 | `b2bf9fe` | **failure** | CMS audit test user had no staff role, so access control refused it. Fixed in `acf04c8`. |
| 38167379943, 38167242434 | `99ba3a4`, `550b0eb` | cancelled | Superseded by the next push (concurrency group). |
| 38153378607 | `d982b23` | success | |
| 38148772768, 38148141555 | `c477da7` | success | |
| 38147250787 | `b98c1d9` | **failure** | Superseded by the S3 stand-in fix in `c477da7`. |
| 38124570347 | `37f342e` | success | |
| 38118846905 | `b4ff4b9` | success | Release image commit named in the V1 deployment report. |
