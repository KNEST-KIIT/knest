import { getContentClient } from './payload-client'
import type { Homepage } from '@/payload/payload-types'
import { HOMEPAGE_COPY } from './homepage-copy'
import { cachedRead } from './cache'

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

/**
 * Used when the global is empty or unreadable. It is the approved copy from
 * CONTENT_SPEC section 1 and nothing else: no records, no figures, no claims
 * (KN-01 / KN-18). The previous fallback carried unapproved copy that promised
 * capital and open labs.
 */
export const FALLBACK_HOMEPAGE: Homepage = {
  id: 1,
  sections: DEFAULT_ORDER.map((key) => ({ key, enabled: true })),
  ...HOMEPAGE_COPY,
  personLines: HOMEPAGE_COPY.personLines.map((line, i) => ({ id: String(i), line })),
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
// Only a successful read is cached (a read that throws is never remembered), so the outage fallback below
// is still chosen fresh on every request while the CMS is down.
const readHomepage = cachedRead('homepage.global', async () => {
  const payload = await getContentClient()
  return payload.findGlobal({ slug: 'homepage', depth: 1, overrideAccess: false })
})

export async function getHomepage(): Promise<Homepage> {
  try {
    const result = await readHomepage()
    if (result && result.heroHeadline) return result
    return FALLBACK_HOMEPAGE
  } catch (error) {
    // Static approved copy is safe to show during an outage, but the outage must
    // not be silent.
    console.error('Could not fetch homepage from the CMS; serving the approved static copy:', error)
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
  const seen = new Set<SectionKey>()
  const result: SectionKey[] = []
  for (const s of sections) {
    if (s.enabled !== false && !seen.has(s.key)) {
      seen.add(s.key)
      result.push(s.key)
    }
  }
  return result
}
