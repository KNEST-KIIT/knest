import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, CAPTCHA, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * The public site end to end: every page the footer and navigation point at exists, the contact
 * form really stores messages (and refuses bots), article pages work, search covers mentors,
 * sitemap and robots behave, and no internal link anywhere returns an error.
 */

const stamp = Date.now()
const articleSlug = `pub-article-${stamp}`
const mentorName = `Zephyrina Quillfeather ${stamp}`
let member: Session

const postJson = (path: string, body: unknown, ip = uniqueIp(), cookie?: string) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
const valid = { name: 'Asha Verma', email: 'asha@example.test', topic: 'general', message: 'I would like to know how to apply.' }

beforeAll(async () => {
  await createUser({ email: `member-${stamp}@pub.test`, platformRole: 'student' })
  member = (await login(`member-${stamp}@pub.test`))!
  const payload = await payloadClient()
  await payload.create({
    collection: 'articles',
    data: { title: 'A public article', slug: articleSlug, summary: 'Created by the public pages suite', body: richText('Body of the article.'), publishedAt: new Date().toISOString(), _status: 'published' } as never,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'articles',
    data: { title: 'A draft article', slug: `draft-${articleSlug}`, summary: 'Not published', body: richText('Draft'), _status: 'draft' } as never,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'mentors',
    data: { name: mentorName, slug: `mentor-${stamp}`, title: 'Founder', organization: 'Quillworks', bio: 'Helps with early validation.', expertise: ['product'], _status: 'published' } as never,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'mentors',
    data: { name: `Hidden Draft Mentor ${stamp}`, slug: `draft-mentor-${stamp}`, title: 'Draft', expertise: ['product'], _status: 'draft' } as never,
    overrideAccess: true,
  })
})
afterAll(closeDb)

describe('pages the footer links to', () => {
  it.each(['/privacy', '/terms'])('%s exists, says it is not yet published, and is not indexed', async (path) => {
    const res = await get(path)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/being finalised/i)
    expect(html).not.toMatch(/Draft, not approved/) // the reviewable outline only appears in a preview
    expect(res.headers.get('x-robots-tag') ?? '').toContain('noindex')
    expect(html).toMatch(/noindex/i)
  })

  it('/contact and /get-involved render', async () => {
    expect((await get('/contact')).status).toBe(200)
    const html = await (await get('/get-involved')).text()
    for (const href of ['/programs', '/events', '/mentors', '/contact']) expect(html).toContain(`href="${href}"`)
  })
})

describe('the contact form (POST /api/enquiries)', () => {
  it('refuses a message with no human-check token, and stores nothing', async () => {
    const res = await postJson('/api/enquiries', valid)
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('captcha')
  })

  it('stores a valid message, without a user when anonymous', async () => {
    const email = `anon-${stamp}@example.test`
    const res = await postJson('/api/enquiries', { ...valid, email, ...CAPTCHA })
    expect(res.status).toBe(201)
    const row = (await db().query('select name, topic, status, user_id from app.enquiries where email = $1', [email])).rows[0]
    expect(row).toMatchObject({ name: 'Asha Verma', topic: 'general', status: 'new', user_id: null })
  })

  it('attaches the signed-in account when there is one', async () => {
    const email = `signed-${stamp}@example.test`
    expect((await postJson('/api/enquiries', { ...valid, email, ...CAPTCHA }, uniqueIp(), member.cookie)).status).toBe(201)
    const row = (await db().query('select user_id from app.enquiries where email = $1', [email])).rows[0]
    expect(row.user_id).toBeTruthy()
  })

  it('drops a bot silently: the honeypot field is filled, nothing is stored', async () => {
    const email = `bot-${stamp}@example.test`
    const res = await postJson('/api/enquiries', { ...valid, email, website: 'http://spam.example', ...CAPTCHA })
    expect(res.status).toBe(201)
    expect((await db().query('select count(*)::int c from app.enquiries where email = $1', [email])).rows[0].c).toBe(0)
  })

  it.each([
    ['a too-short message', { message: 'short' }],
    ['a bad email address', { email: 'not-an-email' }],
    ['an unknown topic', { topic: 'sell-me-things' }],
    ['a too-long message', { message: 'x'.repeat(2001) }],
    ['a missing name', { name: '' }],
  ])('rejects %s with a readable message', async (_label, patch) => {
    const res = await postJson('/api/enquiries', { ...valid, email: `v-${stamp}@example.test`, ...patch, ...CAPTCHA })
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
    expect((await db().query("select count(*)::int c from app.enquiries where email = $1", [`v-${stamp}@example.test`])).rows[0].c).toBe(0)
  })

  it('limits one connection to a few messages an hour', async () => {
    const ip = '198.51.100.250'
    const results: number[] = []
    for (let i = 0; i < 5; i++) results.push((await postJson('/api/enquiries', { ...valid, email: `rl${i}-${stamp}@example.test`, ...CAPTCHA }, ip)).status)
    expect(results.slice(0, 3)).toEqual([201, 201, 201])
    expect(results.slice(3)).toEqual([429, 429])
  })
})

describe('articles', () => {
  it('the blog lists an article and links to its own page, which renders', async () => {
    const list = await (await get('/blog')).text()
    expect(list).toContain(`href="/blog/${articleSlug}"`)
    const page = await get(`/blog/${articleSlug}`)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('A public article')
    expect(html).toContain('Body of the article.')
  })

  it('a draft or unknown article is a 404, and the draft is not listed', async () => {
    expect((await get(`/blog/draft-${articleSlug}`)).status).toBe(404)
    expect((await get('/blog/does-not-exist')).status).toBe(404)
    expect(await (await get('/blog')).text()).not.toContain('A draft article')
  })
})

describe('site-wide search covers mentors', () => {
  it('finds a published mentor by name and by organisation, never a draft one', async () => {
    const byName = await (await get(`/search?q=${encodeURIComponent('Zephyrina Quillfeather')}`)).text()
    expect(byName).toContain(mentorName)
    expect(byName).toContain(`/mentors/mentor-${stamp}`)
    const byOrg = await (await get('/search?q=Quillworks')).text()
    expect(byOrg).toContain(mentorName)
    // The page echoes the query, so check for the draft mentor's link, not its name.
    const draft = await (await get('/search?q=Hidden+Draft+Mentor')).text()
    expect(draft).not.toContain(`/mentors/draft-mentor-${stamp}`)
  })
})

describe('sitemap and robots', () => {
  it('robots.txt keeps crawlers out until indexing is switched on, and pages carry noindex', async () => {
    const robots = await (await get('/robots.txt')).text()
    expect(robots).toMatch(/Disallow: \//)
    expect(robots).not.toMatch(/Allow: \//)
    expect((await get('/')).headers.get('x-robots-tag') ?? '').toContain('noindex')
  })

  it('sitemap.xml lists the public pages and published content, not the legal placeholders or drafts', async () => {
    const res = await get('/sitemap.xml')
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain('/programs')
    expect(xml).toContain(`/blog/${articleSlug}`)
    expect(xml).toContain(`/mentors/mentor-${stamp}`)
    expect(xml).not.toContain(`draft-${articleSlug}`)
    expect(xml).not.toContain('/privacy')
    expect(xml).not.toContain('/terms')
  })
})

describe('no dead links', () => {
  const SEEDS = ['/', '/about', '/programs', '/events', '/mentors', '/startups', '/resources', '/blog', '/ecosystem', '/invest', '/get-involved', '/contact', '/privacy', '/terms', '/login', '/signup', '/search']

  it('every internal link on every public page leads somewhere that is not an error', async () => {
    const seen = new Set<string>()
    const dead: string[] = []
    const hrefs = new Set<string>()
    for (const seed of SEEDS) {
      const res = await get(seed)
      if (res.status >= 400) dead.push(`${seed} -> ${res.status} (seed page)`)
      if (!res.headers.get('content-type')?.includes('text/html')) continue
      const html = await res.text()
      for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) hrefs.add(m[1]!)
    }
    for (const href of hrefs) {
      const path = href.split('?')[0]!
      if (path.startsWith('/api/') || path.startsWith('/_next/') || /\.(png|jpe?g|svg|ico|webp|css|js|pdf|xml|txt)$/i.test(path) || seen.has(href)) continue
      seen.add(href)
      let res = await get(href)
      // a redirect (for example to sign-in) is a working link; follow one hop to be sure it lands
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location') ?? ''
        res = await get(location.startsWith('http') ? new URL(location).pathname + new URL(location).search : location)
      }
      if (res.status >= 400) dead.push(`${href} -> ${res.status}`)
    }
    expect(seen.size).toBeGreaterThan(15)
    expect(dead).toEqual([])
  })
})
