import { beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.fn()
const findGlobal = vi.fn()
vi.mock('./payload-client', () => ({ getContentClient: async () => ({ find, findGlobal }) }))

import { listArticles, listFounderArticles } from './articles'
import { listEvents, listUpcomingEvents } from './events'
import { FALLBACK_HOMEPAGE, getHomepage } from './homepage'
import { HOMEPAGE_COPY } from './homepage-copy'
import { listMentors } from './mentors'
import { listPrograms } from './programs'
import { listFeaturedStartups, listStartups } from './startups'

const LISTS: [string, () => Promise<unknown[]>][] = [
  ['listStartups', () => listStartups()],
  ['listStartups (filtered)', () => listStartups({ stage: 'idea', sector: 'fintech' })],
  ['listFeaturedStartups', () => listFeaturedStartups()],
  ['listPrograms', () => listPrograms()],
  ['listPrograms (filtered)', () => listPrograms({ stage: 'mvp', status: 'open' })],
  ['listMentors', () => listMentors()],
  ['listEvents', () => listEvents()],
  ['listUpcomingEvents', () => listUpcomingEvents()],
  ['listUpcomingEvents (filtered)', () => listUpcomingEvents({ eventType: 'demo_day' })],
  ['listArticles', () => listArticles()],
  ['listFounderArticles', () => listFounderArticles()],
]

beforeEach(() => {
  find.mockReset()
  findGlobal.mockReset()
})

describe('public list functions never invent records (KN-01)', () => {
  it.each(LISTS)('%s returns [] when the CMS has no rows', async (_name, call) => {
    find.mockResolvedValue({ docs: [] })
    expect(await call()).toEqual([])
  })

  it.each(LISTS)('%s throws, rather than substituting data, when the CMS fails', async (_name, call) => {
    find.mockRejectedValue(new Error('database unavailable'))
    await expect(call()).rejects.toThrow('database unavailable')
  })

  it.each(LISTS)('%s returns exactly the rows the CMS returned', async (_name, call) => {
    find.mockResolvedValue({ docs: [{ id: 7, slug: 'real', name: 'Real', title: 'Real' }] })
    const out = (await call()) as { id: number }[]
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe(7)
  })

  it('all reads stay anonymous-scoped (overrideAccess:false), so drafts cannot leak', async () => {
    find.mockResolvedValue({ docs: [] })
    for (const [, call] of LISTS) await call()
    expect(find).toHaveBeenCalled()
    for (const [args] of find.mock.calls) expect(args.overrideAccess).toBe(false)
  })
})

describe('getHomepage', () => {
  it('serves the approved CONTENT_SPEC copy, and nothing else, when the global is empty', async () => {
    findGlobal.mockResolvedValue({})
    const home = await getHomepage()
    expect(home).toBe(FALLBACK_HOMEPAGE)
    expect(home.heroHeadline).toBe(HOMEPAGE_COPY.heroHeadline)
    expect(home.heroHeadline).toMatch(/ACTUALLY BUILT IT/)
  })

  it('serves the approved copy on failure, and logs the failure', async () => {
    findGlobal.mockRejectedValue(new Error('down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getHomepage()).toBe(FALLBACK_HOMEPAGE)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('prefers what staff have written in the CMS', async () => {
    findGlobal.mockResolvedValue({ heroHeadline: 'Edited by staff', sections: [] })
    expect((await getHomepage()).heroHeadline).toBe('Edited by staff')
  })

  it('approved copy contains no figures or funding claims', () => {
    const all = JSON.stringify(HOMEPAGE_COPY)
    expect(all).not.toMatch(/\d/)
    expect(all).not.toMatch(/capital|grant|credit|ranking/i)
  })
})
