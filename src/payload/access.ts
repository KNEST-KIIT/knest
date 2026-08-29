import type { Access, FieldAccess } from 'payload'
import { canAccessArea, type AdminArea, type StaffRole } from '@/server/auth/roles'

/** Payload types req.user loosely; this reads our own field off it safely. */
export function roleOf(user: unknown): StaffRole | null {
  const role = (user as { staffRole?: unknown } | null | undefined)?.staffRole
  return typeof role === 'string' ? (role as StaffRole) : null
}

/**
 * Access control for CMS collections.
 *
 * Read is public for published content because these collections ARE the public
 * website. Writing is confined to the staff role that owns that area (spec §24),
 * enforced by Payload on the server for both the admin UI and the REST API —
 * hiding a sidebar item would not stop a direct API call.
 */
export const canWrite =
  (area: AdminArea): Access =>
  ({ req }) =>
    canAccessArea(roleOf(req.user), area)

export const canWriteField =
  (area: AdminArea): FieldAccess =>
  ({ req }) =>
    canAccessArea(roleOf(req.user), area)

/**
 * Anonymous visitors see only published documents; staff see drafts too, so the
 * admin can preview work in progress without exposing it.
 */
export const readPublished: Access = ({ req }) => {
  if (roleOf(req.user)) return true
  return { _status: { equals: 'published' } }
}

export const isAnyStaff: Access = ({ req }) => roleOf(req.user) !== null

/**
 * Public read for collections that have no draft/publish concept at all
 * (Cohorts, Testimonials, FAQs, Metrics). `readPublished` filters on
 * `_status`, which only exists on collections with `versions.drafts` enabled —
 * applying it to one of these throws "Cannot find field for path at _status"
 * the moment anything queries or relates to them.
 */
export const readAlways: Access = () => true
