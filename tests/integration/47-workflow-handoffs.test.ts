import { afterAll, describe, expect, it } from 'vitest'
import { BASE, CAPTCHA, PASSWORD, closeDb, createUser, db, decodeMailText, get, login, readMail, uniqueIp } from '../support/helpers'
import { EXPERTISE_OPTIONS } from '../../src/payload/fields/taxonomy'

const stamp = Date.now()
const post = (path: string, body: unknown) => fetch(`${BASE()}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() }, body: JSON.stringify({ ...CAPTCHA, ...body as object }),
})
const latestLink = (email: string, kind: string) => {
  const mail = readMail().filter((m) => m.to.some((to) => to.includes(email))).at(-1)
  const text = mail ? decodeMailText(mail.body) : ''
  const link = text.match(new RegExp(`https?://[^\\s]+/${kind}/confirm\\?[^\\s]+`))?.[0]
  expect(link).toBeTruthy()
  return new URL(link!)
}
afterAll(closeDb)

describe('remaining workflow handoffs', () => {
  it('preserves profile fields that are not edited during reopened onboarding', async () => {
    const email = `profile-retention-${stamp}@journey.test`
    const id = await createUser({ email, platformRole: 'student' })
    await db().query('update app.users set skills=$1, graduation_year=2028, years_of_experience=7 where id=$2', [['Research', 'Prototyping'], id])
    const who = (await login(email))!
    const step = (kind: string, data: unknown) => fetch(`${BASE()}/api/onboarding/step`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: who.cookie, 'x-forwarded-for': uniqueIp() }, body: JSON.stringify({ step: kind, data }),
    })
    expect((await step('profile', { name: 'Fictional Updated Student', school: 'Fictional Engineering', linkedinUrl: '', bio: 'Testing a return visit.' })).status).toBe(200)
    const profile = (await db().query('select name, skills, graduation_year from app.users where id=$1', [id])).rows[0]
    expect(profile).toEqual({ name: 'Fictional Updated Student', skills: ['Research', 'Prototyping'], graduation_year: 2028 })
    expect((await step('role', { platformRole: 'mentor' })).status).toBe(200)
    expect((await step('mentor-profile', { name: 'Fictional Updated Mentor', organization: 'Local review', expertiseAreas: [EXPERTISE_OPTIONS[0]!.value], mentorAvailability: 'open', linkedinUrl: '' })).status).toBe(200)
    expect((await db().query('select years_of_experience from app.users where id=$1', [id])).rows[0].years_of_experience).toBe(7)
  })
  it('preserves the requested destination on resent verification and rejects foreign destinations', async () => {
    const email = `resend-context-${stamp}@journey.test`
    expect((await post('/api/auth/password/signup', { email, name: 'Fictional Journey', password: PASSWORD, next: '/events/local-demo' })).status).toBe(202)
    expect(latestLink(email, 'verify').searchParams.get('next')).toBe('/events/local-demo')
    expect((await post('/api/auth/password/verify/send', { email, next: '/apply/local-demo' })).status).toBe(200)
    expect(latestLink(email, 'verify').searchParams.get('next')).toBe('/apply/local-demo')
    expect((await post('/api/auth/password/verify/send', { email, next: '//outside.example' })).status).toBe(200)
    expect(latestLink(email, 'verify').searchParams.has('next')).toBe(false)
  })

  it('keeps recovery context, revokes the old session and permits login with the new password', async () => {
    const email = `recovery-context-${stamp}@journey.test`
    await createUser({ email, platformRole: 'student' })
    const previous = (await login(email))!
    expect((await post('/api/auth/password/reset/request', { email, next: '/events/local-demo' })).status).toBe(200)
    const link = latestLink(email, 'reset')
    expect(link.searchParams.get('next')).toBe('/events/local-demo')
    const html = await (await get(`${link.pathname}${link.search}`)).text()
    expect(html).toMatch(/<form[^>]*method="post"/)
    expect(html).toMatch(/<fieldset[^>]*disabled/)
    const password = `${PASSWORD}-recovered`
    expect((await post('/api/auth/password/reset/confirm', { email, token: link.searchParams.get('token'), password })).status).toBe(200)
    expect((await get('/dashboard', previous)).status).toBeGreaterThanOrEqual(300)
    expect((await post('/api/auth/password/login', { email, password })).status).toBe(200)
    expect((await (await get('/login?reset=success&next=%2Fevents%2Flocal-demo')).text())).toContain('Your password is updated.')
  })

  it('keeps sensitive forms inert before hydration and uses POST rather than URL fields', async () => {
    for (const path of ['/signup', '/reset']) {
      const html = await (await get(path)).text()
      expect(html).toMatch(/<form[^>]*method="post"/)
      expect(html).toMatch(/<fieldset[^>]*disabled/)
    }
  })

  it('gives the CMS one document and only the appropriate staff shortcuts', async () => {
    const email = `editor-context-${stamp}@journey.test`
    await createUser({ email, staffRole: 'content_admin' })
    const editor = (await login(email))!
    const html = await (await get('/admin', editor)).text()
    expect((html.match(/<html(?:\s|>)/g) ?? []).length).toBe(1)
    expect((html.match(/<body(?:\s|>)/g) ?? []).length).toBe(1)
    expect(html).toContain('Content management')
    expect(html).toContain('Read enquiries')
    expect(html).not.toContain('Manage member access')
    expect(html).not.toContain('Add a startup')
  })
})
