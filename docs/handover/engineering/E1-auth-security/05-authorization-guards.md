# 05. Authorization: guards, staff areas, Payload bridge

Files: `src/server/auth/guards.ts`, `roles.ts`, `src/payload/auth-strategy.ts`, `src/server/members/actions.ts`.

## Rule

Every server action, route handler and protected page calls one of the guards as its first statement. Role checks inside components decide what to render; they are never what keeps anyone out (`guards.ts:8-15`, citing spec section 31).

## Guard catalogue (`guards.ts`)

`SessionUser = Session['user']`, which is the object built by the `session` callback (file 02).

| Guard | Line | Returns | On failure | Use |
|---|---|---|---|---|
| `getSessionUser()` | `:17-33` | `SessionUser \| null` | null; fails closed on any lookup error | Optional-auth pages and routes |
| `requireUser(returnTo?)` | `:36-43` | `SessionUser` | `redirect('/login[?next=...]')` | Pages |
| `requireOnboardedUser(returnTo?)` | `:50-54` | `SessionUser` | not signed in: login; not onboarded: `redirect('/onboarding')` | Member pages that need a profile |
| `requirePlatformRole(...roles)` | `:56-62` | `SessionUser` | login redirect, or `notFound()` when the role is not listed | Role-restricted member pages |
| `requireStaff()` | `:68-72` | user with non-null `staffRole` | `notFound()` (404) | Admin shell |
| `requireAdminArea(area)` | `:74-80` | staff user | `notFound()` | Admin sections |
| `UnauthorizedError(status = 401 \| 403)` | `:86-91` | n/a | thrown | Route handlers and server functions that need a value back |
| `requireUserOrThrow()` | `:93-97` | `SessionUser` | throws `UnauthorizedError(401)` | Route handlers |
| `requireSelf(userId)` | `:100-104` | `SessionUser` | 401 if anonymous, `UnauthorizedError(403)` if ids differ, even for staff | Private reads: `listNotificationsForUser`, `countUnread` |
| `requireStaffOrThrow(area?)` | `:106-113` | staff user | 401 anonymous; 403 non-staff or wrong area | Admin routes and data functions |

### Design reasons

- **404, not 403, for staff areas.** Confirming that `/admin` exists tells an attacker where to point effort (`guards.ts:64-67`). The route-handler variants (`requireStaffOrThrow`) do answer 403 because an API consumer has already found the route.
- **`requireSelf` rejects staff too.** Private reads derive authority from the session, never from a caller-supplied id (`guards.ts:99`; test `guards.test.ts:19`: another user is rejected "even when they are staff").
- **Fail closed, no development bypass.** A lookup failure returns null in every environment. A development mock user used to be returned here and was "one NODE_ENV misconfiguration away from a bypass" (`guards.ts:26-29`). Tests loop over several `NODE_ENV` values (`guards.test.ts:30-41`).
- **Control-flow exceptions pass through.** `unstable_rethrow(error)` before the catch-all (`guards.ts:25`) lets Next's dynamic-rendering signal, `redirect` and `notFound` reach the framework; otherwise a page reading the session would be prerendered as signed-out (test `guards.test.ts:42`).

### Handling `UnauthorizedError`

Routes translate it to JSON with the carried status. Examples: `src/app/api/admin/members/[id]/active/route.ts:22-26` ("Not permitted."), `src/app/api/notifications/[id]/read/route.ts:15-18` ("Sign in to continue."). Re-throwing everything else lets Next produce a generic 500 without detail.

## Admin areas (`roles.ts`)

`ADMIN_AREAS` maps area to the staff roles allowed (`roles.ts:14-31`). `super_admin` is absent from every list because `canAccessArea` passes it unconditionally (`:35-39`).

| Area | Roles besides super_admin |
|---|---|
| `content` | `content_admin` |
| `programs` | `program_manager` |
| `applications` | `program_manager`, `reviewer` |
| `startups` | `startup_manager` |
| `mentors` | `mentor_manager` |
| `infrastructure` | `lab_admin` |
| `enquiries` | `content_admin` |
| `users`, `audit`, `settings`, `analytics`, `mail` | none: super_admin only |

The design is deliberately coarse; V1 forbids a granular permission matrix (`roles.ts:10-12`). The staff-role enum lives in `src/db/schema/enums.ts`; `roles.test.ts:16` asserts that the test file lists every enum value, because `lab_admin` was once missing (NF-11). A new staff role requires a new migration, an `ADMIN_AREAS` decision, and an update to that test.

## Payload bridge (`src/payload/auth-strategy.ts`)

Payload calls `authenticate` on every admin request (`:22-25`).

1. `auth()` for the Auth.js session; no user id returns `{ user: null }` (anonymous to Payload).
2. Re-read the user row: `id, email, name, staffRole, isActive, createdAt, updatedAt` (`:28-39`).
3. No row, inactive, or no staff role: `{ user: null }` (`:44`). The role is re-read here rather than trusted from the session payload, so revocation is effective on the next request.
4. Upsert a shadow row into `cms.staff` by raw SQL (`:50-61`) because Payload's preferences and relations need a real row for foreign keys; a failure is logged and swallowed (`:62-64`).
5. Return a Payload user object with `collection: 'staff'`, `_strategy: 'authjs'` (`:67-78`).

Consequences: the shadow table is written on every admin request (one upsert each); the failure path silently continues, so a broken shadow write would surface later as foreign-key errors in Payload rather than as an authentication failure. Payload collection-level access functions (`src/payload/access.ts`) are outside this volume.

## Last super admin and self-protection

`setMemberActive` and `setStaffRole` (file 03) refuse self-changes, refuse removing the last active super admin, take a shared advisory lock, and re-check the acting user's own authority inside the transaction. The re-check matters because the actor's authority was established by a guard earlier in the request; a concurrent change could have removed it in between (`members/actions.ts:42-43`, `:82-83`: "Your staff access changed. Sign in again.").

## Limits

- Guards depend on `auth()`; there is no second source of truth. A bug in the `session` callback is a bug in every guard.
- No second factor for staff. Staff sign in with the same password mechanism as students (SECURITY-REVIEW S-13, open decision).
- Staff sessions use the same 30-day lifetime as members (SECURITY-REVIEW S-10 suggests a shorter staff lifetime; not implemented).
- No re-authentication step before sensitive admin actions (deactivation, role change). Not present in the code read.
