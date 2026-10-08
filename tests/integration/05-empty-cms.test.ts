import { afterAll, describe, expect, it } from 'vitest'
import {
  ARTICLES_EMPTY,
  EVENTS_EMPTY,
  MENTORS_EMPTY,
  PROGRAMS_EMPTY,
  RESOURCES_EMPTY,
  STARTUPS_EMPTY,
} from '@/lib/empty-state-copy'
import { closeDb, get } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Closing evidence for KN-01: an EMPTY CMS (the real launch state) renders each
 * list page's honest empty state, and nothing invented, from the production
 * build backed by a real, migrated, empty database. This file must run first.
 */

const FABRICATED = [
  'Hostel Dorm',
  'Ignite Ideation',
  'Validation Bootcamp',
  'MVP Builders',
  'Scale-Up Fellowship',
  'AeroDrive',
  'FinFlow',
  'Sarah Chen',
  'Scale AI',
  'Rajiv Menon',
  'Indic Capital',
  'Alok Verma',
  'Winter 2026 Demo Day',
  'Founders Mixer',
  'KNEST Investment Desk',
  'MOST DANGEROUS',
  'CAPITAL IS WAITING',
  'Campus Labs',
  'KNEST Guarantee',
  'Top Tier',
]

const PAGES: [string, string][] = [
  ['/programs', PROGRAMS_EMPTY.heading],
  ['/startups', STARTUPS_EMPTY.heading],
  ['/mentors', MENTORS_EMPTY.heading],
  ['/events', EVENTS_EMPTY.heading],
  ['/resources', RESOURCES_EMPTY.heading],
  ['/blog', ARTICLES_EMPTY.heading],
]

afterAll(closeDb)

describe('empty CMS: the database really is empty', () => {
  it('has no published content rows', async () => {
    const payload = await payloadClient()
    for (const collection of ['programs', 'startups', 'mentors', 'events', 'resources', 'articles'] as const) {
      const r = await payload.find({ collection, overrideAccess: true, limit: 1 })
      expect(r.totalDocs, collection).toBe(0)
    }
  })
})

describe('empty CMS: public pages (KN-01)', () => {
  it.each(PAGES)('%s shows its honest empty state', async (path, heading) => {
    const res = await get(path)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain(heading)
  })

  it.each([...PAGES.map(([p]) => p), '/', '/about', '/ecosystem', '/invest', '/search?q=a'])(
    '%s contains no fabricated record or unapproved claim',
    async (path) => {
      const html = await (await get(path)).text()
      for (const phrase of FABRICATED) expect(html, `${path} contains "${phrase}"`).not.toContain(phrase)
    },
  )

  it('the former fallback slugs are not pages', async () => {
    for (const slug of ['ignite-ideation', 'mvp-builders']) {
      const html = await (await get(`/programs/${slug}`)).text()
      expect(html).not.toContain('Ignite Ideation')
      expect(html).not.toContain('MVP Builders')
    }
    const startup = await get('/startups/aerodrive')
    expect(await startup.text()).not.toContain('AeroDrive')
  })

  it('the homepage serves the approved spec copy and an honest empty journey', async () => {
    const html = await (await get('/')).text()
    expect(html).toContain('ACTUALLY BUILT IT')
    expect(html).toContain('Programs for this stage are being built.')
    expect(html).not.toContain('Programs could not be loaded')
  })

  it('the navigation no longer links to the blog', async () => {
    const html = await (await get('/')).text()
    expect(html).not.toContain('href="/blog"')
  })
})

describe('the same pages are driven by the database, not by constants', () => {
  it('publishing a real program makes it appear', async () => {
    const payload = await payloadClient()
    await payload.create({
      collection: 'programs',
      data: {
        title: 'Integration Test Program',
        slug: 'integration-test-program',
        tagline: 'Created by the integration suite',
        whoItsFor: richText('Anyone'),
        stage: ['idea'],
        applicationStatus: 'open',
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    const html = await (await get('/programs')).text()
    expect(html).toContain('Integration Test Program')
    expect(html).not.toContain(PROGRAMS_EMPTY.heading)
  })
})
