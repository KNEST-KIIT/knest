# KNEST

KIIT's innovation and entrepreneurship ecosystem — a digital front door and operating
layer, not an incubator website with an admin panel.

Three connected surfaces over one shared model of a person and their journey:

- **Public** — discover, self-locate, apply
- **Member** — onboard, track, participate
- **Admin** — operate programs, review applications, publish content

## Status

Last reconciled against the git log and CI on 2026-10-12. Evidence beats this paragraph: if it
disagrees with `docs/delivery/TRACKER.md`, the tracker and the CI run win.

- **Not launched.** `kiitnest.com` does not serve this application. A password-gated private
  preview runs on a CloudFront address (`docs/delivery/V1-DEPLOYMENT-REPORT.md`, reported
  2026-10-11, not re-checked since).
- **The application is built to a pilot candidate.** Accounts, applications, review, documents,
  events, notifications, enquiries, staff console, audit trail and the lab booking module
  (behind `FEATURE_LAB_BOOKING`, off by default) exist and are covered by unit tests and by
  integration tests against a real PostgreSQL 16 and the production build, run in CI on every
  push. "Done" in these documents means that: verified locally and in CI, never verified in
  production.
- **Not built or not switched on:** QR attendance, the installable app and offline sync are
  gated by `FEATURE_LAB_ATTENDANCE_QR` and the threat-model review; real Turnstile, SES and S3
  have only been exercised through test doubles in CI.
- **Unverified by people:** no human accessibility review, no penetration test, no load test
  run, and no approved privacy, terms or institutional copy. See the gates listed in
  `docs/delivery/DELIVERY-AUDIT-2026-10-12.md`.

## Documentation

Read these before changing anything:

| Document | What it settles |
|---|---|
| [`docs/PRODUCT_ARCHITECTURE.md`](./docs/PRODUCT_ARCHITECTURE.md) | What the product is, surface boundaries, the data split, what is deliberately absent |
| [`docs/USER_JOURNEYS.md`](./docs/USER_JOURNEYS.md) | End-to-end flows for all seven user types |
| [`docs/CONTENT_SPEC.md`](./docs/CONTENT_SPEC.md) | Production copy — every string that ships |
| [`docs/UX_WIREFRAMES.md`](./docs/UX_WIREFRAMES.md) | Screen-by-screen layout, states, responsive and motion rules |

State of delivery, in the order to read it:

| Document | What it settles |
|---|---|
| [`docs/delivery/DELIVERY-AUDIT-2026-10-12.md`](./docs/delivery/DELIVERY-AUDIT-2026-10-12.md) | The blunt state of the project and what is weak |
| [`docs/delivery/V2-FULL-RELEASE-PLAN.md`](./docs/delivery/V2-FULL-RELEASE-PLAN.md) | The plan for all 53 contracted modules, phases and gates |
| [`docs/delivery/TRACKER.md`](./docs/delivery/TRACKER.md) | Task status with evidence, and what each check does not cover |
| [`docs/delivery/FINDINGS.md`](./docs/delivery/FINDINGS.md) | The findings register (KN and NF ids) and its current disposition |
| [`docs/delivery/LOCAL-COMPLETENESS.md`](./docs/delivery/LOCAL-COMPLETENESS.md) | The 53 modules against the code |
| [`docs/delivery/SECURITY-REVIEW.md`](./docs/delivery/SECURITY-REVIEW.md) | ASVS-based code review, findings and fixes |
| [`docs/delivery/DEPENDENCY-TRIAGE.md`](./docs/delivery/DEPENDENCY-TRIAGE.md) | Open dependency alerts against installed versions |
| [`docs/delivery/DRILLS.md`](./docs/delivery/DRILLS.md) | Restore, rollback, alarm and capacity drills, with results |
| [`docs/handover/`](./docs/handover) | Architecture, runbook, operations guides, accessibility and load test scripts |

## Running it

For a complete isolated local test environment (database, captured mail, file storage,
demo accounts and labs), use `pnpm dev:local`. See [Local testing](docs/LOCAL-TESTING.md).

Requires Node 22+, pnpm 10+, and Postgres 16 (via Docker or local).

```bash
pnpm install
cp .env.example .env          # then set AUTH_SECRET and PAYLOAD_SECRET
docker compose up -d          # or point DATABASE_URL at any Postgres 16
pnpm db:migrate
pnpm db:seed
pnpm dev                      # http://localhost:3000
```

`pnpm db:seed` creates a super admin (`SEED_ADMIN_EMAIL`, default `admin@knest.local`) and,
outside production, a non-staff test account (`student@knest.local`) used to verify the
authorization boundary.

Seed safety (KN-07):

- The development default password is used **only** when `DATABASE_URL` points at a local
  database and the environment is not production. Against any other database, set
  `SEED_PASSWORD` (12+ characters; the published default is rejected).
- Seeds never rewrite an existing account. To reset local accounts deliberately, set
  `SEED_RESET_EXISTING=true` (ignored in production).
- `pnpm db:seed:demo` and the dummy-programs seed insert fictional records and well-known
  logins. They refuse to run in production, and refuse a non-local database unless
  `ALLOW_DEMO_SEED=true` is set for a disposable non-production database.

It seeds **no** startups, mentors, metrics, testimonials or partnerships. KNEST's
ecosystem is beginning, and the product shows that honestly rather than filling itself
with plausible fiction. Every counter reads a real table, so `0` is what you will see —
and `0` is correct.

## Commands

| | |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint 9 (flat config); warnings are tracked, errors fail CI |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest unit tests |
| `pnpm test:integration` | Integration tests against an ephemeral PostgreSQL 16 and the production build (CI runs these; needs a local PostgreSQL or `pnpm test:db`) |
| `pnpm check` | Lint, typecheck and unit tests in CI order |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations · seed |
| `pnpm migrate` | Production migration: Drizzle, Payload, then the runtime database role |
| `node scripts/ops/load-test.mjs` | Deterministic load test; local addresses only unless explicitly allowed (`docs/handover/LOAD-TEST.md`) |

## Architecture

Next.js 16 (App Router) · React 19 · TypeScript strict · Payload CMS 3 ·
Postgres 16 + Drizzle · Auth.js v5 · Tailwind v4

### One database, two schemas

Content and operational data are kept apart on purpose ([details](./docs/PRODUCT_ARCHITECTURE.md#4-data-architecture)):

- **`cms`** — Payload's. Programs, startups, mentors, events, resources, pages.
- **`app`** — Drizzle's. Users, sessions, applications, notifications, audit logs.

A CMS is good at editorial content and bad at being a backend. Crossing between them
happens by stable ID in `src/server/`, never by a cross-schema join in a page component.

### One account, one login

There is no separate staff table. `staffRole` on `app.users` is what opens `/admin`,
through a Payload auth strategy that consumes the Auth.js session
(`src/payload/auth-strategy.ts`).

Three deliberate choices, each verified in Phase 0a:

1. **Database sessions, not JWTs** — a JWT cannot be revoked, so a demoted admin would
   keep access until it expired. Deleting the session row locks them out on the next
   request.
2. **`/admin` returns 404, not 403** — a 403 confirms the console exists. This also means a
   visitor who is not signed in as staff sees 404 at `/admin`; that is by design.
3. **Roles are re-read from the database on every request**, never trusted from the
   session payload.

> Auth.js v5 refuses to pair its Credentials provider with database sessions. Rather
> than accept JWTs, password sign-in mints the same session row Auth.js creates for
> OAuth — see `src/server/auth/session.ts`.

### Authorization

`src/server/auth/guards.ts` is the only enforcement point. Every server action, route
handler and protected page calls a guard as its **first statement**. Role checks inside
components decide what to render; a hidden button is not access control.

### Request controls

`src/proxy.ts` runs before every route: it refuses a request that did not come through the
CloudFront distribution (origin-verification secret) and a state-changing request from another
origin (`src/server/security/edge-guard.ts`). Rate limits are a PostgreSQL token bucket
(`src/server/security/rate-limit.ts`). Browser hardening headers are set in `next.config.ts`;
HSTS is set at CloudFront (`infra/cfn/edge.yaml`).

## Version constraints

Payload 3.90.2 and Next 16.4.0 are pinned exactly in `package.json`; Payload declares which
Next range it supports, so upgrade them in one change. Overrides for `pg`, `@types/pg` and
patched transitive dependencies (`undici`, `fast-uri`, `dompurify`, `source-map-js`,
`fast-copy`) live in `pnpm-workspace.yaml`, because pnpm 10 ignores the `pnpm` block in
`package.json`. `pnpm audit --prod --audit-level=moderate` is a CI gate; two advisories are
accepted by id with reasons in `pnpm-workspace.yaml`. `next-auth` stays on `5.0.0-beta.32`
(no stable v5 exists).

## Deployment

AWS-native, one production environment (no staging), designed in
[`docs/delivery/AWS-NATIVE-ARCHITECTURE.md`](./docs/delivery/AWS-NATIVE-ARCHITECTURE.md):
CloudFront with WAF in front of an application load balancer and an EC2 host running the
container image by digest, RDS PostgreSQL, S3, SES, Secrets Manager. Infrastructure is
CloudFormation in `infra/cfn/`; the release procedure is in `docs/handover/RUNBOOK.md`.
`next.config.ts` uses `output: 'standalone'`.

`pnpm build` runs a `postbuild` step that copies `.next/static` (and `public/`, if
present) into `.next/standalone/` — Next's standalone output does not include these
by default (see [the `output` config docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)),
and skipping the copy serves pages with no CSS and no client JS. Run the container
with `node .next/standalone/server.js` (`pnpm start:standalone`), not `next start`/
`pnpm start` — `next start` prints a warning that it's incompatible with `output:
'standalone'` and, verified live, does not read the same runtime environment the
standalone `server.js` does.
