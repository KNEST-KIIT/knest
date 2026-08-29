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

/**
 * The homepage global's own access rule already allows anonymous reads
 * (`access.read: () => true`, set in Phase 2), but overrideAccess:false is
 * still passed for the same reason as every other content-layer read: it
 * makes that guarantee structural rather than something a caller has to
 * remember.
 */
export async function getHomepage(): Promise<Homepage> {
  const payload = await getContentClient()
  return payload.findGlobal({ slug: 'homepage', depth: 1, overrideAccess: false })
}

/**
 * The ordered, enabled section keys to actually render. Falls back to the
 * fixed default order if the global's `sections` array is somehow empty
 * (e.g. a global read before seedCms() has ever run) — the fixed set is
 * defined in code regardless, so this is a safety net, not a second source
 * of truth for what the sections are.
 */
export function enabledSections(homepage: Homepage): SectionKey[] {
  const sections = homepage.sections
  if (!sections || sections.length === 0) return DEFAULT_ORDER
  return sections.filter((s) => s.enabled !== false).map((s) => s.key)
}
