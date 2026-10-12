# 06. Edge guard, client address and response headers

Files: `src/proxy.ts`, `src/server/security/edge-guard.ts`, `client-ip.ts`, `next.config.ts`. Infrastructure that supplies the headers read here (CloudFront, WAF, security groups) is in `infra/cfn/*.yaml` and is outside this volume; what follows describes what the application assumes of it.

## `proxy.ts`

Next.js 16 `proxy` convention (the file is `src/proxy.ts`, exporting `proxy` and `config`). It runs on every path, including static files and API routes (`config.matcher = '/:path*'`, `:19`).

```
proxy(request)
  decision = guardRequest({method, pathname, header}, process.env)
  not allowed -> 403, body "Forbidden", Cache-Control: no-store     (:10-12)
  allowed     -> NextResponse.next()
                 if SITE_INDEXING !== 'on': x-robots-tag: noindex, nofollow   (:14-15)
```

The response to a refusal carries no reason. The reason (`origin-verify` or `origin-mismatch`) is computed but not logged or returned, so an operator diagnosing a wrong secret or a missing `ALLOWED_ORIGINS` entry has nothing in the application logs (file 13, L-08).

## `guardRequest` (`edge-guard.ts:58-91`)

Pure function over `{ method, pathname, header(name) }` and an environment record; no Next types, so it is unit-tested directly.

### Check 1: origin verification

Why: in production the origin is reachable from CloudFront's address range, which is shared by every CloudFront customer. A secret header added only by our distribution closes that gap (`edge-guard.ts:7-10`).

```
secret = ORIGIN_VERIFY_SECRET
site   = SITE_URL || NEXT_PUBLIC_SITE_URL
local  = site matches ^https?://(localhost|127.0.0.1|[::1]) (followed by : / or end)

if NODE_ENV == production and not local and no secret and path != /api/health -> deny (origin-verify)
if secret and path != /api/health:
    presented = header x-origin-verify
    missing or not constant-time-equal to secret -> deny (origin-verify)
```

| Property | Detail |
|---|---|
| Fail closed | A production process with a non-local site URL and no secret refuses everything except the health path (`:65-67`). Test `edge-guard.test.ts:61-68`, including a lookalike host `127.0.0.1.evil.example` which does not count as local |
| Constant-time compare | `timingSafeEqual` after a length check (`:32-36`). Different lengths return false immediately, which leaks only the length |
| Health exception | `/api/health` bypasses the secret because container health checks do not pass through CloudFront; the endpoint reveals only ok or unavailable (`:29-30`; test `29-edge-controls.test.ts:44`) |
| Off when no secret in development and tests | `edge-guard.test.ts:28` |
| Secret exposure | The value is visible in the CloudFront distribution's origin custom headers (SECURITY-REVIEW S-11); `cloudfront:GetDistributionConfig` is as sensitive as the secret |
| Rotation | Not implemented as overlap: only one secret value is accepted. Rotation means changing the stack and the app environment together, and any gap refuses traffic. SECURITY-REVIEW S-11 mentions "a short overlap if both are accepted" but `guardRequest` accepts one value only |

### Check 2: same-origin writes

Applies to `POST`, `PUT`, `PATCH`, `DELETE` (`:27`, `:73`).

```
origin = header Origin
allowed = { origin(SITE_URL or NEXT_PUBLIC_SITE_URL) } + origins parsed from ALLOWED_ORIGINS (comma list, invalid entries ignored)

origin present and not in allowed                         -> deny (origin-mismatch)
origin absent and Sec-Fetch-Site == cross-site            -> deny (origin-mismatch)
otherwise allow
```

| Case | Result | Why |
|---|---|---|
| Origin is the string `null` (sandboxed iframe, some redirects) | deny | Not in the allowed set (test `29:60`) |
| No Origin, no Sec-Fetch-Site (curl, server-to-server, older clients) | allow | The guard cannot distinguish a non-browser client; the route still needs a session or a captcha. Stated at `:76-77` |
| No Origin, `Sec-Fetch-Site: cross-site` | deny | Closed SECURITY-REVIEW S-02. Some browsers and privacy modes omit Origin on a write but still send Fetch Metadata |
| GET and other safe methods | never checked | Cross-site top-level navigations (OAuth callback, links from e-mail) must work (test `edge-guard.test.ts:58`) |
| No site configured, Origin present | deny | Missing configuration must not disable the browser check (`:76`, test `:49`) |

Behaviour a maintainer must know: a custom domain, an `www` alias or a CloudFront default domain used for testing must be added to `ALLOWED_ORIGINS`, or every browser write from that origin gets a bare 403. The unit test uses `ALLOWED_ORIGINS: 'https://d1.cloudfront.net, not a url'` as the example.

Residual (SECURITY-REVIEW S-02): a same-site attacker such as a hostile subdomain is not stopped by the Origin check.

Server Actions: Next compares Origin itself (SECURITY-REVIEW S-02). Integration test `01-server-action-boundary.test.ts` asserts the production Server Action transport publishes no internal application, auth, notification or event services.

## Client address (`client-ip.ts`)

Per-address limits are only as good as the address. A client-supplied `X-Forwarded-For` can be anything (KN-22c).

| Source (`CLIENT_IP_SOURCE`) | Reads | Default |
|---|---|---|
| `cloudfront` | Header `cloudfront-viewer-address` only; strips a trailing `:port` (IPv4) or `[addr]:port` / `addr:port` (IPv6) | When `NODE_ENV === 'production'` (`:17-20`) |
| `x-forwarded-for` | First entry of `X-Forwarded-For` | Otherwise |

In `cloudfront` mode a missing header yields the literal string `unknown`; it never falls back to `X-Forwarded-For` (`:36`, test `client-ip.test.ts:27`). The trust argument is that the origin accepts traffic only from our distribution (origin verification), so only CloudFront can set that header.

Consequence of `unknown`: every request without the header shares one bucket per route (`login:unknown`, `signup:unknown`, ...). If CloudFront ever stopped forwarding the header, all sign-ins would share five attempts per fifteen minutes. SECURITY-REVIEW lists "that `CloudFront-Viewer-Address` arrives on every request" under not verifiable from code. Hosted production also requires `CLIENT_IP_SOURCE=cloudfront` at boot (`env.ts:68`).

Shared addresses: a campus network behind one NAT presents one viewer address, so the per-address limits (5 sign-ins per 15 minutes) are per NAT, not per person. Not measured; noted as a risk for KIIT networks (L-03).

## Response headers (`next.config.ts`)

Set for every path (`headers()`, `:70-88`), by the application rather than CloudFront (except HSTS, which only CloudFront sets, SECURITY-REVIEW S-12):

| Header | Value | Reason |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | |
| `X-Frame-Options` | `DENY` | With `frame-ancestors 'none'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Content-Security-Policy` | see below | |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=(), usb=()` | Camera only for the lab check-in QR scanner |
| `Cross-Origin-Opener-Policy` | `same-origin` | |
| `X-Powered-By` | removed (`poweredByHeader: false`, `:69`) | |

CSP directives (`:17-36`): `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com` (plus `'unsafe-eval'` only when `NODE_ENV === 'development'`); `frame-src https://challenges.cloudflare.com`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' blob: data: https://www.gravatar.com`; `font-src 'self' data:`; `connect-src 'self'`; `worker-src 'self'`; `manifest-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`.

`'unsafe-inline'` on `script-src` means the policy does not stop an injected inline script. It is a static header with no per-request nonce, required by the Payload admin UI and hydration (SECURITY-REVIEW S-01, open, Medium). `src/proxy.ts` already runs per request and could mint a nonce; that is the fix path the review proposes, with a report-only period first.

`connect-src 'self'` has a practical effect: the browser can call only this origin, which is why Turnstile verification happens on the server and not from the page.

Cache-Control on private paths (`:44-58`): `private, no-store` for `/api/:path*`, `/dashboard/:path*`, `/admin/:path*`, `/apply/:path*`, `/onboarding/:path*`, `/login`, `/signup`, `/verify/:path*`, `/reset/:path*`. This is the origin saying so itself; the CDN is separately configured not to cache these paths. `/sw.js` gets `no-cache` so a fix reaches installed copies (`:74`). Test: `29-edge-controls.test.ts:22-42`.

Request body size: `experimental.proxyClientMaxBodySize: '12mb'` (`:67`). With a proxy present Next buffers the body and silently truncates it at its limit (default 10 MB); uploads can be exactly 10 MB plus multipart framing, so the buffer must be larger.

Output mode: `standalone` unless the `VERCEL` environment variable is set (`:61`).

## What is not in the application

- HSTS (CloudFront only).
- Rate limiting at the network layer (WAF; SECURITY-REVIEW S-08 notes the CMS read API has no limiter).
- Verification that the origin security group admits only CloudFront. Not determined from the code.
