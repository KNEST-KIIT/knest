import type { Infrastructure } from '@/payload/payload-types'
import { getContentClient } from './payload-client'

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. */
export async function listInfrastructure(limit = 20) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'infrastructure',
    depth: 1,
    limit,
    overrideAccess: false,
  })

  return result.docs
}

/**
 * The spaces founders may ask for time in.
 *
 * `overrideAccess: false` keeps drafts out, which is the behaviour we want:
 * an unpublished space is not one anyone should be booking, so there is no
 * separate "bookable but hidden" state to reason about.
 */
export async function listBookableSpaces(limit = 50): Promise<Infrastructure[]> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'infrastructure',
    depth: 1,
    limit,
    overrideAccess: false,
    where: { bookable: { equals: true } },
    sort: 'name',
  })

  return result.docs
}

/**
 * One space by id.
 *
 * `lab_bookings.labId` is an integer with no foreign key — Payload owns the
 * `cms` schema and Drizzle owns `app`, and their migrations stay separable
 * (spec §32) — so this is where referential integrity actually gets checked.
 * A booking whose space has since been deleted resolves to null here rather
 * than to a dangling row nobody notices.
 */
export async function getSpaceById(id: number): Promise<Infrastructure | null> {
  if (!Number.isInteger(id) || id < 1) return null
  const payload = await getContentClient()

  try {
    return await payload.findByID({
      collection: 'infrastructure',
      id,
      depth: 1,
      overrideAccess: false,
    })
  } catch {
    // Payload throws NotFound rather than returning null.
    return null
  }
}

/** One space by slug — the shape the founder-facing booking screen navigates by. */
export async function getSpaceBySlug(slug: string): Promise<Infrastructure | null> {
  const payload = await getContentClient()
  const result = await payload.find({
    collection: 'infrastructure',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    where: { slug: { equals: slug } },
  })
  return result.docs[0] ?? null
}

/** Every space this email is listed as a manager of. The lab manager's whole world. */
export async function listSpacesManagedBy(email: string): Promise<Infrastructure[]> {
  const normalised = email.trim().toLowerCase()
  if (!normalised) return []

  const payload = await getContentClient()
  const result = await payload.find({
    collection: 'infrastructure',
    depth: 0,
    limit: 100,
    overrideAccess: false,
    where: { 'managers.email': { equals: normalised } },
    sort: 'name',
  })

  return result.docs
}
