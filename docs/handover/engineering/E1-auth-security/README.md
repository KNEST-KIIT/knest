# Volume E1: authentication, sessions, account lifecycle, security controls, e-mail and notifications

Engineering reference for the engineer taking over the KNEST platform. Base: branch `codex/production-v1` at commit `383abf9`. Everything below was derived from reading the source at that commit; nothing here has been verified against a running production environment. Where the code does not settle a question the text says "not determined from the code".

## Scope

Source areas: `src/server/auth`, `src/server/security`, `src/server/email`, `src/server/notifications`, `src/proxy.ts`, `src/app/api/auth`, `src/app/(auth)`, `next.config.ts`, `src/server/env.ts`, the tests that exercise them, and `docs/delivery/SECURITY-REVIEW.md`. Neighbouring files are cited when the behaviour cannot be understood without them (`src/server/members/actions.ts`, `src/payload/auth-strategy.ts`, `src/instrumentation.ts`, `src/lib/safe-next.ts`, `src/lib/site-url.ts`, the schema files).

## Index

| File | Topic |
|---|---|
| [01-overview-and-data-model.md](01-overview-and-data-model.md) | Components, trust boundaries, request path, tables and columns |
| [02-sessions-and-authjs.md](02-sessions-and-authjs.md) | Database sessions, Auth.js configuration, cookie, deactivation, Google sign-in |
| [03-account-lifecycle.md](03-account-lifecycle.md) | Sign-up, log-in, e-mail verification, password reset, log-out, deactivation: sequences and routes |
| [04-tokens-validation-redirects.md](04-tokens-validation-redirects.md) | Single-use tokens, input schemas, timing-equalising hash, safe redirect |
| [05-authorization-guards.md](05-authorization-guards.md) | Guards, staff areas, Payload bridge, last-super-admin protection |
| [06-edge-guard-and-headers.md](06-edge-guard-and-headers.md) | `proxy.ts`, origin verification, same-origin writes, client address, response headers |
| [07-rate-limiting.md](07-rate-limiting.md) | Postgres token bucket, constants, route catalogue, failure modes |
| [08-turnstile-and-file-verification.md](08-turnstile-and-file-verification.md) | Human check on the server and in the widget, upload content sniffing |
| [09-email-delivery.md](09-email-delivery.md) | Transports, durable outbox, retry, operator resend, templates |
| [10-notifications.md](10-notifications.md) | In-app notification rows and their paired e-mail |
| [11-configuration.md](11-configuration.md) | Environment variables, boot-time check, where each is set |
| [12-tests.md](12-tests.md) | What is covered, where, and what is not |
| [13-findings-and-limitations.md](13-findings-and-limitations.md) | Defects noticed in this reading, stale documentation, open review items |

## Conventions

- Citations are `path:line` or `path:start-end` against the commit above.
- "Audit row" means a row in `app.audit_logs` (`src/db/schema/notifications.ts:43-59`). Authentication events themselves (sign-in, sign-out, failed sign-in, password change) write no audit row; see file 13.
- Config names are the environment variable names; values are never recorded in this volume.

## Reading order for a new owner

1. File 01 for the picture, then 02 and 03 for how a person gets and loses a session.
2. File 06 and 07 before changing anything that touches proxies, CloudFront or limits: the per-address limiter is only meaningful because of the origin-verification and client-address rules.
3. File 13 last: it lists what to fix first.
