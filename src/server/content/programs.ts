import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Program } from '@/payload/payload-types'

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

export async function listPrograms(filters: ProgramFilters = {}) {
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

export async function getProgramBySlug(slug: string): Promise<Program | null> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'programs',
    where: { slug: { equals: slug } },
    depth: 2,
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
export async function listProgramCohortsWithStartups(programId: number) {
  const payload = await getContentClient()

  const cohorts = await payload.find({
    collection: 'cohorts',
    where: { program: { equals: programId } },
    depth: 0,
    limit: 50,
    overrideAccess: false,
  })

  const withStartups = await Promise.all(
    cohorts.docs.map(async (cohort) => {
      const startups = await payload.find({
        collection: 'startups',
        where: { cohort: { equals: cohort.id } },
        depth: 1,
        limit: 100,
        overrideAccess: false,
      })
      return { cohort, startups: startups.docs }
    }),
  )

  return withStartups
}
