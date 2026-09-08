import { getPayload } from 'payload'
import { eq } from 'drizzle-orm'
import config from '@/payload/payload.config'
import { db } from './client'
import { applications, applicationAnswers } from './schema/applications'
import { users } from './schema/users'

/**
 * Demo content — deliberately NOT part of `pnpm db:seed`.
 *
 * `db:seed` creates two accounts and nothing else, on purpose: KNEST's
 * ecosystem is beginning, and the product shows that honestly rather than
 * filling itself with plausible fiction (spec §46, and the README says so out
 * loud). That is the right default for anything real, and this file does not
 * change it.
 *
 * It is also why nothing can be demonstrated on a fresh database. With zero
 * programs there is no application to start, so the member journey dead-ends
 * after onboarding, the staff review queue is empty and its program filter has
 * no options, and every number on the analytics page is zero. The flows work;
 * there is simply nothing for them to work on.
 *
 * So this is a second, opt-in seed:
 *
 *     pnpm db:seed:demo
 *
 * `pnpm db:seed:demo --clear` removes exactly what this file created and
 * nothing else: CMS records by their known slugs, and the demo applicants by
 * `DEMO_MARKER` in their account name — which is the one place the marker is
 * load-bearing, since those accounts have no slug to match on. It is
 * deliberately absent from every field a visitor can read: an earlier version
 * appended it to the programme and mentor copy, and "[demo]" duly appeared
 * mid-paragraph on the live page.
 *
 * Run it on a demo or review environment, not on production.
 *
 * Idempotent: re-running updates the existing records rather than duplicating.
 */

/**
 * Stamped on the demo applicant accounts only, so `--clear` can find them.
 * It shows in the staff applications list, where "these are demo applicants"
 * is useful information, and nowhere a visitor looks.
 */
export const DEMO_MARKER = '[demo]'

/* Payload's Lexical editor stores a document tree, not a string. This is the
   minimal valid shape for one or more paragraphs. */
function richText(...paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        textFormat: 0,
        children: [
          { type: 'text', text, format: 0, style: '', mode: 'normal' as const, detail: 0, version: 1 },
        ],
      })),
    },
  }
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

/* ---------------------------------------------------------------- content -- */

const MENTORS = [
  {
    slug: 'ananya-mohanty',
    name: 'Ananya Mohanty',
    title: 'Co-founder',
    organization: 'Rethread Labs',
    bio: 'Built a textile-recycling business out of a KIIT hostel room and ran it for six years. Talks candidly about the parts that did not work.',
    expertise: ['product', 'operations', 'gtm'],
    sectors: ['climate', 'consumer'],
    availability: 'open',
  },
  {
    slug: 'rahul-desai',
    name: 'Rahul Desai',
    title: 'Partner',
    organization: 'Kalinga Angel Network',
    bio: 'Invests in pre-seed teams across eastern India. Best used early, while you can still change your mind about the business.',
    expertise: ['fundraising', 'industry'],
    sectors: ['fintech', 'saas'],
    availability: 'limited',
  },
  {
    slug: 'sneha-iyer',
    name: 'Sneha Iyer',
    title: 'Director of Engineering',
    organization: 'Zolve',
    bio: 'Scaled a payments platform from three engineers to sixty. Good on the point where a prototype has to become a system.',
    expertise: ['technology', 'hiring'],
    sectors: ['fintech', 'saas'],
    availability: 'limited',
  },
  {
    slug: 'vikram-patnaik',
    name: 'Vikram Patnaik',
    title: 'Professor of Biotechnology',
    organization: 'KIIT School of Biotechnology',
    bio: 'Takes lab research to market. Has walked four student teams through regulatory approval.',
    expertise: ['technology', 'legal'],
    sectors: ['health', 'deeptech'],
    availability: 'open',
  },
  {
    slug: 'meera-krishnan',
    name: 'Meera Krishnan',
    title: 'Head of Design',
    organization: 'Freshworks',
    bio: 'Works on the gap between what a team built and what a customer understands.',
    expertise: ['design', 'product'],
    sectors: ['saas', 'consumer'],
    availability: 'open',
  },
  {
    slug: 'arjun-sahoo',
    name: 'Arjun Sahoo',
    title: 'Founder',
    organization: 'AgriSetu',
    bio: 'Sells software to farmers in three states. Blunt about distribution in rural markets.',
    expertise: ['gtm', 'operations'],
    sectors: ['agriculture', 'social_impact'],
    availability: 'limited',
  },
]

const PROGRAMS = [
  {
    slug: 'ignition',
    title: 'Ignition',
    tagline: 'Eight weeks to find out whether your idea survives contact with a real person.',
    stage: ['exploring', 'idea'],
    sectors: ['ai', 'saas', 'consumer', 'social_impact'],
    audience: ['students', 'aspiring_founders'],
    applicationStatus: 'open',
    duration: '8 weeks',
    cohortSize: 24,
    applicationDeadline: days(21),
    nextCohortStart: days(35),
    whoItsFor:
      'Students who have an idea, or the beginnings of one, and have not yet spoken to anyone who would pay for it. No team required — most people arrive alone.',
    whatYoullBuild:
      'A validated problem statement, twenty customer conversations, and an honest decision about whether to continue.',
    timeline: [
      { label: 'Problem framing', duration: 'Weeks 1–2', description: 'Write down what you think is true, so you can test it.' },
      { label: 'Customer discovery', duration: 'Weeks 3–5', description: 'Twenty conversations. No pitching.' },
      { label: 'Synthesis', duration: 'Weeks 6–7', description: 'What did you actually learn, and what does it change?' },
      { label: 'Decision', duration: 'Week 8', description: 'Continue, pivot, or stop. All three are good outcomes.' },
    ],
    questions: [
      { id: 'idea', type: 'textarea', label: 'What are you thinking about building?', required: true, help: 'Two or three sentences is plenty.' },
      { id: 'why_you', type: 'textarea', label: 'Why you?', required: true, help: 'What do you know about this problem that most people do not?' },
      { id: 'talked_to', type: 'select', label: 'Have you spoken to anyone who has this problem?', required: true, options: ['Not yet', 'One or two people', 'More than five'] },
      { id: 'commitment', type: 'select', label: 'Hours a week you can commit', required: true, options: ['Under 5', '5–10', '10–20', 'More than 20'] },
    ],
  },
  {
    slug: 'build-sprint',
    title: 'Build Sprint',
    tagline: 'Twelve weeks and a working product in front of real users.',
    stage: ['validation', 'mvp'],
    sectors: ['saas', 'ai', 'health', 'education'],
    audience: ['aspiring_founders', 'founders'],
    applicationStatus: 'open',
    duration: '12 weeks',
    cohortSize: 16,
    applicationDeadline: days(10),
    nextCohortStart: days(28),
    whoItsFor:
      'Teams who have validated a problem and now have to build something. You should have at least one person who can ship.',
    whatYoullBuild: 'A working product, in the hands of at least fifty users, with instrumentation you trust.',
    timeline: [
      { label: 'Scope', duration: 'Weeks 1–2', description: 'Decide what not to build.' },
      { label: 'Build', duration: 'Weeks 3–9', description: 'Weekly demos to the cohort. Nothing is private.' },
      { label: 'Release', duration: 'Weeks 10–12', description: 'Real users, real instrumentation.' },
    ],
    questions: [
      { id: 'what', type: 'textarea', label: 'What are you building?', required: true },
      { id: 'evidence', type: 'textarea', label: 'What evidence do you have that people want it?', required: true },
      { id: 'team', type: 'text', label: 'Who is on the team, and who writes the code?', required: true },
      { id: 'repo', type: 'url', label: 'Link to a repo, prototype or demo', required: false },
    ],
  },
  {
    slug: 'launch-lab',
    title: 'Launch Lab',
    tagline: 'From first users to first revenue.',
    stage: ['mvp', 'early_revenue'],
    sectors: ['fintech', 'saas', 'consumer', 'mobility'],
    audience: ['founders'],
    applicationStatus: 'opening_soon',
    duration: '16 weeks',
    cohortSize: 12,
    applicationOpensAt: days(30),
    whoItsFor: 'Teams with a product in use who have not yet charged for it, or have and it is not working.',
    whatYoullBuild: 'A pricing model, a repeatable sales motion, and the first ten paying customers.',
    timeline: [
      { label: 'Pricing', duration: 'Weeks 1–4', description: 'What is it worth, to whom.' },
      { label: 'Sell', duration: 'Weeks 5–14', description: 'Founders sell. Not a hire, not later.' },
      { label: 'Systematise', duration: 'Weeks 15–16', description: 'Write down what worked so someone else can do it.' },
    ],
    questions: [
      { id: 'product', type: 'textarea', label: 'What does your product do?', required: true },
      { id: 'users', type: 'text', label: 'How many people use it, and how often?', required: true },
      { id: 'revenue', type: 'select', label: 'Current revenue', required: true, options: ['None yet', 'Under ₹50k total', '₹50k–₹5L', 'More than ₹5L'] },
    ],
  },
  {
    slug: 'deeptech-residency',
    title: 'DeepTech Residency',
    tagline: 'For research that should leave the lab.',
    stage: ['idea', 'validation'],
    sectors: ['deeptech', 'health', 'climate', 'space'],
    audience: ['researchers', 'students'],
    applicationStatus: 'in_progress',
    duration: '24 weeks',
    cohortSize: 8,
    whoItsFor: 'Postgraduate and doctoral researchers at KIIT with a result that has an application outside a paper.',
    whatYoullBuild: 'A technology-readiness assessment, an IP position, and a first industrial conversation.',
    timeline: [
      { label: 'Translation', duration: 'Weeks 1–8', description: 'What is the product, and who is the buyer?' },
      { label: 'IP and regulation', duration: 'Weeks 9–16', description: 'What you can protect and what you must satisfy.' },
      { label: 'Industry', duration: 'Weeks 17–24', description: 'Pilot conversations with real firms.' },
    ],
    questions: [
      { id: 'research', type: 'textarea', label: 'What is the research?', required: true },
      { id: 'lab', type: 'text', label: 'Which lab or department?', required: true },
      { id: 'publication', type: 'url', label: 'Link to a paper or preprint, if there is one', required: false },
    ],
  },
  {
    slug: 'founder-fridays',
    title: 'Founder Fridays',
    tagline: 'No application. Turn up.',
    stage: ['exploring'],
    sectors: ['ai', 'consumer', 'education', 'social_impact'],
    audience: ['students', 'aspiring_founders', 'alumni'],
    applicationStatus: 'closed',
    duration: 'Ongoing, weekly',
    whoItsFor: 'Anyone at KIIT who is curious. The lowest-commitment way into KNEST.',
    whatYoullBuild: 'Nothing, deliberately. You meet people and hear what they are working on.',
    timeline: [{ label: 'Every Friday', duration: '5–7pm', description: 'Campus 17, Innovation Hall.' }],
    questions: [],
  },
]

const FOUNDERS = [
  { slug: 'priya-nanda', name: 'Priya Nanda', headline: 'Co-founder, Kisan Kernel', school: 'KIIT School of Computer Engineering', graduationYear: 2024 },
  { slug: 'dev-agarwal', name: 'Dev Agarwal', headline: 'Co-founder, Kisan Kernel', school: 'KIIT School of Computer Engineering', graduationYear: 2024 },
  { slug: 'tanvi-rout', name: 'Tanvi Rout', headline: 'Founder, Sutra Health', school: 'KIIT School of Biotechnology', graduationYear: 2023 },
  { slug: 'imran-khan', name: 'Imran Khan', headline: 'Founder, Odisha Transit', school: 'KIIT School of Civil Engineering', graduationYear: 2025 },
]

/* `story[].stage` is a narrative arc — problem / idea / experiment / product /
   progress — and deliberately not the journey-stage taxonomy used by the
   startup's own `stage` field. Populate only the beats actually reached. */
const STARTUPS = [
  {
    slug: 'kisan-kernel',
    name: 'Kisan Kernel',
    tagline: 'Crop-disease detection that works on a ₹6,000 phone, offline.',
    stage: 'early_revenue',
    sectors: ['agriculture', 'ai'],
    school: 'KIIT School of Computer Engineering',
    foundedYear: 2024,
    founders: ['priya-nanda', 'dev-agarwal'],
    story: [
      { stage: 'problem', heading: 'A photograph in a field with no signal', body: 'Priya went home to Balasore and watched her uncle lose a season to a blight he could have treated, because the nearest agronomist was four hours away.' },
      { stage: 'experiment', heading: 'Ninety farmers, one WhatsApp group', body: 'The first version was a phone number. Farmers sent photographs and a human answered. It was slow and it proved the demand.' },
      { stage: 'progress', heading: 'On-device, and paid for', body: 'The model now runs offline on entry-level Android. Four cooperatives pay per season.' },
    ],
    achievements: [
      { label: 'Startup Odisha grant recipient', date: days(-210) },
      { label: '4,200 farmers on the platform', date: days(-40) },
    ],
  },
  {
    slug: 'sutra-health',
    name: 'Sutra Health',
    tagline: 'Antenatal screening for district hospitals that have no radiologist.',
    stage: 'mvp',
    sectors: ['health', 'deeptech'],
    school: 'KIIT School of Biotechnology',
    foundedYear: 2023,
    founders: ['tanvi-rout'],
    story: [
      { stage: 'problem', heading: 'A rotation in Kendrapara', body: 'Tanvi spent six weeks in a district hospital where the ultrasound machine worked and nobody was trained to read it.' },
      { stage: 'product', heading: 'Three hospitals, live', body: 'A triage tool that flags scans needing a specialist. In use at three district hospitals under clinical supervision.' },
    ],
    achievements: [{ label: 'Ethics approval, KIMS', date: days(-120) }],
  },
  {
    slug: 'odisha-transit',
    name: 'Odisha Transit',
    tagline: 'Live bus timings for the routes no app covers.',
    stage: 'validation',
    sectors: ['mobility', 'social_impact'],
    school: 'KIIT School of Civil Engineering',
    foundedYear: 2025,
    founders: ['imran-khan'],
    story: [
      { stage: 'problem', heading: 'Waiting is the product', body: 'Imran measured how long students actually wait at the Patia gate. The average was thirty-one minutes.' },
      { stage: 'experiment', heading: 'Crowdsourced first', body: 'Riders report positions. Eleven routes covered, 1,800 weekly users, no municipal integration yet.' },
    ],
    achievements: [],
  },
  {
    slug: 'rethread',
    name: 'Rethread',
    tagline: 'Turning campus textile waste into acoustic panels.',
    stage: 'scaling',
    sectors: ['climate', 'hardware'],
    school: 'KIIT School of Mechanical Engineering',
    foundedYear: 2022,
    founders: [],
    story: [
      { stage: 'problem', heading: 'Two tonnes a month, thrown away', body: 'The campus laundry and tailoring units produced more offcut than anyone had counted.' },
      { stage: 'progress', heading: 'Selling to offices', body: 'Panels now ship to co-working operators in Bhubaneswar and Kolkata.' },
    ],
    achievements: [{ label: 'First profitable quarter', date: days(-95) }],
  },
]

const EVENTS = [
  { slug: 'demo-day-autumn', title: 'Ignition Demo Day', summary: 'Twenty-four teams, four minutes each, no slides allowed after the first one.', eventType: 'demo_day', startsAt: days(12), location: 'Campus 17, Innovation Hall', capacity: 200, relevantStages: ['exploring', 'idea'] },
  { slug: 'office-hours-fundraising', title: 'Office hours: raising a first round', summary: 'Thirty-minute slots with Rahul Desai. Bring a specific question, not a pitch.', eventType: 'office_hours', startsAt: days(5), location: 'KNEST Founder Cabin 2', capacity: 12, relevantStages: ['mvp', 'early_revenue'] },
  { slug: 'build-weekend', title: 'Build Weekend', summary: 'Forty-eight hours. Form a team on Friday, show something on Sunday.', eventType: 'hackathon', startsAt: days(26), location: 'Campus 15, Maker Lab', capacity: 120, relevantStages: ['exploring', 'idea', 'validation'] },
  { slug: 'talk-distribution', title: 'Distribution is the hard part', summary: 'Arjun Sahoo on selling software to people who do not read email.', eventType: 'talk', startsAt: days(19), location: 'Campus 6, Auditorium', capacity: 300, relevantStages: ['mvp', 'early_revenue', 'scaling'] },
  { slug: 'ideation-climate', title: 'Ideation session: climate', summary: 'A structured session for people who care about the problem and have no idea yet.', eventType: 'ideation', startsAt: days(33), location: 'Collaboration Zone A', capacity: 40, relevantStages: ['exploring'] },
]

const RESOURCES = [
  { slug: 'customer-conversations', title: 'How to run a customer conversation', summary: 'The twenty questions that produce useful answers, and the four that produce flattery.', format: 'guide', stages: ['exploring', 'idea', 'validation'], topics: ['consumer', 'saas'], readingMinutes: 12 },
  { slug: 'cap-table-template', title: 'Cap table template', summary: 'A spreadsheet for founders who have not yet issued equity, with the mistakes annotated.', format: 'template', stages: ['idea', 'mvp'], topics: ['fintech'], readingMinutes: 5 },
  { slug: 'incorporation-india', title: 'Incorporating in India: what actually happens', summary: 'The sequence, the costs, and when a student team should not incorporate yet.', format: 'playbook', stages: ['validation', 'mvp'], topics: [], readingMinutes: 18 },
  { slug: 'pricing-first', title: 'Setting your first price', summary: 'Why cost-plus is the wrong instinct, and what to do instead.', format: 'guide', stages: ['mvp', 'early_revenue'], topics: ['saas'], readingMinutes: 9 },
  { slug: 'pitch-worksheet', title: 'Four-minute pitch worksheet', summary: 'A structure for demo day. Fill it in, then throw away the slides.', format: 'worksheet', stages: ['idea', 'validation', 'mvp'], topics: [], readingMinutes: 6 },
  { slug: 'hiring-first-engineer', title: 'Hiring your first engineer', summary: 'Sneha Iyer on what to look for when you cannot yet pay market rate.', format: 'article', stages: ['mvp', 'early_revenue'], topics: ['saas'], readingMinutes: 11 },
]

const PARTNERS = [
  { slug: 'startup-odisha', name: 'Startup Odisha', type: 'government', description: 'State startup policy, grants and recognition.' },
  { slug: 'nen', name: 'National Entrepreneurship Network', type: 'community', description: 'National network of campus entrepreneurship programmes.' },
  { slug: 'kalinga-angels', name: 'Kalinga Angel Network', type: 'investor', description: 'Angel investors focused on eastern India.' },
  { slug: 'kiims', name: 'KIMS Hospital', type: 'academic', description: 'Clinical partner for health ventures.' },
  { slug: 'tcs-bbsr', name: 'TCS Bhubaneswar', type: 'industry', description: 'Industry mentorship and pilot opportunities.' },
]

const INFRASTRUCTURE = [
  { slug: 'coworking-17', name: 'Innovation Hall', spaceType: 'coworking', summary: 'Ninety desks, open to any KIIT student with an idea.', location: 'Campus 17, Ground floor', capacity: 90, equipment: ['Standing desks', 'Bookable meeting pods', '24/7 access'] },
  { slug: 'maker-lab', name: 'Maker Lab', spaceType: 'maker_lab', summary: 'Prototyping for hardware teams.', location: 'Campus 15, Block B', capacity: 25, equipment: ['3D printers', 'Laser cutter', 'Electronics bench', 'CNC router'] },
  { slug: 'studio', name: 'Content Studio', spaceType: 'digital_studio', summary: 'For teams making their first demo video or pitch recording.', location: 'Campus 17, First floor', capacity: 6, equipment: ['Lighting rig', 'Audio booth', 'Teleprompter'] },
  { slug: 'cabins', name: 'Founder Cabins', spaceType: 'founder_cabin', summary: 'Six private cabins, allocated per cohort.', location: 'Campus 17, Second floor', capacity: 6, equipment: ['Private desk space', 'Whiteboard wall'] },
]

const FAQS = [
  { q: 'Do I need an idea to join KNEST?', a: 'No. Founder Fridays and the ideation sessions exist precisely for people who do not have one yet.' },
  { q: 'Does KNEST take equity?', a: 'No. KNEST is university infrastructure, not an investor. Introductions to investors are separate and optional.' },
  { q: 'Can I apply if I am in my first year?', a: 'Yes. Ignition has no year restriction and roughly a third of each cohort is first or second year.' },
  { q: 'What happens if my idea fails during a programme?', a: 'That is a normal outcome and does not affect your standing. Ignition is explicitly designed so that stopping is one of three good endings.' },
]

/* ------------------------------------------------------------------ seed -- */

type Payload = Awaited<ReturnType<typeof getPayload>>

/**
 * Create-or-update by slug, so the seed can be run repeatedly.
 *
 * The collection name is a runtime string here rather than one of Payload's
 * generated literal types, which is what the casts are for — they are confined
 * to this one helper so no call site has to carry them.
 */
async function upsertBy(
  payload: Payload,
  collection: string,
  field: string,
  value: string,
  data: Record<string, unknown>,
): Promise<{ id: number | string }> {
  // Bound to the instance: Payload's local API reads `this.config`, so a
  // detached reference throws "Cannot read properties of undefined".
  const find = payload.find.bind(payload) as unknown as (args: unknown) => Promise<{ totalDocs: number; docs: { id: number | string }[] }>
  const create = payload.create.bind(payload) as unknown as (args: unknown) => Promise<{ id: number | string }>
  const update = payload.update.bind(payload) as unknown as (args: unknown) => Promise<{ id: number | string }>

  const found = await find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0 })
  const doc = { ...data, [field]: value, _status: 'published' }

  const existing = found.docs[0]
  return existing
    ? update({ collection, id: existing.id, data: doc })
    : create({ collection, data: doc })
}

export async function seedDemo() {
  const payload = await getPayload({ config })
  const id = (d: { id: number | string }) => d.id

  const mentorIds = new Map<string, number | string>()
  for (const m of MENTORS) {
    const doc = await upsertBy(payload, 'mentors', 'slug', m.slug, {
      name: m.name,
      title: m.title,
      organization: m.organization,
      bio: m.bio,
      expertise: m.expertise,
      sectors: m.sectors,
      availability: m.availability,
      featured: true,
    })
    mentorIds.set(m.slug, id(doc))
  }
  console.log(`✓ ${MENTORS.length} mentors`)

  const partnerIds = new Map<string, number | string>()
  for (const p of PARTNERS) {
    const doc = await upsertBy(payload, 'partners', 'slug', p.slug, {
      name: p.name,
      type: p.type,
      description: p.description,
    })
    partnerIds.set(p.slug, id(doc))
  }
  console.log(`✓ ${PARTNERS.length} partners`)

  const programIds = new Map<string, number | string>()
  for (const p of PROGRAMS) {
    const doc = await upsertBy(payload, 'programs', 'slug', p.slug, {
      title: p.title,
      tagline: p.tagline,
      whoItsFor: richText(p.whoItsFor),
      whatYoullBuild: richText(p.whatYoullBuild),
      stage: p.stage,
      sectors: p.sectors,
      audience: p.audience,
      format: 'in_person',
      duration: p.duration,
      cohortSize: p.cohortSize,
      nextCohortStart: p.nextCohortStart,
      applicationStatus: p.applicationStatus,
      applicationDeadline: p.applicationDeadline,
      applicationOpensAt: p.applicationOpensAt,
      timeline: p.timeline,
      mentors: [...mentorIds.values()].slice(0, 3),
      partners: [...partnerIds.values()].slice(0, 2),
      applicationQuestions: p.questions.map((q) => ({
        questionId: q.id,
        type: q.type,
        label: q.label,
        required: q.required,
        helpText: 'help' in q ? q.help : undefined,
        options: 'options' in q && q.options ? q.options.map((o: string) => ({ label: o, value: o })) : undefined,
      })),
      publishedAt: new Date().toISOString(),
    })
    programIds.set(p.slug, id(doc))
  }
  console.log(`✓ ${PROGRAMS.length} programs (2 open for applications)`)

  const founderIds = new Map<string, number | string>()
  for (const f of FOUNDERS) {
    const doc = await upsertBy(payload, 'founders', 'slug', f.slug, {
      name: f.name,
      headline: f.headline,
      school: f.school,
      graduationYear: f.graduationYear,
      bio: `${f.headline}.`,
    })
    founderIds.set(f.slug, id(doc))
  }
  console.log(`✓ ${FOUNDERS.length} founders`)

  for (const s of STARTUPS) {
    await upsertBy(payload, 'startups', 'slug', s.slug, {
      name: s.name,
      tagline: s.tagline,
      stage: s.stage,
      sectors: s.sectors,
      school: s.school,
      foundedYear: s.foundedYear,
      founders: s.founders.map((f) => founderIds.get(f)).filter(Boolean),
      story: s.story.map((b) => ({ stage: b.stage, heading: b.heading, body: richText(b.body) })),
      achievements: s.achievements,
      featured: true,
      publishedAt: new Date().toISOString(),
    })
  }
  console.log(`✓ ${STARTUPS.length} startups`)

  for (const e of EVENTS) {
    await upsertBy(payload, 'events', 'slug', e.slug, {
      title: e.title,
      summary: e.summary,
      eventType: e.eventType,
      format: 'in_person',
      startsAt: e.startsAt,
      location: e.location,
      capacity: e.capacity,
      relevantStages: e.relevantStages,
      mentorSpeakers: [...mentorIds.values()].slice(0, 1),
      publishedAt: new Date().toISOString(),
    })
  }
  console.log(`✓ ${EVENTS.length} events (all upcoming)`)

  for (const r of RESOURCES) {
    await upsertBy(payload, 'resources', 'slug', r.slug, {
      title: r.title,
      summary: r.summary,
      format: r.format,
      stages: r.stages,
      topics: r.topics,
      readingMinutes: r.readingMinutes,
      body: richText(
        'This is demo content standing in for the real resource, so the library, its filters and the detail page can be shown working.',
      ),
      publishedAt: new Date().toISOString(),
    })
  }
  console.log(`✓ ${RESOURCES.length} resources`)

  for (const i of INFRASTRUCTURE) {
    await upsertBy(payload, 'infrastructure', 'slug', i.slug, {
      name: i.name,
      summary: i.summary,
      spaceType: i.spaceType,
      location: i.location,
      capacity: i.capacity,
      equipment: i.equipment.map((item) => ({ item })),
      description: richText(`${i.summary} Available to KNEST members.`),
    })
  }
  console.log(`✓ ${INFRASTRUCTURE.length} infrastructure spaces`)

  // The faqs collection has no slug field, so these are keyed on the question
  // text — which is unique here and is what an editor would search on anyway.
  for (const [n, f] of FAQS.entries()) {
    await upsertBy(payload, 'faqs', 'question', f.q, {
      question: f.q,
      answer: richText(f.a),
      order: n + 1,
    })
  }
  console.log(`✓ ${FAQS.length} FAQs`)

  /* ---- applications, so the staff queue has something to review ---- */

  const APPLICANTS = [
    { email: 'aditi.demo@knest.local', name: 'Aditi Sharma', program: 'ignition', status: 'submitted' as const },
    { email: 'rohit.demo@knest.local', name: 'Rohit Panda', program: 'ignition', status: 'under_review' as const },
    { email: 'fatima.demo@knest.local', name: 'Fatima Sheikh', program: 'build-sprint', status: 'shortlisted' as const },
    { email: 'karan.demo@knest.local', name: 'Karan Mehta', program: 'build-sprint', status: 'interview' as const },
    { email: 'lea.demo@knest.local', name: 'Lea Dash', program: 'ignition', status: 'accepted' as const },
    { email: 'sam.demo@knest.local', name: 'Samir Behera', program: 'build-sprint', status: 'rejected' as const },
    { email: 'nisha.demo@knest.local', name: 'Nisha Rao', program: 'ignition', status: 'waitlisted' as const },
  ]

  let created = 0
  for (const a of APPLICANTS) {
    const [user] = await db
      .insert(users)
      .values({
        email: a.email,
        name: `${a.name} ${DEMO_MARKER}`,
        platformRole: 'student',
        journeyStage: 'idea',
        onboardingCompletedAt: new Date(),
        emailVerified: new Date(),
      })
      .onConflictDoUpdate({ target: users.email, set: { name: `${a.name} ${DEMO_MARKER}` } })
      .returning()
    if (!user) continue

    const programId = Number(programIds.get(a.program))
    const existing = await db.select().from(applications).where(eq(applications.userId, user.id))
    const decided = ['accepted', 'rejected', 'waitlisted'].includes(a.status)
    const row = {
      userId: user.id,
      programId,
      status: a.status,
      submittedAt: new Date(Date.now() - 6 * 86_400_000),
      decisionAt: decided ? new Date(Date.now() - 86_400_000) : null,
      decisionNote: decided ? 'Reviewed by the admissions panel.' : null,
    }
    let applicationId: string
    if (existing.length > 0) {
      applicationId = existing[0]!.id
      await db.update(applications).set(row).where(eq(applications.id, applicationId))
    } else {
      const [ins] = await db.insert(applications).values(row).returning()
      if (!ins) continue
      applicationId = ins.id
      created += 1
    }

    for (const [questionId, value] of [
      ['idea', `A tool for ${a.name.split(' ')[0]}'s home district.`],
      ['why_you', 'I have lived with this problem for three years.'],
    ] as const) {
      await db
        .insert(applicationAnswers)
        .values({ applicationId, questionId, value: JSON.stringify(value) })
        .onConflictDoNothing()
    }
  }
  console.log(`✓ ${APPLICANTS.length} applications across 7 statuses (${created} new)`)

  console.log(
    '\nDemo content seeded. Nothing a visitor reads is marked; the demo ' +
      `applicant accounts carry "${DEMO_MARKER}" so they can be cleaned up.\n` +
      'Remove all of it with: pnpm db:seed:demo --clear',
  )
}

/** Removes only what this file created — matched on the marker, never a blanket truncate. */
export async function clearDemo() {
  const payload = await getPayload({ config })
  const slugs = [
    ['mentors', MENTORS.map((m) => m.slug)],
    ['partners', PARTNERS.map((p) => p.slug)],
    ['programs', PROGRAMS.map((p) => p.slug)],
    ['founders', FOUNDERS.map((f) => f.slug)],
    ['startups', STARTUPS.map((s) => s.slug)],
    ['events', EVENTS.map((e) => e.slug)],
    ['resources', RESOURCES.map((r) => r.slug)],
    ['infrastructure', INFRASTRUCTURE.map((i) => i.slug)],
  ] as const

  for (const [collection, list] of slugs) {
    const res = await payload.delete({
      collection: collection as never,
      where: { slug: { in: list as unknown as string[] } },
    })
    console.log(`✓ removed ${res.docs?.length ?? 0} from ${collection}`)
  }

  const demoUsers = await db.select().from(users)
  let removed = 0
  for (const u of demoUsers) {
    if (!u.name?.includes(DEMO_MARKER)) continue
    await db.delete(applications).where(eq(applications.userId, u.id))
    await db.delete(users).where(eq(users.id, u.id))
    removed += 1
  }
  const faqRes = await (payload.delete.bind(payload) as unknown as (a: unknown) => Promise<{ docs?: unknown[] }>)({
    collection: 'faqs',
    where: { question: { in: FAQS.map((f) => f.q) } },
  })
  console.log(`✓ removed ${faqRes.docs?.length ?? 0} from faqs`)
  console.log(`✓ removed ${removed} demo applicants and their applications`)
}
