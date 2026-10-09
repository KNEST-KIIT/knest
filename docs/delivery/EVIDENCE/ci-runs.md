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
