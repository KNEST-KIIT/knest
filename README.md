# KNEST

KIIT's innovation and entrepreneurship ecosystem — a digital front door and operating
layer, not an incubator website with an admin panel.

Three connected surfaces over one shared model of a person and their journey:

- **Public** — discover, self-locate, apply
- **Member** — onboard, track, participate
- **Admin** — operate programs, review applications, publish content

## Status

**Phase 0 complete.** The architecture is proved and the product is specified.
Feature work (phases 1–12) builds against the artifacts in [`docs/`](./docs).

| Phase | | |
|---|---|---|
| 0 | Architecture proof + product artifacts | ✅ |
| 1–12 | Design system → applications → public site → polish | ⏳ |

## Documentation

Read these before changing anything:

| Document | What it settles |
|---|---|
| [`docs/PRODUCT_ARCHITECTURE.md`](./docs/PRODUCT_ARCHITECTURE.md) | What the product is, surface boundaries, the data split, what is deliberately absent |
| [`docs/USER_JOURNEYS.md`](./docs/USER_JOURNEYS.md) | End-to-end flows for all seven user types |
| [`docs/CONTENT_SPEC.md`](./docs/CONTENT_SPEC.md) | Production copy — every string that ships |
| [`docs/UX_WIREFRAMES.md`](./docs/UX_WIREFRAMES.md) | Screen-by-screen layout, states, responsive and motion rules |

## Running it

Requires Node 22+, pnpm 10+, and Postgres 16 (via Docker or local).

```bash
pnpm install
cp .env.example .env          # then set AUTH_SECRET and PAYLOAD_SECRET
docker compose up -d          # or point DATABASE_URL at any Postgres 16
pnpm db:migrate
pnpm db:seed
pnpm dev                      # http://localhost:3000
```

`pnpm db:seed` creates a super admin (`admin@knest.local`) and, outside production, a
non-staff test account (`student@knest.local`) used to verify the authorization
boundary. Both use `SEED_PASSWORD`, default `knest-dev-password`.

It seeds **no** startups, mentors, metrics, testimonials or partnerships. KNEST's
ecosystem is beginning, and the product shows that honestly rather than filling itself
with plausible fiction. Every counter reads a real table, so `0` is what you will see —
and `0` is correct.

## Commands

| | |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations · seed |

## Architecture

Next.js 16 (App Router) · React 19 · TypeScript strict · Payload CMS 3 ·
Postgres 16 + Drizzle · Auth.js v5 · Tailwind v4

### One database, two schemas

Content and operational data are kept apart on purpose ([details](./docs/PRODUCT_ARCHITECTURE.md#4-data-architecture)):

- **`cms`** — Payload's. Programs, startups, mentors, events, resources, pages.
- **`app`** — Drizzle's. Users, sessions, applications, notifications, audit logs.

A CMS is good at editorial content and bad at being a backend. Crossing between them
happens by stable ID in `src/server/services/`, never by a cross-schema join in a page
component.

### One account, one login

There is no separate staff table. `staffRole` on `app.users` is what opens `/admin`,
through a Payload auth strategy that consumes the Auth.js session
(`src/payload/auth-strategy.ts`).

Three deliberate choices, each verified in Phase 0a:

1. **Database sessions, not JWTs** — a JWT cannot be revoked, so a demoted admin would
   keep access until it expired. Deleting the session row locks them out on the next
   request.
2. **`/admin` returns 404, not 403** — a 403 confirms the console exists.
3. **Roles are re-read from the database on every request**, never trusted from the
   session payload.

> Auth.js v5 refuses to pair its Credentials provider with database sessions. Rather
> than accept JWTs, password sign-in mints the same session row Auth.js creates for
> OAuth — see `src/server/auth/session.ts`.

### Authorization

`src/server/auth/guards.ts` is the only enforcement point. Every server action, route
handler and protected page calls a guard as its **first statement**. Role checks inside
components decide what to render; a hidden button is not access control.

## Version constraints

Payload 3.88 requires Next `>=16.2.6 <17` and graphql `^16`. Upgrading Next past 17
requires upgrading Payload in the same change. `pnpm.overrides` pins `pg`/`@types/pg`
so a single `drizzle-orm` instance is resolved — two copies produce structurally
identical but incompatible types.

## Deployment

Targets AWS: ECS Fargate behind an ALB, RDS Postgres, S3 + CloudFront for media, SES
for email, secrets in Secrets Manager. `next.config.ts` uses `output: 'standalone'`.
Infrastructure-as-code is intentionally not in this repo yet.

`pnpm build` runs a `postbuild` step that copies `.next/static` (and `public/`, if
present) into `.next/standalone/` — Next's standalone output does not include these
by default (see [the `output` config docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)),
and skipping the copy serves pages with no CSS and no client JS. Run the container
with `node .next/standalone/server.js` (`pnpm start:standalone`), not `next start`/
`pnpm start` — `next start` prints a warning that it's incompatible with `output:
'standalone'` and, verified live, does not read the same runtime environment the
standalone `server.js` does.
