# syntax=docker/dockerfile:1.7
#
# Production image for KNEST (linux/arm64 on AWS Graviton; also builds for amd64).
# Two deployable targets from one build, so migrations and the app are always the
# same code:
#
#   docker build --target runner  -t knest-app .       # the web server
#   docker build --target migrate -t knest-migrate .   # one-off: pnpm migrate
#
# No secret is read at build time. Everything the app needs arrives as environment
# variables at run time (see src/server/env.ts for the list and the checks).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
# The pnpm version comes from "packageManager" in package.json.
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` runs without a database or any secret; routes that need them are
# rendered on request, not at build time.
ENV NODE_ENV=production
RUN pnpm build

# One-off migration job: Drizzle migrations for `app`, then Payload for `cms`.
FROM build AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "migrate"]

# The web server: Next.js standalone output only. No source, no dev dependencies.
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app --no-create-home app
WORKDIR /app
# postbuild copies .next/static and public into the standalone folder.
COPY --from=build --chown=app:app /app/.next/standalone ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
