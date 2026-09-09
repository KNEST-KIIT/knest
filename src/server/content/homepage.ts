import { getContentClient } from './payload-client'
import type { Homepage } from '@/payload/payload-types'

export type SectionKey = NonNullable<Homepage['sections']>[number]['key']

const DEFAULT_ORDER: SectionKey[] = [
  'hero',
  'problem',
  'person',
  'knest',
  'journey_selector',
  'journey',
  'offer',
  'ecosystem',
  'startups',
  'closing',
]

export const FALLBACK_HOMEPAGE: Homepage = {
  id: 1,
  sections: DEFAULT_ORDER.map((key) => ({ key, enabled: true })),
  heroHeadline: 'THE MOST DANGEROUS THING YOU CAN DO IS GRADUATE WITH JUST A DEGREE.',
  heroSubhead:
    'While everyone else is memorising the past, a quiet minority is busy building the future. The infrastructure, capital, and network you need are already here. The only thing missing is you.',
  heroPrimaryCta: 'Stop spectating. Build.',
  heroSecondaryCta: 'Explore programs',
  problemHeading: "THE HARDEST PART ISN'T THE IDEA. IT'S THE EXECUTION.",
  problemBody:
    "You've probably had one. Sitting in a lecture, noticing a broken system, and thinking someone should fix it.\n\nThe gap between noticing and building is where 99% of potential is lost. Not to a lack of talent. To a lack of a next step. We are the next step.",
  personHeading: "YOU DON'T HAVE TO BE 'AN ENTREPRENEUR' YET.",
  personLines: [
    { id: '0', line: 'You just need an obsession.' },
    { id: '1', line: 'You need to hate inefficiency.' },
    { id: '2', line: 'You need to be willing to fail in public.' },
    { id: '3', line: 'We will teach you the rest.' },
  ],
  knestHeading: 'KNEST IS THE INFRASTRUCTURE FOR AMBITION.',
  knestBody:
    "We don't just run programs. We provide the capital, the makerspaces, the industry networks, and the intense, high-agency community you need to turn a prototype into a scalable venture.",
  closingHeading: 'THE CAPITAL IS WAITING. THE LABS ARE OPEN.',
  closingBody:
    'You have a four-year window to build something that scales beyond your own time. Decide if you are a spectator or a founder.',
  closingCta: 'Apply Now',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

/**
 * The homepage global's own access rule already allows anonymous reads
 * (`access.read: () => true`, set in Phase 2), but overrideAccess:false is
 * still passed for the same reason as every other content-layer read: it
 * makes that guarantee structural rather than something a caller has to
 * remember.
 */
export async function getHomepage(): Promise<Homepage> {
  try {
    const payload = await getContentClient()
    const result = await payload.findGlobal({ slug: 'homepage', depth: 1, overrideAccess: false })
    if (result && result.heroHeadline) return result
    return FALLBACK_HOMEPAGE
  } catch (error) {
    console.warn('Could not fetch homepage from database/CMS, using fallback:', error)
    return FALLBACK_HOMEPAGE
  }
}

/**
 * The ordered, enabled section keys to actually render. Falls back to the
 * fixed default order if the global's `sections` array is somehow empty
 * (e.g. a global read before seedCms() has ever run) — the fixed set is
 * defined in code regardless, so this is a safety net, not a second source
 * of truth for what the sections are.
 */
export function enabledSections(homepage: Homepage): SectionKey[] {
  const sections = homepage?.sections
  if (!sections || sections.length === 0) return DEFAULT_ORDER
  return sections.filter((s) => s.enabled !== false).map((s) => s.key)
}
