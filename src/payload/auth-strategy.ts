import { eq } from 'drizzle-orm'
import type { AuthStrategy } from 'payload'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { auth } from '@/server/auth'

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
