# 04. Single-use tokens, input schemas, timing-equalising hash, safe redirect

Files: `src/server/auth/tokens.ts`, `validation.ts`, `dummy-hash.ts`, `src/lib/safe-next.ts`, `src/lib/site-url.ts`.

## Single-use tokens (`tokens.ts`)

Purpose: e-mail verification and password reset links, stored in the table Auth.js already defines (`verification_tokens`) so there is one mechanism rather than a second token table.

### Public interface

| Function | Line | Signature | Behaviour |
|---|---|---|---|
| `hashToken` | `:27-29` | `(token: string) => string` | SHA-256 of the UTF-8 token, hex |
| `issueToken` | `:31-43` | `(purpose: 'verify-email' \| 'reset-password', email: string, ttlMs: number) => Promise<string>` | Returns the raw token (64 hex characters from 32 random bytes); stores only the digest |
| `consumeToken` | `:50-59` | `(purpose, email, token, client = db) => Promise<boolean>` | Deletes the matching row; true when a row was deleted and its `expires` is in the future |

### Data

Row: `identifier = "<purpose>:<email>"`, `token = sha256(raw)`, `expires`. Composite PK `(identifier, token)` (`users.ts:131`).

### Design reasons and security properties

| Property | How | Limit |
|---|---|---|
| Purpose binding | The purpose is part of `identifier`, so a verification token cannot reset a password even though both share the table (`:11-13`, test `28:110`) | Binding is to the purpose string and the e-mail; not to a user id. If a user's e-mail were changed, outstanding tokens would not follow it. No code in scope changes e-mail |
| No plaintext at rest in this table | Only the digest is stored (`:15-18`). A 256-bit random token needs no salt or slow hash | The raw link also exists in `email_outbox.body` until the message is sent or, for dead rows, up to seven days (file 09). A copy of both tables defeats the hashing during that window |
| Single use under concurrency | `DELETE ... WHERE identifier AND token RETURNING expires` is atomic; of two simultaneous requests one gets the row (`:45-49`, tests `28:93`, `28:123`) | |
| Expiry | Checked after deletion: `row.expires > now` (`:58`). An expired token is consumed (deleted) by the failing attempt | Expired rows that are never presented stay in the table until a new token for the same identifier replaces them (no purge job) |
| One outstanding link per purpose and address | `issueToken` deletes existing rows for the identifier before inserting (`:35-38`) | Two statements, no transaction: two concurrent requests can each delete then insert and leave two valid tokens; a failure between them leaves none. Low impact; D-07 |
| Transactional consume | `consumeToken` accepts a transaction client (`Pick<typeof db,'delete'>`), so reset and verify consume inside the same transaction as their update (`actions.ts:124`, `:174`) | |

### Lifetimes

Constants in `actions.ts:20-21`: verification 24 hours, reset 1 hour. The e-mail templates state the same numbers (`templates.ts:13`, `:20`).

### Operational note

A token is not bound to the session or device that requested it; whoever holds the link can use it. The reset link carries `email` and `token` in the query string, so it can appear in the access logs of any proxy that logs query strings and in the browser history. `next.config.ts` sets `Referrer-Policy: strict-origin-when-cross-origin` (`:80`), which keeps the full URL out of cross-origin Referer headers.

## Input schemas (`validation.ts`)

| Schema | Rule | Why |
|---|---|---|
| `emailSchema` (`:3`) | `string().trim().toLowerCase().email().max(254)` | Normalises before lookup and before token identifier construction; 254 is the practical maximum for an address. Zod's `email()` is the validator; stricter or looser than RFC is Zod's choice |
| `passwordSchema` (`:9-15`) | min 12, max 200 characters, and at most 72 UTF-8 bytes | Length over composition rules. The byte cap exists because bcrypt reads only the first 72 bytes: without it a longer password is silently truncated and the person believes characters protect the account that do not. Counted in bytes, so a multi-byte passphrase hits the cap sooner (test `validation.test.ts:12`) |
| `credentialsSchema` (`:17-20`) | email; password min 1, max 200 | Looser than `passwordSchema` on purpose so accounts created under the older 200-character rule are never locked out (`validation.test.ts:18`) |
| `signupSchema` (`:22-26`) | email, `passwordSchema`, `name` trimmed 1 to 120 | |

Error messages are user-facing copy and are identical regardless of whether the address exists.

Note on `max(200)` plus the byte rule: for ASCII the byte rule binds first, so the effective maximum for new passwords is 72 characters.

## Timing-equalising hash (`dummy-hash.ts`)

`DUMMY_HASH` is a valid 60-character `$2b$12$...` string of a discarded random value. `loginWithPassword` compares the candidate against it when no user or no `password_hash` exists (`actions.ts:34`). A malformed hash makes bcryptjs return immediately, which is what made unknown addresses about 700 ms faster before KN-22a (`dummy-hash.ts:3-7`). Tests: `dummy-hash.test.ts` (well-formed, cost 12, does real work) and the timing test `30-auth-and-redirects.test.ts:115-143` (median unknown must be between 0.6 and 1.7 times known).

Limit: the cost factor of `DUMMY_HASH` must be kept equal to the cost passed to `hash(..., 12)` in `actions.ts:66` and `:172`. Changing one without the other reintroduces a timing difference. Accounts hashed at another cost are not rehashed on login (no rehash-on-login code exists).

Scope of the equalisation: login only. The reset-request and verification-send endpoints have a different, unequalised timing signal (D-04).

## Safe redirect (`src/lib/safe-next.ts`)

`safeNext(raw: string | null | undefined): string | null` (`:20-37`) returns a same-origin path (path, query, hash) or null; the caller supplies its own default.

Rejected: non-strings, empty, longer than 2048; not starting with `/`; starting with `//`; containing a backslash anywhere (`/\evil.com` is read as `//evil.com`); containing any character at or below 0x20 or DEL (a tab inside `/\t/evil.com` would be stripped by a browser into `//evil.com`); and any value whose resolution against the placeholder base `http://knest.invalid` changes origin.

Uses: `login-form.tsx:34`, `signup-form.tsx:16`, `google/start/route.ts:25`, `verify/confirm/page.tsx:30`, `actions.ts:64`. The value is validated at both ends of the e-mailed hop: when put in the verification link (`actions.ts:64`) and again when the confirm page renders (`verify/confirm/page.tsx:30`).

Tests: `src/lib/safe-next.test.ts` (accepts, a malicious list, never returns anything but a single-slash path) and a real-browser test of `router.push` in `30-auth-and-redirects.test.ts:54-66`.

`requireUser(returnTo)` in `guards.ts:36-43` builds `/login?next=<encoded returnTo>` from a caller-supplied path. The value is then validated on arrival at `/login` by `safeNext`; the guard itself does not validate `returnTo` and relies on callers passing their own route path.

## Site URL (`src/lib/site-url.ts`)

`siteUrl()` builds the origin placed in e-mailed links: `SITE_URL`, else `NEXT_PUBLIC_SITE_URL`, else Vercel variables, else `http://localhost:3000` (`:44-53`). `SITE_URL` is read at run time so one image can serve any address; `NEXT_PUBLIC_SITE_URL` is inlined at build. Failure mode: in a production process without either variable, links would point to localhost; `checkProductionEnv` refuses to boot a hosted production in that state (`env.ts:54-57`).
