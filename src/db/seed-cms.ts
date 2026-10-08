import { getPayload } from 'payload'
import config from '@/payload/payload.config'
import { HOMEPAGE_COPY } from '@/server/content/homepage-copy'

const SECTION_KEYS = [
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
] as const

export async function seedCms() {
  const payload = await getPayload({ config })
  const existing = await payload.findGlobal({ slug: 'homepage', depth: 0 })
  const existingSections = Array.isArray(existing?.sections) ? existing.sections : []

  const sections = SECTION_KEYS.map((key) => {
    const prior = existingSections.find((s) => s?.key === key)
    return { key, enabled: prior?.enabled ?? true }
  })

  await payload.updateGlobal({
    slug: 'homepage',
    data: {
      sections,
      // Never overwrite copy a staff editor has already written (the old seed did).
      ...(existing?.heroHeadline
        ? {}
        : {
            ...HOMEPAGE_COPY,
            personLines: HOMEPAGE_COPY.personLines.map((line, i) => ({ id: String(i), line })),
          }),
    },
  })
  console.log('Seeded homepage')
}
