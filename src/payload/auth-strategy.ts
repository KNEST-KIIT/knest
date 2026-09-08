import { eq, sql } from 'drizzle-orm'
import type { AuthStrategy } from 'payload'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { auth } from '@/server/auth'

/**
 * Keeps `cms.staff` in step with the staff subset of `app.users`.
 *
 * Written as raw SQL because the collection is Payload's and has no Drizzle
 * schema, and because Payload's own create/update are deliberately disabled on
 * it — the admin must never become a second place to mint accounts. This is a
 * mirror write, not an account write: id, email, name and role all come
 * straight from `app.users` and are refreshed on conflict, so a rename or a
 * role change follows the source of truth rather than drifting from it.
 */
async function mirrorStaffRow(row: {
  id: string
  email: string
  name: string | null
  staffRole: string | null
}) {
  await db.execute(sql`
    insert into cms.staff (id, email, name, staff_role, created_at, updated_at)
    values (${row.id}, ${row.email}, ${row.name}, ${row.staffRole}, now(), now())
    on conflict (id) do update set
      email = excluded.email,
      name = excluded.name,
      staff_role = excluded.staff_role,
      updated_at = now()
  `)
}

/**
 * Bridges Auth.js → Payload admin (the one genuinely risky decision in this
 * architecture, proved out in Phase 0a before anything was built on it).
 *
 * Payload normally owns its own users collection and login form. That would
 * give KNEST two account systems and two login screens for the same person.
 * Instead this strategy hands Payload the already-authenticated Auth.js user,
 * so there is one account and one login (spec §08).
 *
 * Payload calls this on every admin request. Returning `{ user: null }` makes
 * Payload treat the request as anonymous, which its own access control then
 * refuses — so a student who guesses the URL gets nothing even if the route
 * layer were somehow bypassed. Authorization is enforced here on the server,
 * never in the admin UI (spec §31).
 */
export const authJsStrategy: AuthStrategy = {
  name: 'authjs',
  authenticate: async ({ payload }) => {
    const session = await auth()
    if (!session?.user?.id) return { user: null }

    const row = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        email: true,
        name: true,
        staffRole: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Non-staff and disabled accounts are anonymous to Payload. The staffRole
    // is re-read from the database here rather than trusted from the session
    // payload, so revoking staff access takes effect on the next request.
    if (!row || !row.isActive || !row.staffRole) return { user: null }

    // The mirror row has to exist before Payload writes anything keyed to this
    // user. `cms.payload_preferences_rels.staff_id` and
    // `cms.payload_locked_documents_rels.staff_id` both carry a foreign key to
    // `cms.staff`, and Payload saves a preference the moment a collection list
    // view is opened — so with `cms.staff` empty, that insert failed and every
    // list view in the CMS rendered blank. The dashboard survived only because
    // it writes no preference.
    //
    // `app.users` stays the source of truth and every write is still disabled
    // on the collection itself; this keeps the mirror it was always described
    // as being. Doing it here rather than in the seed means an account
    // promoted to staff later works on its next request instead of needing a
    // reseed. It is one statement that no-ops once the row exists.
    await mirrorStaffRow(row)

    // Payload's generated Staff type requires these timestamps. They are the
    // real ones from app.users rather than placeholders, so anything Payload
    // displays about this account is accurate.
    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        staffRole: row.staffRole,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        collection: 'staff',
        _strategy: 'authjs',
      },
    }
  },
}
