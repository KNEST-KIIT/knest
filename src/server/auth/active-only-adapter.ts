import type { Adapter } from 'next-auth/adapters'

/**
 * Makes a deactivated account unable to hold a session (KN-10).
 *
 * `isActive` used to be checked only at password login and in the Payload
 * bridge, so a deactivated person kept every session they already had (up to 30
 * days) and Google sign-in ignored it. Every session read, whichever code asks
 * for it (`auth()`, the guards, the Payload strategy, /api/auth/session), goes
 * through the adapter's `getSessionAndUser`, so the check lives there: if the
 * user is inactive or no longer exists, the session row is deleted and the
 * request is treated as signed out.
 */
export function activeOnly(
  adapter: Adapter,
  isActive: (userId: string) => Promise<boolean>,
): Adapter {
  return {
    ...adapter,
    async getSessionAndUser(sessionToken) {
      const found = await adapter.getSessionAndUser?.(sessionToken)
      if (!found) return found ?? null
      if (await isActive(found.user.id)) return found
      await adapter.deleteSession?.(sessionToken)
      return null
    },
  }
}
