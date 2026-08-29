import { getPayload } from 'payload'
import config from '@/payload/payload.config'

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

const PERSON_LINES = [
  'Maybe you’ve had an idea.',
  'Maybe you’ve noticed something that doesn’t work.',
  'Maybe you’ve wondered why nobody has fixed it.',
  'Maybe you’ve never thought of yourself as an entrepreneur.',
  'You don’t need to.',
  'Start with the question.',
]

/**
 * Initialises the homepage global.
 *
 * The section list is a fixed set that an editor reorders and toggles but
 * cannot add to, so it has to exist before they open the page — an empty array
 * would leave them with nothing to arrange. Existing rows are preserved on
 * re-run so a real edit is never overwritten by a redeploy.
 *
 * Copy here is the default from CONTENT_SPEC.md. No startups, mentors, metrics
 * or testimonials are seeded (spec §46) — those sections ship empty and say so.
 */
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
      heroHeadline: existing?.heroHeadline ?? 'WHAT IF YOU\nACTUALLY BUILT IT?',
      heroSubhead:
        existing?.heroSubhead ??
        'Most ideas stay ideas. Not because they were bad — because nobody ever took the next step.',
      heroPrimaryCta: existing?.heroPrimaryCta ?? 'Start your journey',
      heroSecondaryCta: existing?.heroSecondaryCta ?? 'Explore programs',
      problemHeading: existing?.problemHeading ?? 'THE HARDEST PART ISN’T THE IDEA.',
      problemBody:
        existing?.problemBody ??
        'You’ve probably had one. In a lecture, on a commute, watching something work badly and thinking someone should fix this.\n\nThen the semester moved on.\n\nThe gap between noticing something and building something is where almost everything is lost. Not to a lack of talent. To a lack of a next step.',
      personHeading: existing?.personHeading ?? 'YOU DON’T HAVE TO BE “AN ENTREPRENEUR” YET.',
      personLines:
        existing?.personLines?.length
          ? existing.personLines
          : PERSON_LINES.map((line) => ({ line })),
      knestHeading: existing?.knestHeading ?? 'KNEST IS WHERE YOU FIND OUT WHAT HAPPENS NEXT.',
      knestBody:
        existing?.knestBody ??
        'We’re KIIT’s innovation and entrepreneurship ecosystem: programs, mentors, workspace, industry access and a community of people building things — open to every student, at every stage, including the stage where you have nothing but a question.',
      closingHeading: existing?.closingHeading ?? 'THERE IS SOMETHING YOU COULD BUILD.',
      closingBody: existing?.closingBody ?? 'Let’s find out what it is.',
      closingCta: existing?.closingCta ?? 'Start your journey',
    },
  })

  console.log(`✓ homepage initialised with ${sections.length} sections`)
}
