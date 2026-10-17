# Cloud continuation verification, 2026-10-17

## Baseline and scope

The managed cloud checkout initially contained clean commit `958e20f`, not the requested `7dffe0ac6f72453b540e23c532a30d1406543799`. Connected GitHub reads recovered the checkpoint and compared the 17 changed files. Enabling network permission for shell checks made the configured proxy reachable; `git fetch` then recovered the actual commit. Work is on `codex/runtime-container-ci` from exactly `7dffe0a`. Operator commits `93e5719` and `e2d8472` were read and remain on the target branch; this change does not replace them.

No AWS profile was selected or used. Environment readiness reported no configured scoped outbound identities, secrets or runtime bindings. No host rollout, hosted migration, infrastructure update, DNS change or real student data was used. Labs and QR/offline remain disabled pending their existing acceptance gates.

## Runtime-container assurance fix

Previously the Docker CI job migrated and served with the same PostgreSQL owner connection, skipping runtime-role provisioning. It now supplies disposable runtime credentials to the migrator, verifies the resulting role from the migrator image, then starts the runner with only that runtime database connection. The probe refuses non-loopback databases, names not ending in `_test`, and identities other than `knest_app`. It checks row privileges for all migrated application/CMS tables, absence of table ownership/TRUNCATE, schema creation, role administration, superuser/replication/RLS-bypass privileges and Drizzle schema access. The existing HTTP verification still runs against the resulting container. Production release and scan gates are unchanged.

This closes a CI coverage gap; it does not prove runtime least privilege on the hosted system or remove instance-role access to the migration secret.

## Checks performed in this cloud session

- Node `24.19.0`; default pnpm was `11.25.0`. `COREPACK_HOME=/workspace/scratch/corepack corepack pnpm` selected pinned `10.33.0` without writing to the unavailable default home.
- Fresh `pnpm install --frozen-lockfile --store-dir /workspace/scratch/pnpm-store`: passed. pnpm reported ignored dependency build scripts; no blanket build-script approval was added.
- Fresh-install unit suite: 54 files, 528 tests passed. Typecheck passed.
- Lint: no errors; the existing unused `PASSWORD` import warning in `70-core-journey.test.ts` remains.
- Secret scan: no findings in 989 tracked files. Syntax check and workflow YAML parsing passed; diff whitespace check passed.
- Production dependency audit exited successfully with the existing two ignored advisories (one high, one moderate); no new exception was added.
- Embedded PostgreSQL failed to initialise because `libicuuc.so.60` is missing. A disposable Docker PostgreSQL 16 bound to loopback replaced it for these checks.
- `pnpm migrate` applied Drizzle and all three Payload migrations to an empty `knest_migration_test` database, provisioned `knest_app`, and the privilege probe passed across the actual migrated tables.
- Separate synthetic schema check: normal role passed; granting TRUNCATE on one table made the probe fail; supplying the owner identity also failed. No production database was involved.
- Standard `pnpm build`: **failed** with six Turbopack Google-font resolver errors (`next/font/google queries have exactly one entry`, importing Instrument Sans through `src/app/layout.tsx`). No framework or font workaround was committed. Full local production-build integration and local Docker application-image verification are therefore **not claimed**. The PR's exact-SHA GitHub CI must verify the updated image job.

Early shell attempts without network permission could not reach the configured proxy and subprocess/network-dependent tests failed. Retrying those checks with network permission produced the passing results above; those early failures are not counted as application regressions.

## Operator release run: final result

[Release run 39054914611](https://github.com/KNEST-KIIT/knest/actions/runs/39054914611), for `7dffe0ac6f72453b540e23c532a30d1406543799`, was observed through completion using connected GitHub job metadata and logs. Exact-SHA CI gate: success. ARM64 app/migrator build and publication: success. Completed ECR scan gate: success (requires no HIGH/CRITICAL findings for both images). Deploy job: **skipped**, consistent with `deploy=false`.

Repository: `166917387892.dkr.ecr.ap-south-1.amazonaws.com/knest-app`.

- App: `sha256:610639ca57dcff22722303001d5891a262b6c88099d96832aa41854d4c29875e`
- Migrator: `sha256:e058342d84c1c529afb11eae4705437d4a98dff1ad38a02bff5343f8da0184d6`

These digests belong to the operator's baseline release, not this CI-only change. Image publication is not deployment evidence.

## Hosted dependencies still open

Read-only inspection [39055427820](https://github.com/KNEST-KIIT/knest/actions/runs/39055427820) recovered SSM command `8cd6b03e-a29e-4050-a69b-5bd0dd2339a7`: Success, responseCode 0, finished `2026-10-11T15:09:44.734Z` on `i-0dbccc58bd903416e`. This resolves the historical unknown command result only. Current image, health, deploy-document version and runtime database identity remain unverified; the app-template update is pending. The operator also reports successful populated upgrades 11→14 and 12→14 with 200 synthetic users and 50 enquiries retained (recorded in the target checkpoint).

Needed access/evidence: scoped AWS operator access (never the documented root profile), signed-in GoDaddy access/owner verification, preview acceptance credentials, approved privacy/terms/content and operating owners, real Turnstile and SES acceptance, runtime-role hosted verification, restore/rollback/rotation/alarm delivery/capacity/accessibility evidence, and the final four-hostname HTTPS/DNS checks. The operator's October 17 domain checks still report a parked apex, failing www TLS, unresolved .in names and a gated CloudFront preview. This session does not independently recertify those endpoints. Public launch and DNS cutover remain incomplete.
