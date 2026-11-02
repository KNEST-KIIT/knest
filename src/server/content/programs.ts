import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Program } from '@/payload/payload-types'
import { cachedRead } from './cache'

export type ProgramFilters = {
  stage?: string
  sector?: string
  audience?: string
  format?: string
  status?: string
}

/**
 * Both functions pass `overrideAccess: false` and no `user`, so they see
 * exactly what an anonymous visitor would see through the REST API — a
 * program in draft can never leak onto the public site through this layer,
 * even though the local API would otherwise bypass access control by default.
 */

/** Empty means empty; failure throws (KN-01). No invented programs. */
async function listProgramsUncached(filters: ProgramFilters = {}) {
  const payload = await getContentClient()

  const where: Where = { and: [] }
  const and = where.and as Where[]
  if (filters.stage) and.push({ stage: { equals: filters.stage } })
  if (filters.sector) and.push({ sectors: { equals: filters.sector } })
  if (filters.audience) and.push({ audience: { equals: filters.audience } })
  if (filters.format) and.push({ format: { equals: filters.format } })
  if (filters.status) and.push({ applicationStatus: { equals: filters.status } })

  const result = await payload.find({
    collection: 'programs',
    where: and.length > 0 ? where : undefined,
    depth: 1,
    limit: 100,
    sort: '-nextCohortStart',
    overrideAccess: false,
  })

  return result.docs
}

/** Programs a mentor is attached to — "programs you support" on the mentor dashboard (§4.1). */
async function listProgramsByMentorUncached(mentorId: number) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'programs',
    where: { mentors: { equals: mentorId } },
    depth: 0,
    limit: 50,
    overrideAccess: false,
  })

  return result.docs
}

/** For a founder's accepted program (dashboard §4.1) — the caller already has the ID from an application row. */
async function getProgramByIdUncached(id: number): Promise<Program | null> {
  const payload = await getContentClient()
  try {
    return await payload.findByID({ collection: 'programs', id, depth: 1, overrideAccess: false })
  } catch (error) {
    // Only "there is no such program" (or it is a draft the visitor may not see) is null. A database
    // that cannot be reached must not read as a missing page.
    const status = (error as { status?: number } | null)?.status
    if (status === 404 || status === 403) return null
    throw error
  }
}

async function getProgramBySlugUncached(slug: string): Promise<Program | null> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'programs',
    where: { slug: { equals: slug } },
    // depth: 1 — programs/[slug]/page.tsx only reads direct fields off the
    // program itself and one level into its `mentors` relationship
    // (mentor.name); nothing it renders is two hops away (§5.4, verified
    // against that page's actual field usage).
    depth: 1,
    limit: 1,
    overrideAccess: false,
  })

  return result.docs[0] ?? null
}

/**
 * Cohorts of a program with their startups (spec §23's relationship graph):
 * a startup names its cohort, so this is the read side of that — the program
 * page never re-enters which startups came out of it.
 */
async function listProgramCohortsWithStartupsUncached(programId: number) {
  const payload = await getContentClient()

  const cohorts = await payload.find({
    collection: 'cohorts',
    where: { program: { equals: programId } },
    depth: 0,
    limit: 50,
    overrideAccess: false,
  })
  if (cohorts.docs.length === 0) return []

  // One query for every cohort's startups, not one per cohort (§5.2), then
  // grouped back by cohort id in memory.
  const cohortIds = cohorts.docs.map((cohort) => cohort.id)
  const allStartups = await payload.find({
    collection: 'startups',
    where: { cohort: { in: cohortIds } },
    depth: 1,
    limit: 100,
    overrideAccess: false,
  })

  return cohorts.docs.map((cohort) => ({
    cohort,
    startups: allStartups.docs.filter((startup) => {
      const cohortRef = startup.cohort
      const startupCohortId = typeof cohortRef === 'object' ? cohortRef?.id : cohortRef
      return startupCohortId === cohort.id
    }),
  }))
}

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listPrograms = cachedRead('programs.listPrograms', listProgramsUncached)
export const listProgramsByMentor = cachedRead('programs.listProgramsByMentor', listProgramsByMentorUncached)
export const getProgramById = cachedRead('programs.getProgramById', getProgramByIdUncached)
export const getProgramBySlug = cachedRead('programs.getProgramBySlug', getProgramBySlugUncached)
export const listProgramCohortsWithStartups = cachedRead('programs.listProgramCohortsWithStartups', listProgramCohortsWithStartupsUncached)
