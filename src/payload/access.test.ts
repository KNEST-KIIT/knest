import { describe, expect, it } from 'vitest'
import type { CollectionConfig, Field } from 'payload'
import { Articles } from './collections/articles'
import { Cohorts } from './collections/cohorts'
import { Events } from './collections/events'
import { Faqs } from './collections/faqs'
import { Founders } from './collections/founders'
import { Infrastructure } from './collections/infrastructure'
import { LabBookings } from './collections/lab-bookings'
import { Media } from './collections/media'
import { Mentors } from './collections/mentors'
import { Metrics } from './collections/metrics'
import { Partners } from './collections/partners'
import { Programs } from './collections/programs'
import { Resources } from './collections/resources'
import { Staff } from './collections/staff'
import { Startups } from './collections/startups'
import { Testimonials } from './collections/testimonials'
import type { StaffRole } from '@/server/auth/roles'

// Payload passes a rich args object; the access helpers only read req.user.
type Args = Parameters<NonNullable<CollectionConfig['access']>['read'] & ((a: never) => unknown)>[0]
const asArgs = (user: unknown) => ({ req: { user } }) as unknown as Args
const anon = asArgs(null)
const staff = (staffRole: StaffRole) => asArgs({ staffRole })

type ReadOutcome = 'denied' | 'published-only' | 'public'

async function anonymousRead(c: CollectionConfig): Promise<ReadOutcome> {
  const read = c.access?.read
  if (typeof read !== 'function') return 'denied'
  const r = await (read as (a: Args) => unknown)(anon)
  if (r === true) return 'public'
  if (r === false) return 'denied'
  return 'published-only'
}

function field(c: CollectionConfig, name: string): Field & { access?: { read?: (a: Args) => unknown } } {
  const f = c.fields.find((x) => 'name' in x && x.name === name)
  if (!f) throw new Error(`no field ${name} on ${c.slug}`)
  return f as Field & { access?: { read?: (a: Args) => unknown } }
}

describe('collection read policy (regression guard for KN-02 / NF-02)', () => {
  // Every new collection must be added here on purpose. A new `read: () => true`
  // shows up as a failing diff rather than a silent leak.
  const EXPECTED: Record<string, ReadOutcome> = {
    articles: 'published-only',
    cohorts: 'public',
    events: 'published-only',
    faqs: 'public',
    founders: 'published-only',
    infrastructure: 'published-only',
    'lab-bookings': 'denied',
    media: 'public',
    mentors: 'published-only',
    metrics: 'public',
    partners: 'published-only',
    programs: 'published-only',
    resources: 'published-only',
    staff: 'denied',
    startups: 'published-only',
    testimonials: 'public',
  }
  const ALL = [
    Articles, Cohorts, Events, Faqs, Founders, Infrastructure, LabBookings, Media,
    Mentors, Metrics, Partners, Programs, Resources, Staff, Startups, Testimonials,
  ]

  it('covers every collection', () => {
    expect(ALL.map((c) => c.slug).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  for (const c of ALL) {
    it(`anonymous read of ${c.slug} is ${EXPECTED[c.slug]}`, async () => {
      expect(await anonymousRead(c)).toBe(EXPECTED[c.slug])
    })
  }
})

describe('lab-bookings (KN-02)', () => {
  const read = LabBookings.access!.read as (a: Args) => unknown

  it('denies anonymous and non-lab staff', async () => {
    expect(await read(anon)).toBe(false)
    for (const r of ['reviewer', 'content_admin', 'program_manager', 'startup_manager', 'mentor_manager'] as StaffRole[]) {
      expect(await read(staff(r))).toBe(false)
    }
  })

  it('allows lab_admin and super_admin', async () => {
    expect(await read(staff('lab_admin'))).toBe(true)
    expect(await read(staff('super_admin'))).toBe(true)
  })

  it('also protects the identity fields individually', async () => {
    for (const name of ['userId', 'userEmail']) {
      const f = field(LabBookings, name)
      expect(typeof f.access?.read).toBe('function')
      expect(await f.access!.read!(anon)).toBe(false)
      expect(await f.access!.read!(staff('reviewer'))).toBe(false)
      expect(await f.access!.read!(staff('lab_admin'))).toBe(true)
    }
  })
})

describe('metrics.source (NF-02)', () => {
  it('is hidden from anonymous readers but visible to content staff', async () => {
    const f = field(Metrics, 'source')
    expect(await f.access!.read!(anon)).toBe(false)
    expect(await f.access!.read!(staff('content_admin'))).toBe(true)
  })
})
