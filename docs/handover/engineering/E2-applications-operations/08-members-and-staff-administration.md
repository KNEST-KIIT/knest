# 08. Members, staff roles and the admin overview

Module: `src/server/members/actions.ts` (107 lines), `queries.ts` (42), `src/server/admin/overview.ts` (52); routes `src/app/api/admin/members/[id]/active/route.ts` and `.../staff-role/route.ts`; pages `src/app/(staff)/admin/members/`, `overview/`, and the shell `src/app/(staff)/admin/layout.tsx`.

## 1. The two role axes

| Column | Values | Meaning | Written by |
|---|---|---|---|
| `users.platform_role` | student, founder, mentor, investor, alumni, partner, other | What the person says they are; selects dashboard variant and recommendation | Onboarding (self-asserted, file 05) |
| `users.staff_role` | `reviewer`, `content_admin`, `program_manager`, `startup_manager`, `mentor_manager`, `lab_admin`, `super_admin`, or NULL | Authority in the staff console | Only `setStaffRole` (this file) and seeds |

`staff_role` non-null is what grants `/admin` (`users.ts:36-37`). Area map in `src/server/auth/roles.ts:14-31`:

| Area | Roles besides `super_admin` |
|---|---|
| content | content_admin |
| programs | program_manager |
| applications | program_manager, reviewer |
| startups | startup_manager |
| mentors | mentor_manager |
| infrastructure | lab_admin |
| enquiries | content_admin |
| users, audit, settings, analytics, mail | none (super admin only) |

Roles are intentionally coarse (spec forbids a permission matrix in V1, `roles.ts:8-12`). Authority is re-read from the database on every session read (`auth/config.ts:50-83`), so a changed role takes effect on the next request even independent of session deletion.

## 2. Account deactivation: `setMemberActive(userId, isActive)`

`members/actions.ts:34-66`. Super admin only.

1. `requireStaffOrThrow('users')`; refuse when `userId === actor.id` ("You can't change your own account here.", `:36`).
2. Transaction:
   1. `pg_advisory_xact_lock(hashtext('knest:staff-membership'))` (`:41`). This single lock is shared with `setStaffRole`, so every change to who is an active super admin is serialised.
   2. Re-read the **actor** inside the lock: must still be active and `super_admin`, else "Your staff access changed. Sign in again." (`:42-43`). Authority is checked after the lock because the session-time check is stale by the time the lock is obtained.
   3. Read the target; missing: "We couldn't find that account."
   4. If deactivating a super admin and no other **active** super admin exists, refuse (`otherActiveSuperAdmins`, `:18-24,50-52`).
   5. `UPDATE users SET is_active, updated_at`; when deactivating, `DELETE FROM sessions WHERE user_id = target` (`:54-55`).
   6. Audit row `account_deactivated` or `account_reactivated`, `before {isActive}`, `after {isActive}` (`:56-63`).

Why the shared lock and re-read: two super admins removing each other concurrently would each see "the other one remains" and both succeed, locking everyone out of the console. Under the lock the second sees the first's committed change. Test `24-last-admin-concurrency.test.ts` runs both cross-removals concurrently for both operations and asserts exactly one succeeds and one active super admin remains.

Deactivation also takes effect through a second path: `activeOnly` wraps the session adapter, so any session read for an inactive user deletes the session and returns signed out (`src/server/auth/active-only-adapter.ts:14-27`). The explicit session delete in the transaction is belt and braces; a session created concurrently cannot survive.

Edge behaviours:

- Reactivating an account that is already active, or deactivating one already inactive, still performs the update and writes an audit row (no no-op check).
- Deactivating a non-super-admin never consults the last-admin rule.
- A deactivated person cannot sign in again (login path checks `is_active`) and reactivation does not resurrect old sessions (test `25-account-deactivation.test.ts:68`).
- Deactivation does not touch their applications, registrations or bookings.

## 3. Staff role changes: `setStaffRole(userId, role)`

`members/actions.ts:76-107`. Same preamble: `requireStaffOrThrow('users')`, no self-change (`:78`), same advisory lock, same actor re-read.

- If the target already has that role: return `{ ok:true }` with no write and no audit row (`:89`).
- If the target is currently `super_admin`, the new role is anything else (including NULL), and no other active super admin exists: refuse "That is the last active super admin" (`:91-93`).
- Otherwise update `staff_role`, **delete every session of the target** (`:96`) so a demotion cannot be outlived by a session minted under the old role, and insert audit row `staff_role_changed` (`before {staffRole}`, `after {staffRole}`).

Observations:

- Granting `super_admin` to a deactivated account is allowed; it will not count towards "active super admins" until reactivated, because the count requires `is_active`.
- Role change does not require the target to be verified or onboarded.
- The route validates the role with `isStaffRoleOrNull` against the DB enum values so an unknown string is a 400, not a 500 from the enum column (`staff-role/route.ts:13-17`, `actions.ts:10-15`).
- `ASSIGNABLE_STAFF_ROLES` is the enum itself; there is no way to make a role non-assignable without code change.

## 4. Routes

| Route | Body | Limiter | Validation | Success | Failure |
|---|---|---|---|---|---|
| `POST /api/admin/members/[id]/active` | `{ isActive: boolean }` | `staffAction` | `typeof isActive === 'boolean'` strictly (a truthy string must not reactivate, `active/route.ts:13-16`) | 200 | 400 error text; 401/403 as "Not permitted." |
| `POST /api/admin/members/[id]/staff-role` | `{ staffRole: string \| null }` | `staffAction` | `isStaffRoleOrNull` | 200 | same |

`staffAction`: 600 per hour per user (`rate-limit.ts:38`). Test `25-account-deactivation.test.ts:124-160` covers refusal of anonymous, reviewers and members, no self-change, strict input validation.

## 5. Member list: `listMembers(filters)`

`members/queries.ts:13-42`. Guard `requireAdminArea('users')`. Filters: `q` (ILIKE on e-mail or name, escaped), `staffOnly` (`staff_role IS NOT NULL`), `inactiveOnly`. Selects only `id, email, name, platform_role, staff_role, is_active, email_verified, created_at`: "enough to find a person and act on their account, none of the profile text" and in particular never the password hash (the column is not in the select list; `32-staff-console.test.ts:93` separately checks hashes are absent from reviewer queue responses). Order `created_at DESC, id DESC`; 25 per page; separate count query.

The UI (`members/page.tsx`, `member-actions.tsx`) shows a role select plus Apply, and Deactivate/Reactivate; controls are disabled on the caller's own row (`member-actions.tsx:53,65,73`) but the server also refuses (defence in depth). After a change `router.refresh()` is called.

## 6. Overview: `getOverview(role)`

`src/server/admin/overview.ts:17-52`. Returns an object that contains a figure **only** when the role may open the screen behind it ("left out, not zeroed", `:11`):

| Figure | Area gate | Query |
|---|---|---|
| `applicationsAwaitingReview` | applications | `status = 'submitted'` |
| `applicationsInProgress` | applications | status in `under_review, shortlisted, interview, waitlisted` |
| `newEnquiries` | enquiries | `status = 'new'` |
| `activeMembers`, `inactiveMembers` | users | counts by `is_active` |
| `recentActions` | audit | latest 5 audit rows, inner-joined to the actor's e-mail |

The page (`overview/page.tsx`) passes `staff.staffRole` from the session. Roles with no figures see a note pointing to the full CMS admin (`:44-48`). Counts are live queries; there is no caching. The `recentActions` join is an inner join on `users`; actor rows cannot be orphaned because `audit_logs.actor_user_id` is `ON DELETE RESTRICT` (file 09).

Test `32-staff-console.test.ts:212`: counts equal database contents and each role sees only its figures.

## 7. The staff shell

`(staff)/admin/layout.tsx:28-63`: `requireStaff()` (404 for non-staff); navigation items are filtered by `canAccessArea`, and the Labs link additionally by the `isLabBookingEnabled()` feature flag (`:31`). Hiding a link is presentation; each area's layout repeats `requireAdminArea` (applications, enquiries, members, audit, analytics, and likewise the others), which is the real gate. A layout-level check gives a real 404 status before streaming (comment at `applications/layout.tsx`).

## 8. Limitations

- No UI or API to delete an account, anonymise data or export a member's data was found in these modules.
- No notification is sent to a person whose account is deactivated or whose role changes.
- Audit rows are the only record of who granted a role; there is no separate role history table.
- The advisory lock key space is `hashtext` (32-bit): it is a shared lock name with a negligible collision chance, but a collision would merely over-serialise.
