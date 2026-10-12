# E5.04 Return-path safety (`safe-next`)

Source: `src/lib/safe-next.ts` (37 lines), test `src/lib/safe-next.test.ts` (58 lines). The helper validates the post-login, post-signup and post-verification return path carried in `?next=` (finding KN-22e).

## 1. What it does

`safeNext(raw)` returns a same-origin path or `null` (`safe-next.ts:20-37`):

1. Rejects non-strings, the empty string and anything over 2048 characters (`:21`).
2. Requires the first character to be `/` and the second not to be `/` (`:24`), which rejects protocol-relative `//host`.
3. Rejects any backslash anywhere (`:25`); the constant is built with `String.fromCharCode(92)` (`:9`) so the source file cannot be mangled by escaping. Browsers read `/\host` as `//host`.
4. Rejects any control character, space or DEL (`:11-18`, `:27`), because browsers strip tabs and newlines inside URLs and `/<TAB>/host` becomes `//host`.
5. Parses the value against the dummy origin `http://knest.invalid` (`:8`, `:31`) and rejects it if the resulting origin differs (`:35`).
6. Returns `url.pathname + url.search + url.hash` (`:36`): the normalised URL, not the input.

Why a dummy origin: it lets the WHATWG URL parser do the work of resolving the value instead of hand-rolled string checks, and `.invalid` is a reserved TLD, so it cannot collide with a real site.

## 2. Where it is applied

| Site | Use | Trust level of the result |
|---|---|---|
| `(auth)/login/login-form.tsx:34` | `next` from the query string, then `router.push(next ?? '/dashboard')` (`:58`) | Client navigation. The only place the result is used directly as a navigation target. |
| `(auth)/signup/signup-form.tsx:16` | `returnTo`, sent to the signup API as `next` (`:38`) and to the Google form (`:76`) | Re-validated server-side. |
| `server/auth/actions.ts:64` | Server re-validation, then embedded in the verification e-mail link (`:111-112`) | Re-validated again at the link. |
| `(auth)/verify/confirm/page.tsx:30` | Validates the `next` carried by the e-mailed link | Passed to `VerifyConfirm`. |
| `api/auth/google/start/route.ts:25` | `redirectTo: next ?? '/dashboard'` for Auth.js (`:28`) | Server. |
| `server/onboarding/destination.ts:31-36` | `onboardingReturnPath` additionally refuses `/onboarding` and its children so the flow cannot loop | Used for onboarding completion (`onboarding-flow.tsx:391`) and `onboardingUrl`. |

Return paths are produced, not just consumed, in several places, all of which `encodeURIComponent` the value: `requireUser(returnTo)` (`server/auth/guards.ts:36-42`), the apply CTA (`programs/[slug]/apply-cta.tsx:66`), the journey selector (`journey-selector.tsx:54`), the register button (`register-button.tsx:34`) and the 401 handlers in the application and onboarding forms (`application-form.tsx:73,103,126`, `onboarding-flow.tsx:86`).

## 3. Defect: the normalised path can start with `//`

`safeNext` checks the raw input for `//` at positions 0-1 but returns the parsed `pathname`. Dot segments are resolved by the URL parser after the check, and a leading `..` or `.` followed by an empty segment collapses to a path that begins with two slashes. Reproduced with Node's `URL` in this checkout (no application code was run):

| Input | `safeNext` returns |
|---|---|
| `/..//evil.com` | `//evil.com` |
| `/.//evil.com` | `//evil.com` |
| `/a/..//evil.com` | `//evil.com` |
| `/%2e%2e//evil.com` | `//evil.com` |
| `/dashboard` | `/dashboard` |

None of these is in the malicious list of `safe-next.test.ts:16-35`, and the "never returns anything but a single-slash path" test (`:41-50`) iterates only that list plus `/%2F%2Fevil.com`, `/%5Cevil.com`, `/a/../../b`, so it does not catch this. Its assertion `out.startsWith('//') === false` would fail for the inputs above.

Impact and reach, from tracing the call sites:

- `login-form.tsx:58` passes the result to `router.push`. A link such as `/login?next=/..//evil.com` makes a successful sign-in navigate to `//evil.com`. A protocol-relative URL is cross-origin, so the App Router is expected to perform a hard navigation to the other site; that behaviour is framework behaviour, not verified here (no `node_modules`). This is an open redirect after authentication, the classic phishing aid ("sign in to KNEST, then land on a lookalike").
- Server paths are protected by a second pass: every later consumer calls `safeNext` again on the already-normalised `//evil.com`, which now fails the `raw[1] === '/'` check and returns `null`. So the e-mail link, the Google start route and onboarding completion do not follow it. The login form is the single exposed sink because it uses the first-pass result directly.
- The Google start route passes `redirectTo` to Auth.js; whether Auth.js's redirect callback rejects a `//host` value was not determined from the code.

Recommended fix (not applied; documentation-only task): after parsing, require `/^\/(?!\/)/.test(url.pathname)` or compare `url.pathname.startsWith('//')` and return `null`; add the four inputs above to the malicious list of the test. Sensible hardening in the same change: have `login-form.tsx` accept only the already-trusted value (it already does) and add the test to `tests/integration/30-auth-and-redirects.test.ts`.

## 4. Other return-path gaps

1. The forgot-password link carries the return path: `login-form.tsx:117-119` links to `/reset?next=<next>`. The reset request, reset form and reset confirm components read no `next` (no `next` identifier in `reset-form.tsx`, `reset/page.tsx` or `reset-confirm-form.tsx`), and `reset-confirm-form.tsx:36` ends at a bare `router.push('/login')`. The path is silently dropped.
2. `application-form.tsx:131` sends `verify-required` to `/verify?next=...`; `verify/page.tsx:9-14` reads only `sent` and `email` (see E5.03 item 2).
3. The `Cookie`-less flows rely on the query string, so `next` is visible in logs and the `Referer` header sent to third parties from the login page (Turnstile and Google). `Referrer-Policy: strict-origin-when-cross-origin` (`next.config.ts:80`) limits cross-origin referrers to the origin, which covers this.
4. `onboardingReturnPath` rejects `/onboarding*` (`destination.ts:34`) but `verify-confirm.tsx:32-36` handles an `/onboarding` prefix itself by passing it straight through; both agree today.
