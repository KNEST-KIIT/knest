import type { CollectionConfig } from 'payload'
import { isStaff, type StaffRole } from '@/server/auth/roles'
import { authJsStrategy } from '../auth-strategy'

/** Payload types `req.user` loosely; this reads our own field off it safely. */
function staffRoleOf(user: unknown): StaffRole | null {
  const role = (user as { staffRole?: unknown } | null | undefined)?.staffRole
  return typeof role === 'string' ? (role as StaffRole) : null
}

/**
 * A read-only mirror of the staff subset of `app.users`, existing only because
 * Payload requires an auth-enabled collection to hang `admin.user` off.
 *
 * It is NOT the source of truth. Accounts live in `app.users` (spec §32) and are
 * created through the platform's own signup, so every write is disabled here:
 * Payload's admin must never become a second place where user records can be
 * minted or roles edited.
 */
export const Staff: CollectionConfig = {
  slug: 'staff',
  auth: {
    // Removes Payload's own email/password login entirely, so the Auth.js
    // session below is the only way in — there is no second login form.
    disableLocalStrategy: true,
    strategies: [authJsStrategy],
  },
  admin: { hidden: true, useAsTitle: 'email' },
  access: {
    read: ({ req }) => isStaff(staffRoleOf(req.user)),
    create: () => false,
    update: () => false,
    delete: () => false,
    admin: ({ req }) => isStaff(staffRoleOf(req.user)),
  },
  fields: [
    // A custom text id so this mirror matches app.users, whose ids are UUIDs.
    // Payload would otherwise default to a numeric id and the auth strategy
    // could not return a real user id at all.
    { name: 'id', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text' },
    { name: 'staffRole', type: 'text' },
  ],
}
