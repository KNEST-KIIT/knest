import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAPTCHA, BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Closing evidence for the document-upload path of C-06 / KN-13: a real multipart
 * upload through the production build, stored through the application's real S3
 * client code (against an S3-compatible stub), read back by staff, refused for
 * everyone else. The stub proves the application stores and retrieves bytes; it
 * does not prove that AWS accepts the credentials.
 */

const stamp = Date.now()
const email = (n: string) => `${n}-${stamp}@docs.test`
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1')
const EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 this is not a pdf', 'latin1')

let staff: Session
let programSlug: string
let fileQuestionId: string

const upload = (applicationId: string, session: Session | null, file: { name: string; type: string; bytes: Buffer }, questionId = fileQuestionId) => {
  const form = new FormData()
  form.set('questionId', questionId)
  form.set('file', new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
  return fetch(`${BASE()}/api/applications/${applicationId}/documents`, {
    method: 'POST',
    headers: { 'x-forwarded-for': uniqueIp(), ...(session ? { cookie: session.cookie } : {}) },
    body: form,
  })
}
const post = (path: string, session: Session, body?: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), cookie: session.cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const storedObjects = () => {
  const dir = process.env.TEST_S3_DIR!
  if (!existsSync(dir)) return [] as string[]
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name))
      else out.push(path.relative(dir, path.join(d, e.name)).split(path.sep).join('/'))
    }
  }
  walk(dir)
  return out
}

async function startDraft(tag: string) {
  const mail = email(tag)
  const userId = await createUser({ email: mail, platformRole: 'student' })
  const me = (await login(mail))!
  const started = await post('/api/applications/start', me, { programSlug })
  const applicationId = (await started.json()).applicationId as string
  return { me, userId, applicationId }
}

beforeAll(async () => {
  await createUser({ email: email('staff'), platformRole: 'other', staffRole: 'program_manager' })
  staff = (await login(email('staff')))!
  const payload = await payloadClient()
  programSlug = `docs-program-${stamp}`
  const doc = await payload.create({
    collection: 'programs',
    data: {
      title: 'Document Program',
      slug: programSlug,
      tagline: 'Created by the document suite',
      whoItsFor: richText('Anyone'),
      stage: ['idea'],
      applicationStatus: 'open',
      applicationQuestions: [{ label: 'Upload your deck', fieldType: 'file', required: true }],
      _status: 'published',
    } as never,
    overrideAccess: true,
  })
  const full = (await payload.findByID({ collection: 'programs', id: doc.id, depth: 0, overrideAccess: true })) as {
    applicationQuestions: { id: string }[]
  }
  fileQuestionId = full.applicationQuestions[0]!.id
})
afterAll(closeDb)

describe('uploading an application document', () => {
  it('stores a real PDF in object storage and lets staff download exactly those bytes', async () => {
    const { me, applicationId } = await startDraft('happy')
    const res = await upload(applicationId, me, { name: 'résumé "deck".pdf', type: 'application/pdf', bytes: PDF })
    expect(res.status).toBe(200)

    const row = (await db().query('select storage_key, file_name, mime_type, file_size from app.application_documents where application_id = $1', [applicationId])).rows[0]
    expect(row.mime_type).toBe('application/pdf')
    expect(row.file_size).toBe(PDF.length)
    expect(storedObjects()).toContain(row.storage_key)
    expect(readFileSync(path.join(process.env.TEST_S3_DIR!, ...String(row.storage_key).split('/'))).equals(PDF)).toBe(true)

    const download = await get(`/api/admin/applications/${applicationId}/documents/${fileQuestionId}`, staff)
    expect(download.status).toBe(200)
    expect(Buffer.from(await download.arrayBuffer()).equals(PDF)).toBe(true)
    expect(download.headers.get('x-content-type-options')).toBe('nosniff')
    const disposition = download.headers.get('content-disposition') ?? ''
    expect(disposition).toMatch(/^attachment; filename="[\w. -]+"/)
    expect(disposition).not.toMatch(/[\r\n]/)
  })

  it('refuses a file whose bytes are not what its type claims, and stores nothing', async () => {
    const { me, applicationId } = await startDraft('spoof')
    const before = storedObjects().length
    const spoofed = await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: EXE })
    expect(spoofed.status).toBe(400)
    const wrongType = await upload(applicationId, me, { name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('hello') })
    expect(wrongType.status).toBe(400)
    expect(storedObjects().length).toBe(before)
    expect((await db().query('select count(*)::int c from app.application_documents where application_id = $1', [applicationId])).rows[0].c).toBe(0)
  })

  it('accepts a file of exactly 10 MB (the proxy must not truncate it)', async () => {
    const { me, applicationId } = await startDraft('exact')
    const exact = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 - PDF.length)])
    expect(exact.length).toBe(10 * 1024 * 1024)
    const res = await upload(applicationId, me, { name: 'exact.pdf', type: 'application/pdf', bytes: exact })
    expect(res.status, JSON.stringify(await res.clone().json().catch(() => ({})))).toBe(200)
    const row = (await db().query('select file_size from app.application_documents where application_id = $1', [applicationId])).rows[0]
    expect(row.file_size).toBe(10 * 1024 * 1024)
  })

  it('refuses a file over 10 MB before reading it', async () => {
    const { me, applicationId } = await startDraft('big')
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 + 1)])
    const res = await upload(applicationId, me, { name: 'big.pdf', type: 'application/pdf', bytes: big })
    expect(res.status).toBe(413)
  })

  it('does not accept uploads for someone else’s application, anonymously, or after submission', async () => {
    const owner = await startDraft('owner')
    const stranger = await startDraft('stranger')
    const before = storedObjects().length
    expect((await upload(owner.applicationId, stranger.me, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })).status).toBe(403)
    expect([401, 403]).toContain((await upload(owner.applicationId, null, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })).status)
    expect(storedObjects().length).toBe(before)

    expect((await upload(owner.applicationId, owner.me, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })).status).toBe(200)
    expect((await post(`/api/applications/${owner.applicationId}/submit`, owner.me, CAPTCHA)).status).toBe(200)
    const late = await upload(owner.applicationId, owner.me, { name: 'late.pdf', type: 'application/pdf', bytes: PDF })
    expect(late.status).toBe(400)
    expect((await late.json()).error).toMatch(/already been submitted/i)
  })

  it('does not let students or anonymous callers download documents', async () => {
    const { me, applicationId } = await startDraft('dl')
    await upload(applicationId, me, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })
    for (const who of [me, null]) {
      const res = await fetch(`${BASE()}/api/admin/applications/${applicationId}/documents/${fileQuestionId}`, {
        headers: who ? { cookie: who.cookie } : {},
      })
      expect([401, 403, 404]).toContain(res.status)
    }
  })
})
