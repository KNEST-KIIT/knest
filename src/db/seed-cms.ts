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
  'You just need an obsession.',
  'You need to hate inefficiency.',
  'You need to be willing to fail in public.',
  'We will teach you the rest.',
]

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
      heroHeadline: 'THE MOST DANGEROUS THING YOU CAN DO IS GRADUATE WITH JUST A DEGREE.',
      heroSubhead: 'While everyone else is memorising the past, a quiet minority is busy building the future. The infrastructure, capital, and network you need are already here. The only thing missing is you.',
      heroPrimaryCta: 'Stop spectating. Build.',
      heroSecondaryCta: 'Explore programs',
      problemHeading: 'THE HARDEST PART ISN\'T THE IDEA. IT\'S THE EXECUTION.',
      problemBody: 'You\'ve probably had one. Sitting in a lecture, noticing a broken system, and thinking someone should fix it.\n\nThe gap between noticing and building is where 99% of potential is lost. Not to a lack of talent. To a lack of a next step. We are the next step.',
      personHeading: 'YOU DON\'T HAVE TO BE \'AN ENTREPRENEUR\' YET.',
      personLines: PERSON_LINES.map((line, i) => ({
        id: String(i),
        line,
      })),
      knestHeading: 'KNEST IS THE INFRASTRUCTURE FOR AMBITION.',
      knestBody: 'We don\'t just run programs. We provide the capital, the makerspaces, the industry networks, and the intense, high-agency community you need to turn a prototype into a scalable venture.',
      closingHeading: 'THE CAPITAL IS WAITING. THE LABS ARE OPEN.',
      closingBody: 'You have a four-year window to build something that scales beyond your own time. Decide if you are a spectator or a founder.',
      closingCta: 'Apply Now',
    },
  })
  console.log('Seeded homepage')
}
