/**
 * Review fixtures — populated states, for looking at. Never for shipping.
 *
 * `src/db/seed.ts` deliberately creates no content (spec §46: no invented
 * startups, mentors, metrics or partnerships, because fabricated demo data
 * makes the first real cohort indistinguishable from fiction). That is the
 * right call for the product, and it stays.
 *
 * It does mean the populated state of every listing, card and detail page is
 * unreviewable by default — you can only ever see the empty states, which is
 * how a grid gets shipped without anyone having seen three cards next to each
 * other. This creates a set through the CMS API, tags every record with a
 * recognisable marker, and removes all of it again.
 *
 *   node scripts/qa-fixtures.mjs create
 *   node scripts/qa-fixtures.mjs destroy
 *
 * Everything it writes is published content in the CMS, so run it against a
 * development database only. `destroy` is exhaustive by design: it deletes
 * every record whose slug carries the marker, so a half-finished `create` is
 * always recoverable.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const PASSWORD = process.env.SEED_PASSWORD ?? 'knest-dev-password'
const MARKER = 'qa-fixture'

const rich = (text) => ({
  root: {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', text, version: 1 }], version: 1 },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

let cookie = ''

async function login() {
  const res = await fetch(`${BASE}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@knest.local', password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`)
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  if (!cookie) throw new Error('login returned no cookie')
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 400) } }
  return { ok: res.ok, status: res.status, json }
}

async function create(collection, docs) {
  for (const doc of docs) {
    const { ok, status, json } = await api('POST', `/api/${collection}`, { ...doc, _status: 'published' })
    // Mentors have both `name` and `title` ('Co-founder'); the name is the label.
    const name = doc.name ?? doc.title
    if (ok) console.log(`  + ${collection}: ${name}`)
    else console.error(`  ! ${collection}: ${name} -> ${status} ${JSON.stringify(json.errors ?? json).slice(0, 300)}`)
  }
}

async function destroy() {
  for (const collection of ['programs', 'startups', 'events', 'resources', 'mentors', 'partners']) {
    const { json } = await api('GET', `/api/${collection}?limit=100&depth=0&draft=true`)
    const doomed = (json.docs ?? []).filter((d) => (d.slug ?? '').includes(MARKER))
    for (const d of doomed) {
      const { ok } = await api('DELETE', `/api/${collection}/${d.id}`)
      console.log(`  ${ok ? '-' : '!'} ${collection}: ${d.title ?? d.name}`)
    }
    if (doomed.length === 0) console.log(`  · ${collection}: nothing to remove`)
  }
}

const DAY = 86_400_000
const soon = (days) => new Date(Date.now() + days * DAY).toISOString()

async function main() {
  await login()
  const mode = process.argv[2]

  if (mode === 'destroy') {
    console.log('Removing review fixtures…')
    await destroy()
    return
  }
  if (mode !== 'create') {
    console.error('usage: node scripts/qa-fixtures.mjs create|destroy')
    process.exitCode = 1
    return
  }

  // Idempotent: slugs are unique, so a re-run over a partial set would fail
  // on everything that already landed. Clear the marked records first.
  console.log('Clearing any existing review fixtures…')
  await destroy()
  console.log('\nCreating review fixtures…')

  await create('programs', [
    {
      title: 'Ignite Pre-Incubation',
      slug: `ignite-${MARKER}`,
      tagline: 'Eight weeks to find out whether the problem you noticed is worth solving.',
      whoItsFor: rich('First- and second-year students with a question rather than a plan.'),
      stage: ['exploring', 'idea'],
      sector: ['deeptech', 'consumer'],
      format: 'in_person',
      applicationStatus: 'open',
      applicationDeadline: soon(21),
      duration: '8 weeks',
      commitment: '6 hours a week',
    },
    {
      title: 'Build Sprint',
      slug: `build-sprint-${MARKER}`,
      tagline: 'Ship something real to ten users who did not have to be polite to you.',
      whoItsFor: rich('Teams with a validated problem and no product yet.'),
      stage: ['mvp'],
      sector: ['saas'],
      format: 'hybrid',
      applicationStatus: 'open',
      applicationDeadline: soon(9),
      duration: '12 weeks',
      commitment: '15 hours a week',
    },
    {
      title: 'Venture Track',
      slug: `venture-track-${MARKER}`,
      tagline: 'For companies with revenue, deciding how far this can actually go.',
      whoItsFor: rich('Incorporated startups with paying customers.'),
      stage: ['scaling'],
      sector: ['deeptech'],
      format: 'online',
      applicationStatus: 'closed',
      duration: '6 months',
      commitment: 'Full time',
    },
  ])

  await create('startups', [
    {
      name: 'Kalinga Diagnostics',
      slug: `kalinga-${MARKER}`,
      tagline: 'Point-of-care blood screening for rural primary health centres.',
      stage: 'scaling',
      sector: ['deeptech'],
      foundedYear: 2023,
    },
    {
      name: 'Tiffin Route',
      slug: `tiffin-route-${MARKER}`,
      tagline: 'Ordering and delivery logistics for the hostel tiffin network.',
      stage: 'mvp',
      sector: ['consumer'],
      foundedYear: 2024,
    },
    {
      name: 'Loom Ledger',
      slug: `loom-ledger-${MARKER}`,
      tagline: 'Provenance tracking for Odisha handloom cooperatives.',
      stage: 'idea',
      sector: ['saas'],
      foundedYear: 2025,
    },
  ])

  await create('events', [
    {
      title: 'Founder Office Hours',
      slug: `office-hours-${MARKER}`,
      summary: 'Twenty minutes with someone who has already made the mistake you are about to make.',
      startsAt: soon(4),
      endsAt: soon(4.1),
      location: 'KNEST Studio, Campus 12',
      capacity: 24,
      eventType: 'office_hours',
    },
    {
      title: 'Demo Night',
      slug: `demo-night-${MARKER}`,
      summary: 'Six teams, six minutes each, and a room full of people who will tell you the truth.',
      startsAt: soon(18),
      endsAt: soon(18.2),
      location: 'Auditorium, Campus 6',
      capacity: 200,
      eventType: 'demo_day',
    },
  ])

  await create('resources', [
    {
      title: 'Talking to your first ten users',
      slug: `first-ten-users-${MARKER}`,
      summary: 'How to run a customer conversation that gives you something other than encouragement.',
      format: 'guide',
      stages: ['idea', 'mvp'],
      body: rich('Ask about what they did last week, not what they would do next month.'),
    },
    {
      title: 'Incorporation, in plain terms',
      slug: `incorporation-${MARKER}`,
      summary: 'What a private limited company actually requires, and when it is too early to bother.',
      format: 'guide',
      stages: ['scaling'],
      body: rich('You do not need a company to have a customer.'),
    },
    {
      title: 'The one-page problem brief',
      slug: `problem-brief-${MARKER}`,
      summary: 'A template for stating a problem clearly enough that someone can disagree with it.',
      format: 'template',
      stages: ['exploring', 'idea'],
      body: rich('If nobody can disagree with your problem statement, it is not a problem statement.'),
    },
  ])

  await create('mentors', [
    {
      name: 'Ananya Mohanty',
      slug: `ananya-${MARKER}`,
      title: 'Co-founder',
      organization: 'Kalinga Diagnostics',
      expertise: ['fundraising', 'gtm'],
      sectors: ['deeptech'],
      availability: 'limited',
    },
    {
      name: 'Rahul Sethi',
      slug: `rahul-${MARKER}`,
      title: 'Engineering lead',
      organization: 'Independent',
      expertise: ['product', 'hiring'],
      sectors: ['saas'],
      availability: 'open',
    },
  ])

  await create('partners', [
    { name: 'KIIT School of Technology', slug: `kiit-tech-${MARKER}`, type: 'academic' },
    { name: 'Odisha Startup Mission', slug: `osm-${MARKER}`, type: 'government' },
  ])

  console.log('\nDone. Remove with: node scripts/qa-fixtures.mjs destroy')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
