# E5.03 Form submission and recovery

Scope: `src/lib/form-request.ts` and every client form under `src/app` and `src/components`. Tests: `src/lib/form-request.test.ts` (unit) and `tests/integration/35-accessibility.test.ts:240-259` (browser).

## 1. `formRequest`

`src/lib/form-request.ts:5-16` is the only transport helper. In full:

```
export async function formRequest(input, init) {
  const timeout = AbortSignal.timeout(30_000)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  try { return await fetch(input, { ...init, signal }) }
  catch { return Response.json({ error: '...couldn’t confirm that request...' }, { status: 503 }) }
}
```

Design intent (header comment, `:1-4`): forms already branch on HTTP status, so a transport failure is converted into the same shape so a dropped connection never leaves a control permanently busy; and a write is never retried automatically because the server may have committed it.

Behaviours that follow, and their constraints:

1. **A network failure and a real 503 are indistinguishable to callers.** Both arrive as `status: 503` with a JSON `error`. For an idempotent GET (the booking availability call, `booking-picker.tsx:46`) that is fine; for a POST the user must be told the outcome is unknown, which the copy does ("We couldn't confirm that request. Check your connection and try again."). It does not say "it may have gone through", so a user may resubmit an application answer or a registration. The server endpoints are expected to be idempotent for these writes (answers upsert by question; register/unregister are state toggles); that is a server property not verified here.
2. **30 second ceiling, no user cancel.** After 30 s the fetch aborts and the 503 path runs. There is no cancel button and no progress indication beyond the button label.
3. **`AbortSignal.any` is only reached when a caller passes `signal`.** No caller in `src` does (search for `signal:` finds only `lab-device/device-app.tsx:124`, which uses raw `fetch`). On a browser without `AbortSignal.any` the call would throw outside the `try`; the branch is dead today, but it is a latent bug if a caller ever passes a signal.
4. **The helper cannot see the response body failing.** `res.json()` is called by the callers and each wraps it in `.catch(() => ({}))` (for example `login-form.tsx:47`, `register-button.tsx:30`). A 200 with a non-JSON body is therefore treated as success with `data = {}`.
5. **No CSRF token is added.** Protection against cross-site posts depends on the server (same-origin cookie `SameSite=lax`, JSON `Content-Type`); see the security volume.
6. **No de-duplication.** Double-click protection is each form's own `pending` flag, set synchronously before `await`.

Tests: the unit tests assert the 503 shape, that a transport failure triggers exactly one `fetch` (no retry), that 401 and validation responses pass through untouched (same object identity), and that `AbortSignal.timeout(30_000)` is used (`form-request.test.ts:7-35`). The browser test aborts `/api/auth/password/login` and checks the `role="alert"` message, that the submit button re-enables and that the typed values survive (`35-accessibility.test.ts:240-259`).

## 2. Who bypasses it

Three client call sites use raw `fetch`:

| Site | Why it matters |
|---|---|
| `(auth)/verify/confirm/verify-confirm.tsx:12` | Has its own network and 5xx state with a retry button (`:20-23`, `:42-63`). No 30 s timeout, so a hung request leaves "Confirming..." forever. |
| `(public)/journey-selector.tsx:64-68` | Fire-and-forget analytics; `.catch(() => {})`. Acceptable. |
| `lab-device/device-app.tsx:124`, `pass-panel.tsx:83` | Offline-aware PWA with its own timeout (`AbortSignal.timeout(1500)`) and outbox. Out of scope here. |

## 3. Form inventory and shared pattern

All forms are client components posting JSON to `src/app/api/*`; none uses a Next Server Action or a native `<form action>` except the Google start button (`components/auth/google-button.tsx:10`, a real POST form to `/api/auth/google/start`, because Auth.js starts OAuth only on POST).

| Form | File | Transport | Success behaviour | Failure behaviour |
|---|---|---|---|---|
| Log in | `(auth)/login/login-form.tsx` | `formRequest` | `router.push(next ?? '/dashboard')` then `router.refresh()` (`:58-59`) | banner `role="alert"`, focus returns to email (`:49-55`), captcha reset |
| Sign up | `(auth)/signup/signup-form.tsx` | `formRequest` | `router.push('/verify?sent=1&email=...')` (`:56`) | same as login, focus to name |
| Reset request / confirm | `reset/reset-form.tsx`, `reset/confirm/reset-confirm-form.tsx` | `formRequest` | success panel replaces the form | banner |
| Contact | `(public)/contact/contact-form.tsx` | `formRequest` | form replaced by a `role="status"` panel (`:48-57`) | `role="alert"` paragraph (`:94-98`) |
| Application (per answer) | `apply/[program]/application-form.tsx` | `formRequest` | advance one step; "Saved" live message | error paragraph; 401 sends to `/login?next=` (`:72-75`) |
| Application submit | same | `formRequest` | `submitted` panel (`:140`) | `verify-required` code routes to `/verify` (`:130-133`) |
| Start application | `apply/[program]/start-application.tsx` | `formRequest` | `router.refresh()` so the server page re-evaluates (`:34`) | `role="alert"` |
| Onboarding steps | `onboarding/onboarding-flow.tsx` | `formRequest` via `postStep` | next step | error text; 401 hard-navigates to login with the current path (`:85-88`) |
| Event register/unregister | `events/[slug]/register-button.tsx` | `formRequest` | toggles label, `router.refresh()` | `role="alert"` text; 401 pushes to signup with `next` |
| Resend verification | `verify/resend-button.tsx` | `formRequest` | button replaced by "Sent. Check your inbox." | `role="alert"` |
| Mark notification read | `dashboard/notifications-list.tsx` | `formRequest` | row updates after server confirms, then `router.refresh()` | `role="alert"` with a 401-specific message |
| Log out | `components/layout/logout-button.tsx` | `formRequest` | wipes lab device caches, then `window.location.assign('/')` | inline `role="alert"` |
| Lab booking, staff controls, admin status, members, enquiries, mail | `lab-booking/*`, `lab-staff/*`, `admin/*` | `formRequest` | `router.refresh()` | per-component error text |

Common conventions (and where each is broken):

- `noValidate` plus `required` attributes: the browser never validates; all validation is server-side and returned as one string. Per-field error wiring exists in `Field` but is never used (see E5.11, defect D-14).
- `pending` disables the primary button and sets `aria-busy` where remembered; not uniform (`application-form.tsx:211` and `:329` do not set `aria-busy`; `contact-form.tsx:102` and `login-form.tsx:144` do).
- Turnstile gate: `captchaPending = Boolean(siteKey) && !captchaToken` disables submit (`login-form.tsx:19`, `contact-form.tsx:17`). The token is single-use, so every failed submit nulls it and bumps `resetSignal` (`login-form.tsx:52-53`). With no site key configured the widget renders nothing and the gate is open, which is the local-development mode.
- A successful submit navigates with `router.push` and then `router.refresh()` (login) or `router.refresh()` alone. `router.refresh()` re-runs server components for the current route and keeps client state; it is what makes `StartApplication` hand over to `ApplicationForm`.

## 4. Failure and recovery scenarios

| Scenario | Outcome | Evidence |
|---|---|---|
| Network drops during login | alert shown, button re-enabled, values retained, Turnstile re-issued | `login-form.tsx:49-55`, test `35-accessibility.test.ts:240-259` |
| Session expires mid-application | the answer POST returns 401, user is sent to `/login?next=<pathname>`; typed text on the current step is lost, previous answers are server-saved | `application-form.tsx:72-75`; note that `window.location.href` discards in-memory state |
| Session expires mid-onboarding | hard navigation to login with the current path and query, so the journey stage and `next` survive | `onboarding-flow.tsx:85-88` |
| Verification link request 5xx | "We couldn't confirm your email" with a retry button; 4xx shows "That link has expired" | `verify-confirm.tsx:20,42-78` |
| Turnstile script blocked | token stays null, submit stays disabled, no message and no retry | `turnstile-widget.tsx:59-79`; reported as finding 8 of the accessibility review and still open |
| Double submit of a captcha-protected form | second click is disabled while `pending` | per-form `disabled={pending || captchaPending}` |

## 5. Issues found while reading the forms

1. `application-form.tsx:231` labels the step header "Saved automatically". Nothing saves automatically: the answer is posted only on "Save & continue" (`:84-88`, `saveCurrent` at `:60-80`) and file uploads on selection (`uploadFile`, `:91-112`). Typed text is lost on reload or on the 401 redirect. The copy overstates the behaviour.
2. `application-form.tsx:130-131` sends `verify-required` to `/verify?next=<path>`, but `(auth)/verify/page.tsx:9-14` reads only `sent` and `email`; the return path is dropped, so after verifying the user lands on onboarding or the dashboard, not back in the application.
3. `login-form.tsx:145`, `signup-form.tsx:146`, `reset-form.tsx:109` hard-code `#5a141e` and `#8f2433` in a class string. The hardcode lint does not flag them (E5.09, section 4).
4. `login-form.tsx:127` and `signup-form.tsx:128` use `bg-red-50 border-red-200`, raw palette classes, again on a line that also contains `var(--...)` and so is exempt from the lint.
5. `contact-form.tsx:87-92`: the honeypot sits inside `aria-hidden="true"` yet contains a focusable `<input>` (`tabIndex={-1}`, so not reachable by Tab, but still focusable by script and by some assistive technology). It also uses a plain `<select>` styled with `--color-line-strong`, which is not defined (E5.09).
6. `register-button.tsx:30` parses JSON before checking status; for a 401 whose body is HTML the `catch` returns `{}`, which is handled. `setPending(false)` is called before `router.refresh()` completes, so the button briefly shows the new label before server data refreshes.
7. `logout-button.tsx:26` dynamically imports the lab wipe helper after the server logout succeeds; if the server call fails the cache is not wiped, and if the wipe fails the user is still logged out (by design, `:24-25`).
