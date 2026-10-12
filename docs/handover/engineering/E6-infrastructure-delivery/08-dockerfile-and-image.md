# E6.08 The Dockerfile and the image build

Source: `Dockerfile` (61 lines), `.dockerignore`, `package.json` scripts. One Dockerfile produces two deployable images; both are built from the same commit by the release workflow and deployed together (`release-image.yml:111-129`, `app.yaml:518-525`).

## 1. Stages

| Stage | Base | Does | Lines |
|---|---|---|---|
| `base` | `node:${NODE_VERSION}-alpine` (ARG default 24) | sets `PNPM_HOME`, disables Next telemetry, `apk upgrade --no-cache`, `corepack enable`, `WORKDIR /app` | `Dockerfile:13-24` |
| `deps` | `base` | copies `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; `pnpm install --frozen-lockfile` with a BuildKit cache mount | `:26-29` |
| `build` | `base` | copies `node_modules` from `deps`, then the source; `NODE_ENV=production`; `pnpm build` | `:31-37` |
| `migrate` (target) | `build` | `CMD ["pnpm","migrate"]` | `:39-42` |
| `runner` (target) | fresh `node:24-alpine` | `apk upgrade`, non-root user `app` uid/gid 1001, copies only `.next/standalone`, `EXPOSE 3000`, `HEALTHCHECK`, `CMD ["node","server.js"]` | `:44-61` |

## 2. Why it is built this way

- **Two targets, one build.** "Migrations and the app are always the same code" (`:3-5`). The migrate image is the full `build` stage: source, dev dependencies, `tsx`, Drizzle config and Payload CLI. That is intentional, because `pnpm migrate` needs them, but it means the image that holds the database master credential at run time is also the largest and has the largest dependency surface. The scan gate applies to it as well (`release-image.yml:139-162`), so a high or critical advisory in a dev-only package can block a release even though that package never runs in the web process.
- **No secret at build time** (`:10-11`, `:34-35`). `next build` runs without a database; routes needing one render on request. Public values are read at run time (`src/server/security/turnstile.ts:19-22`: "never inlined at build, so one image serves any environment"). CI sets only non-secret `NEXT_PUBLIC_SITE_URL` etc. (`ci.yml:18-25`).
- **`apk upgrade --no-cache` in both stages** (`:19-21`, `:50-52`): "so the ECR scan gate sees current OS packages". The Debian base had unfixed critical findings (2 critical, 9 high) and the project moved to Alpine, where the scan reported zero (`V1-DEPLOYMENT-REPORT.md:35`). Consequence: builds are not reproducible. The base tag floats (`node:24-alpine`, no digest pin) and `apk upgrade` pulls whatever is current; two builds of the same commit on different days can differ. The release is pinned by the digest it produced, not by rebuilding.
- **Standalone output only in the runner.** `postbuild` in `package.json` copies `.next/static` and `public` into `.next/standalone` (`Dockerfile:55`). The runner therefore has no source, no dev dependencies and no `.env`; CI asserts `id -u == 1001` and the absence of `/app/.env`, `/app/src`, `/app/tests` and `/app/node_modules/typescript` (`ci.yml:152-155`).
- **`.dockerignore`** excludes `.git`, `.github`, `.next`, `node_modules`, `docs`, `tests`, `infra`, `uploads`, `media`, `coverage`, logs and `.env*` (except `.env.example`). `scripts/` is included, so the migrate image contains `scripts/hosted-smoke.mjs` but not `tests/support/pg.ts` (hence `scripts/drills/populated-upgrade.mts` cannot run in the image).
- **Healthcheck** (`:59-60`): Node `fetch('http://127.0.0.1:3000/api/health')`, exit 0 on a 2xx. `--start-period=30s`: failures inside the first 30 s do not count. The same endpoint is used by the ALB and the deploy loop.
- **Port and host.** `PORT=3000`, `HOSTNAME=0.0.0.0` so the standalone server binds all interfaces inside the container; the host publishes `${HostPort}:3000` (`app.yaml:635`).

## 3. Platform

The release builds `linux/arm64` under QEMU on an amd64 runner (`release-image.yml:104-117`) because the host is Graviton. **The CI `image` job builds and runs the default (amd64) image** (`ci.yml:147-150`). No job in the repository starts the arm64 image before it reaches the host. Native modules (`sharp` is a dependency, `package.json`) and `pnpm install` under emulation are therefore first exercised on the production host, where the only guard is the 90 second health wait and rollback. This is a gap in the pipeline (D-10). A cross-architecture failure would appear as the new container exiting at start and the deploy rolling back.

## 4. What the CI `image` job proves (`ci.yml:117-205`)

1. Both targets build (`:147-150`).
2. The runner is uid 1001 and contains no source, tests, `.env` or TypeScript (`:152-155`).
3. `pnpm migrate`, run from the migrate image against an empty throwaway PostgreSQL 16 with `DATABASE_SSL=off`, succeeds (`:157-163`). Note `DB_RUNTIME_USER` is not set, so the runtime-role step prints "skipped": the role provisioning in the image is **not** exercised by the image job (it is exercised in the integration job's `global-setup.ts:111-126`, through `tsx`, not through the image).
4. The runner starts with a production-shaped environment (`CLIENT_IP_SOURCE=x-forwarded-for`, S3 and SMTP variables, Turnstile keys) and `/api/health` returns `{"status":"ok"}` within 120 s (`:165-178`). `ORIGIN_VERIFY_SECRET` is not set, and `SITE_URL` is loopback, so the guard's "production without secret" refusal is bypassed by its `local` clause (`edge-guard.ts:64-65`): the origin check is not exercised.
5. `scripts/verify-production.mjs --url http://127.0.0.1:3000` runs against the container (`:181-182`); with an http URL the HTTPS, HSTS and CDN-cache checks are skipped (`verify-core.mjs:70-76,92`).
6. A container started with short secrets and no S3 or Turnstile variables does not answer 200 on `/login` and logs `Invalid production environment` (`:184-192`), which is `src/instrumentation.ts:6-11` throwing.
7. Container logs are printed on failure and the verification evidence is uploaded as an artifact (`:194-205`).

It does not prove: TLS to a real RDS with `DATABASE_SSL=verify` (the CA path is only unit-tested in `src/db/ssl.test.ts`), arm64, SES/S3 SDK calls with instance-role credentials, the awslogs driver, or that the migrate image can run as the master role then hand off to the runtime role.

## 5. Failure modes

| Symptom | Cause | Where it shows |
|---|---|---|
| Release scan gate fails with HIGH/CRITICAL | new advisory in base OS or a dependency (either image) | `release-image.yml:158-161` |
| Container exits immediately, log `Invalid production environment` plus names | required variable missing or malformed (names only, no values) | `RUNBOOK.md:282`; `instrumentation.ts` |
| Container unhealthy, health 503 | cannot reach RDS: security group, CA bundle missing (file 02 H-3), wrong password | deploy document rolls back |
| `pnpm install --frozen-lockfile` fails | lockfile out of date | CI `static` and `image` jobs |
| Migrate step fails with a TLS error | `DATABASE_SSL_CA_FILE` path wrong inside the container; the bind mount is `/etc/knest/rds-global-bundle.pem` (`app.yaml:606`) | deploy log |
| Disk full on host | no image pruning | file 03 section 6 |
