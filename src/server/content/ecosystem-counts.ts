import { getContentClient } from './payload-client'
import { UNKNOWN_COUNTS, type EcosystemCounts } from './ecosystem-types'

async function safeCount(label: string, run: () => Promise<{ totalDocs: number }>): Promise<number | null> {
  try {
    return (await run()).totalDocs
  } catch (error) {
    // The homepage must survive a CMS outage; a failed count is simply not shown.
    console.error(`Homepage counter "${label}" unavailable:`, error)
    return null
  }
}

type CountedCollection = 'programs' | 'mentors' | 'startups' | 'infrastructure' | 'partners' | 'events'

export async function getEcosystemCounts(): Promise<EcosystemCounts> {
  let payload: Awaited<ReturnType<typeof getContentClient>>
  try {
    payload = await getContentClient()
  } catch (error) {
    console.error('Homepage counters unavailable:', error)
    return UNKNOWN_COUNTS
  }

  const count = (collection: CountedCollection, where?: Parameters<typeof payload.count>[0]['where']) =>
    safeCount(collection, () => payload.count({ collection, where, overrideAccess: false }))
  const partners = (type: string) => count('partners', { type: { equals: type } })

  const [programs, mentors, startups, upcomingEvents, spaces, industryPartners, investors, academicPartners, governmentPartners, communityPartners] =
    await Promise.all([
      count('programs'),
      count('mentors'),
      count('startups'),
      count('events', { startsAt: { greater_than_equal: new Date().toISOString() } }),
      count('infrastructure'),
      partners('industry'),
      partners('investor'),
      partners('academic'),
      partners('government'),
      partners('community'),
    ])

  return { programs, mentors, startups, upcomingEvents, spaces, industryPartners, investors, academicPartners, governmentPartners, communityPartners }
}
