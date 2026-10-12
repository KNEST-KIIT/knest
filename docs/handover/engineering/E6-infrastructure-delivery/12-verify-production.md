# E6.12 `scripts/verify-production.mjs` and `scripts/lib/verify-core.mjs`

Purpose: check that a deployed KNEST answers the way the design says, from the outside. The same check library runs in CI against a local server in `infra/verify/verify.test.ts`, and in the CI `image` job against the container (`ci.yml:181-182`). Against the real distribution it has **not** been run with evidence on file (`OPERATOR-COMMANDS.md:14-21`, blocked pending the gate password).

## 1. Command line (`verify-production.mjs`, 68 lines)

```
node scripts/verify-production.mjs --url <https://host> [--gate] [--waf] [--origin URL]
     [--alt a,b] [--connect-to IP] [--evidence file.md]
KNEST_VERIFY_BASIC="user:password"   # env only, never an argument
```

| Option | Effect |
|---|---|
| `--gate` | additionally expect 401 + Basic challenge without credentials and 401 with wrong ones |
| `--waf` | expect a script-injection probe to be blocked with 403 |
| `--origin URL` | the origin's own address; a direct request must be refused |
| `--alt a,b` | alternate hostnames that must 301 to the canonical site |
| `--connect-to IP` | connect to this IP while keeping the URL's host for SNI and Host (for testing aliases before DNS points anywhere) |
| `--evidence F` | write a Markdown table (target, date, options, PASS/FAIL rows) |

Exit 0 if no check failed, 1 otherwise, 2 for missing `--url`. Credentials are taken from `KNEST_VERIFY_BASIC`; with `--gate` and no credential set, the authenticated checks hit the gate and fail rather than being skipped.

## 2. The checks (`verify-core.mjs:62-145`)

`request()` (`:10-53`) is a single `http`/`https` request with a 15 s timeout and a 200,000 byte body cap, `lookup` overridden for `--connect-to`, `servername` set to the URL host, and the peer certificate read at response time for expiry.

| # | Check | Pass condition | Lines | Why |
|---|---|---|---|---|
| 1a | HTTPS valid certificate (https URLs only) | request succeeds and certificate has more than 14 days left | `:70-73` | catches expiry and wrong names |
| 1b | plain HTTP redirected | `http://<host>/` returns 301 or 308 with an `https://` location | `:74-75` | CloudFront redirect-to-https |
| 2 | gate (with `--gate`) | anonymous: 401 with `WWW-Authenticate: Basic`; wrong credentials: 401 | `:79-84` | the private-first control works |
| 3a | `/login` returns 200 | | `:87-91` | |
| 3b | `content-security-policy`, `x-content-type-options`, `x-frame-options`, `referrer-policy` present | | `:87-91` | headers set by the app survive CloudFront |
| 3c | `strict-transport-security` has `max-age` of 7+ digits (https only) | | `:92` | the response-headers policy |
| 4 | for each of `/login`, `/signup`, `/dashboard`, `/admin`, `/api/auth/session`, `/api/staff?limit=0`, `/api/health` (`:60`): `cache-control` contains `no-store`, lacks `public`/`s-maxage`, and a second request is not `Hit from cloudfront` | `:95-101` | nothing private is cacheable, at the origin and at the CDN |
| 5 | first `/_next/static/*.js|css` found in the `/login` HTML is cached: second response 200 with `max-age` of 5+ digits or `immutable` | `:104-109` | static cache policy works (skipped if no asset link is found) |
| 6a | `/api/staff?limit=0` anonymous: 401 or 403 | `:112-113` | |
| 6b | `/admin` anonymous: 307, 308, 401, 403 or 404 | `:114-115` | console hidden |
| 6c | cross-origin `POST /api/auth/password/login` with `Origin: https://evil.example` is 403 | `:116-121` | same-origin guard |
| 7 | with `--waf`: `GET /?q=<script>alert(1)</script>` is 403 | `:124-127` | managed rules actually attached |
| 8 | with `--origin`: direct request is refused (`403` or no answer within 8 s) | `:130-134` | origin not reachable around the CDN |
| 9 | per `--alt` host: `GET /programs/incubate?ref=a&x=1` with `Host: <alt>` returns 301 to `https://kiitnest.com/programs/incubate?ref=a&x=1` | `:137-141` | canonical redirect keeps path and query |

## 3. What a pass means and does not mean

- It is a **black-box smoke of the edge and header contract**, with a fixed list of paths. It does not sign in and does not touch application data except one refused POST.
- **Check 8 passes on silence.** `refused = !direct.ok || direct.status === 403` (`:132`): a typo in the origin URL, a DNS failure, or an unrelated host that does not answer within 8 s counts as "origin refuses". The unit test asserts that behaviour deliberately ("one that does not answer is a pass", `infra/verify/verify.test.ts:84`). To make it meaningful, run it from a machine that can reach the ALB's public address, and confirm a positive control (the same URL through the correct CloudFront header returns 200) separately (D-17).
- Check 4 verifies `cache-control` on `/api/health` as `no-store`, which matches the route (`src/app/api/health/route.ts`).
- The WAF check proves a managed rule fires for one XSS string; it says nothing about the rate rules or about false positives on legitimate traffic.
- Without `--connect-to`, `--alt` checks need DNS to point at the distribution; before cutover use `--connect-to <cloudfront-ip>`. That IP is not obtainable from the templates; it is a lookup of the distribution domain.

## 4. How it is tested (`infra/verify/verify.test.ts`)

A local HTTP server plays a correct deployment and several defective ones. Tests: all checks pass against the correct deployment (`:77-83`); an origin that answers directly is a failure and one that does not answer is a pass (`:84-90`); each class of fault is caught (`:92-107`); the gate passes when it demands and accepts credentials, and fails when expected but open (`:109-127`). That proves the checker's logic, not the real distribution's behaviour.

## 5. Recommended use at cutover

From `CUTOVER-RUNBOOK.md:55`: `node scripts/verify-production.mjs --url https://kiitnest.com --alt www.kiitnest.com,kiitnest.in,www.kiitnest.in --waf`, output kept under `docs/delivery/EVIDENCE/`. `DNS-MIGRATION.md:31` adds `--origin <origin>`. Add `--evidence` to produce the file. Run it first during private verification with `--gate` and the preview address (`OPERATOR-COMMANDS.md:17-19`).
