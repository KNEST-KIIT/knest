# 02. Sessions and the Auth.js layer

Files: `src/server/auth/index.ts`, `config.ts`, `session.ts`, `active-only-adapter.ts`, `providers.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/google/start/route.ts`. Library versions from `package.json`: `next-auth` 5.0.0-beta.32, `@auth/drizzle-adapter` ^1.11.3, `next` 16.4.0. The Auth.js internals (cookie refresh, CSRF cookie, OAuth state handling) live in `node_modules` and were not read for this volume; statements about them are marked.

## Public interface

| Symbol | File:line | Signature | Purpose |
|---|---|---|---|
| `handlers`, `auth`, `signIn`, `signOut` | `index.ts:4` | `NextAuth(authConfig)` result | `auth()` reads the session for every guard; `handlers` is mounted at `/api/auth/*` (`[...nextauth]/route.ts:3`); `signIn` is used by the Google start route |
| `authConfig` | `config.ts:9-78` | `NextAuthConfig` | Adapter, strategy, pages, providers, callbacks |
| `activeOnly` | `active-only-adapter.ts:14-28` | `(adapter: Adapter, isActive: (userId: string) => Promise<boolean>) => Adapter` | Wraps the adapter so an inactive or missing user has no session |
| `sessionCookieName` | `session.ts:38-42` | `() => string` | `__Secure-authjs.session-token` or `authjs.session-token` |
| `createDatabaseSession` | `session.ts:44-60` | `(userId: string) => Promise<void>` | Insert session row and set cookie |
| `destroyDatabaseSession` | `session.ts:63-70` | `() => Promise<void>` | Delete row for the presented cookie, delete cookie |
| `revokeAllSessions` | `session.ts:73-75` | `(userId: string) => Promise<void>` | Delete every session row of a user. Exported but not called anywhere in `src` (file 13, L-05) |
| `googleConfigured`, `authProviders` | `providers.ts:11-24` | `(env?) => boolean`, `(env?) => Provider[]` | Single decision point for whether Google is on |

## Configuration (`config.ts`)

| Setting | Value | Why |
|---|---|---|
| `adapter` | `activeOnly(DrizzleAdapter(db, {usersTable, accountsTable, sessionsTable, verificationTokensTable}), isActive)` (`config.ts:12-23`) | Drizzle tables are the ones in `src/db/schema/users.ts`; the wrapper makes deactivation effective on sessions that already exist (KN-10) |
| `session` | `{ strategy: 'database', maxAge: 30 * 24 * 60 * 60 }` (`config.ts:26`) | 30 days; same constant is duplicated in `session.ts:22` |
| `pages` | `signIn: '/login'`, `verifyRequest: '/verify'`, `error: '/login'` (`config.ts:27`) | Auth.js never renders its own pages; errors arrive on `/login?error=<code>` |
| `providers` | `authProviders()` (`config.ts:31`) | Empty list unless both Google variables are set |

### Callbacks

**`signIn({ user })`** (`config.ts:34-38`). Returns true when `user.email` is absent; otherwise looks the user up by e-mail and returns `row.isActive` if the row exists, true if it does not (a brand-new Google user). Effect: a deactivated person cannot start a new Google session. Existing sessions are handled by the adapter wrapper.

**`session({ session, user })`** (`config.ts:49-76`). Re-reads the user row (`email, name, image, platformRole, staffRole, onboardingCompletedAt, journeyStage`) and returns an explicitly built object:

```
{ expires, user: { id, email, name, image, platformRole, staffRole,
                   onboardingComplete: boolean, journeyStage } }
```

Two properties matter:

1. Roles come from the database on every session read, so a demotion takes effect on the next request even though the session row is still valid.
2. The object is constructed field by field, not spread from the adapter's session. With the database strategy that session carries `sessionToken`; spreading it would publish the cookie secret through `/api/auth/session`, defeating `httpOnly`. This is stated in the comment at `config.ts:43-48`.

If the user row is missing the callback falls back to `platformRole: 'student'`, `staffRole: null` (`config.ts:67-72`). That fallback cannot normally be reached because `activeOnly` deletes the session first when the row is gone.

## Session creation for password sign-in (`session.ts:44-60`)

1. `sessionToken = randomBytes(32).toString('hex')` (256 bits, 64 hex characters).
2. `expires = now + 30 days`.
3. `INSERT INTO sessions (session_token, user_id, expires)`.
4. `cookies().set(sessionCookieName(), token, { httpOnly: true, sameSite: 'lax', path: '/', secure, expires })`.

Order matters: the row is written before the cookie, so a cookie never references a row that does not exist. The reverse failure (row written, cookie not set) leaves an orphan row that expires unused.

No existing session for the browser is deleted on sign-in. A new token replaces the cookie value; the previous row remains until it expires or the user is revoked. The token is server-generated, so fixation is not possible.

### Cookie name and the `Secure` flag

`sessionCookieName()` (`session.ts:38-42`) takes the protocol of `AUTH_URL` (falling back to `NEXTAUTH_URL`), and only when neither is set falls back to `NODE_ENV === 'production'`. The comment (`session.ts:24-37`) records why: Auth.js decides `useSecureCookies` from the URL protocol, not from `NODE_ENV`. A mismatch between the cookie our code sets and the name Auth.js looks for makes `auth()` return null and login silently fails. The same expression is repeated inline in `createDatabaseSession` (`session.ts:51-52`) for the `secure` attribute; keep the two in step.

Operational rule: `AUTH_URL` must be the public https origin in production. `env.ts:70-73` enforces presence and origin equality with `SITE_URL` for hosted production, and `infra/cfn/app.yaml` writes `AUTH_URL=${SITE_URL}` (`app.yaml:578`).

## Session read path

```
auth()                                        (guards.getSessionUser)
  -> Auth.js reads cookie `sessionCookieName()`
  -> adapter.getSessionAndUser(token)         (activeOnly wrapper)
        DrizzleAdapter: join sessions/users, ignoring expiry handling per Auth.js
        isActive(user.id): SELECT is_active FROM users WHERE id = ...
        inactive or missing  -> adapter.deleteSession(token); return null
  -> session callback: SELECT profile columns FROM users WHERE id = ...
  -> { user, expires }
```

Expiry comparison and the sliding refresh (`updateAge`) are Auth.js behaviour. Whether and when the `expires` column is extended on activity was not determined from the repository code; the Auth.js default would apply because `config.ts` sets only `maxAge`.

## Deactivation semantics (KN-10)

Before KN-10 `isActive` was checked only at password login, so a deactivated person kept every session for up to 30 days and Google sign-in ignored the flag (`active-only-adapter.ts:3-12`). Now there are four independent enforcement points:

| Point | File:line | Effect |
|---|---|---|
| Password login | `actions.ts:36` | Same generic failure message as a bad password |
| Session read | `active-only-adapter.ts:20-26` | Row deleted, request treated as signed out |
| Google `signIn` callback | `config.ts:34-38` | New Google session refused |
| Payload bridge | `src/payload/auth-strategy.ts:44` | Anonymous to Payload |

In addition `setMemberActive` deletes all session rows in the same transaction (`members/actions.ts:55`). The adapter check exists so that a session created concurrently with the deactivation transaction cannot survive (comment at `members/actions.ts:29-33`). Reactivation does not resurrect old sessions because the rows were deleted (integration test `25-account-deactivation.test.ts:68`).

Cost of the design: one extra `SELECT is_active` on every session read, on top of the profile read in the `session` callback. Both could be one query; they are not.

## Log-out (`session.ts:63-70`, `route.ts`)

`POST /api/auth/password/logout` calls `logout()` which reads the cookie, deletes the matching row, and deletes the cookie. A request with no cookie succeeds without effect. The route has no rate limit and needs no session (`src/app/api/auth/password/logout/route.ts:4-7`). It is protected from cross-site calls only by the origin check in file 06. The Auth.js `/api/auth/signout` route is also mounted but the application UI uses the password logout route (`src/components/layout/logout-button.tsx:18`).

## Google sign-in

Enablement (`providers.ts:11-24`). `googleConfigured` is true only when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are non-blank after trim. The login page, signup page, start route and provider list all call this one function, so they cannot disagree. `AUTH_GOOGLE_ISSUER` redirects OIDC discovery to another server and exists for the test suite; the file says to leave it unset in every real environment (`providers.ts:15-19`).

Start route (`src/app/api/auth/google/start/route.ts:15-36`):

1. `limitByIp(request, 'login', 'google')` uses bucket key `login:<ip>:google`, a separate bucket from password attempts (`:18-20`). Over limit: 303 to `/login?error=TooManyAttempts`.
2. Not configured: 303 to `/login?error=GoogleUnavailable`.
3. Read `next` from the form body, validate with `safeNext`.
4. `signIn('google', { redirectTo: next ?? '/dashboard', redirect: false })` returns Google's authorisation URL; the route answers 303 to it. 303 rather than 307 so the browser follows with GET.
5. Any exception: log `google_signin_start_failed <error name>` and 303 to `GoogleUnavailable`.

The route answers with redirects, not JSON, because the Google button is a plain HTML form POST. There is no Turnstile check on this route. The login page maps the `error` query value to a message (`login-form.tsx:20-32`): `AccessDenied` (what Auth.js sends when the `signIn` callback returns false) reads "This account can't sign in"; anything else reads "Google sign-in didn't finish".

Account linking. `allowDangerousEmailAccountLinking` is not set in `config.ts`. By Auth.js default, a Google sign-in whose e-mail matches an existing user that has no linked Google account is refused (`OAuthAccountNotLinked`), which the login page shows as the generic "didn't finish" message. That default is Auth.js behaviour and was not re-verified in `node_modules`; the integration test `46-google-enabled.test.ts` exercises a stubbed provider but its titles do not cover this case. A password user who later tries Google with the same address therefore has to keep using the password. Not determined from the code: whether `emailVerified` is populated for a new Google user (that is set by Auth.js core and the adapter's `createUser`).

Google-created accounts have `password_hash = NULL`, so the reset flow does nothing for them (`actions.ts:146`) and password login fails against the dummy hash.

## Failure modes

| Failure | Behaviour |
|---|---|
| Database down during `auth()` | `getSessionUser` logs `[auth] session lookup failed; treating request as signed out` and returns null (`guards.ts:21-31`). Fail closed. `redirect` and `notFound` control-flow exceptions are rethrown via `unstable_rethrow` so dynamic rendering still works (`guards.ts:25`) |
| Cookie set but `AUTH_URL` scheme differs from the deployment | `auth()` returns null for every request; login appears to succeed then redirects back (see cookie name section) |
| `AUTH_SECRET` missing in production | Refused at boot by `checkProductionEnv` (`env.ts:21`). How Auth.js uses it internally (CSRF and OAuth state cookies) was not read; the session cookie value itself does not depend on it |
