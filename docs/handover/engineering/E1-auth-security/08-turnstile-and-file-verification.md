# 08. Human check (Turnstile) and upload content verification

Files: `src/server/security/turnstile.ts`, `captcha.ts`, `src/components/security/turnstile-widget.tsx`, `src/server/security/file-verify.ts`; test stand-ins in `tests/support/turnstile-stub.ts`.

## Cloudflare Turnstile

Only the standalone widget and the `siteverify` call are used; no Cloudflare DNS or CDN is involved (`turnstile.ts:3-5`). Contract module 39 lists sign-up, sign-in, password reset, application submit and booking request.

### Server verification (`turnstile.ts:24-51`)

```
verifyTurnstile(token: unknown, remoteIp: string, env = process.env, fetchImpl = fetch)
  -> { ok: true } | { ok: false, reason: 'missing' | 'rejected' | 'unavailable' | 'not-configured' }
```

| Step | Result |
|---|---|
| `TURNSTILE_SECRET_KEY` unset | `NODE_ENV === 'production'`: `not-configured` (refused). Otherwise `ok: true`, so a developer needs no Cloudflare account (`:30-31`) |
| Token not a non-empty string, or longer than 2048 characters | `missing`, without calling the service (`:33`) |
| Otherwise | POST form `secret`, `response`, and `remoteip` when the address is known and not `unknown`, to `TURNSTILE_VERIFY_URL` or the Cloudflare URL; 5 second timeout (`:36-43`) |
| HTTP error | `unavailable` |
| JSON `success === true` | `ok` |
| `success` anything else | `rejected` |
| Exception, timeout, unparsable body | `unavailable`; the token and secret are not logged (`:47-50`) |

Fail closed: every non-success path refuses the request.

### Route helper (`captcha.ts:10-25`)

`captchaFailure(request, body): Promise<NextResponse | null>` reads `turnstileToken` from the already parsed JSON body and returns null when the handler may continue.

| Reason | Status | `code` | Message |
|---|---|---|---|
| `unavailable`, `not-configured` | 503 | `captcha-unavailable` | "We couldn't run the human check right now. Try again in a minute." |
| `missing`, `rejected` | 400 | `captcha` | "We couldn't confirm you are human. Wait for the check to finish, or reload the page, and try again." |

### Where it is applied

| Route | File:line | Position relative to rate limit |
|---|---|---|
| Sign-up | `api/auth/password/signup/route.ts:11-12` | After the IP bucket |
| Log-in | `login/route.ts:11-13` | After the IP bucket, before the account check |
| Password reset request | `reset/request/route.ts:10-12` | After the IP bucket |
| Application submit | `api/applications/[id]/submit/route.ts:9-11` | No IP limit in the route; the captcha is the first check |
| Contact enquiry | `api/enquiries/route.ts:12` | After the IP bucket |
| Lab booking request | `api/labs/[slug]/request/route.ts:14` | not read in detail |

Not protected by Turnstile: verification send, verification confirm, reset confirm, Google start, logout. The send route is protected by per-address and per-address-plus-e-mail limits instead.

### Widget (`turnstile-widget.tsx`)

- Renders nothing when `siteKey` is empty (local development) (`:85`); forms treat "site key configured and no token yet" as pending and disable submit (`login-form.tsx:19`).
- Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once, memoised in a module variable (`:16-33`); on script error the memo is cleared so a retry can load again (`:26-29`) and the token callback receives null.
- Callbacks: success passes the token; `expired-callback` and `error-callback` pass null so the form disables submit again (`:68-70`).
- A token is single use. After a failed submit the form bumps `resetSignal` and the widget calls `turnstile.reset` (`:37-39`, `:81-83`).
- Passes an `action` string (`login`, `signup`, `password-reset`) to the widget (`login-form.tsx:137`, `signup-form.tsx:138`, `reset-form.tsx:101`).
- CSP allows the script and frame only from `https://challenges.cloudflare.com` (file 06).
- The site key is read at request time by `turnstileSiteKey()` (`turnstile.ts:20-22`) on each server-rendered page (`dynamic = 'force-dynamic'` on login, signup, reset pages), so one container image serves any environment.

### Limits

| ID | Limit |
|---|---|
| L-10 | The server does not read the `action` or `hostname` fields of the `siteverify` response; a token minted for one action or hostname with the same secret would be accepted for another. Not determined whether Cloudflare binds the token to the sitekey only; the application does not add its own binding |
| L-11 | Development with the secret unset accepts any request including with no token (`turnstile.test.ts:57`). Production without a secret refuses all protected routes, and `env.ts` refuses to boot hosted production without both keys (`env.ts:18-19`) |
| - | Remote address `unknown` is not sent to Cloudflare; verification still proceeds |
| - | The integration suite uses a stub endpoint and a stub script that "solves" instantly with token `valid-token`; real Turnstile behaviour is not exercised (SECURITY-REVIEW "not verifiable") |

Tests: `src/server/security/turnstile.test.ts` (accepts confirmed token and sends secret, token, address; rejects; refuses missing, empty, non-string, oversized without calling; fails closed on errors and nonsense; alternate verify URL; without secret refused in production and allowed in development; site key read at call time). The integration helper `CAPTCHA = { turnstileToken: 'valid-token' }` (`tests/support/helpers.ts:24`).

## Upload content verification (`file-verify.ts`)

Purpose: a declared `Content-Type` is whatever the client sent; a renamed executable with a spoofed header would otherwise pass the allow-list (`file-verify.ts:3-7`).

`verifyFileContents(buffer: Buffer, declaredMimeType: string): Promise<boolean>`:

1. Look up the declared type in a table of accepted sniffed types (`:13-23`). Not in the table: false.
2. `fileTypeFromBuffer(buffer)` from the `file-type` package (`:29`).
3. No detectable signature (empty, unrecognised): false (`:32`).
4. True only if the sniffed MIME is in the accepted list for the declared type.

| Declared | Accepted sniffed |
|---|---|
| `application/pdf` | `application/pdf` |
| `application/msword` | `application/x-cfb` |
| `application/vnd.ms-powerpoint` | `application/x-cfb` |
| `.docx` MIME | same `.docx` MIME |
| `.pptx` MIME | same `.pptx` MIME |

Why `application/x-cfb` for both legacy types: `.doc` and `.ppt` share the CFBF container and magic-number sniffing cannot tell them apart without parsing the structure (`:8-11`). A `.xls` or any other CFBF file declared as `.doc` therefore passes. This is an accepted limitation recorded in the code comment.

Call site: `src/server/applications/actions.ts:186`, after the `fileUpload` rate limit (`:160`). A `.docx` is a ZIP; `file-type` identifies the OOXML subtype by its internal entries. Whether a ZIP that is not a Word document but contains the right entry names is accepted was not examined.

Scope: this module sniffs types only. Size limit, storage keys, download headers and virus scanning belong to the storage volume. No malware scanning exists in the code read for this volume.

No dedicated unit test for `file-verify.ts` was located (grep for `file-verify` in `tests` and `src/**/*.test.ts` returned only the module and its caller). The integration test `27-document-upload.test.ts:135` refuses a file whose bytes are not what its type claims and asserts nothing is stored; `:109` stores a real PDF.
