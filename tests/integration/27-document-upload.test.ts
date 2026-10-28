import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAPTCHA, BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'
import { EICAR_SIGNATURE } from '../support/eicar'
import { payloadClient, richText } from '../support/payload'

/**
 * The document pipeline end to end, through the production build: a real multipart upload lands in the QUARANTINE
 * bucket and waits as `pending` (423 on every read, no submission); a verdict bound to the exact bucket, key and
 * version promotes it to the separate CLEAN bucket; every other outcome is a rejection; forged, stale, duplicated and
 * contradictory verdicts change nothing they should not.
 *
 * The verdicts come from the GuardDuty event-source stand-in (tests/support/guardduty-simulator.ts), which tags the
 * quarantine version and queues an EventBridge-shaped result. It is a test double: these tests prove the
 * application's handling of verdicts, never that malware is detected. Real detection is proven only by the hosted
 * drill (scripts/ops/malware-protection-drill.mjs) against the real quarantine bucket.
 */

const stamp = Date.now()
const email = (n: string) => `${n}-${stamp}@docs.test`
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1')
const pdfWith = (text: string) => Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`, 'latin1')
const EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 this is not a pdf', 'latin1')
const S3 = () => process.env.TEST_S3_ENDPOINT!
const QUARANTINE = () => process.env.TEST_QUARANTINE_BUCKET!
const SIM = () => process.env.TEST_SIM_URL!
const QUEUE = () => process.env.TEST_SCAN_QUEUE!

let staff: Session
let programSlug: string
let fileQuestionId: string
let optionalQuestionId: string

type Row = {
  id: string
  scan_status: string
  scan_result: string | null
  scan_reasons: string[] | null
  scan_event_id: string | null
  scan_decided_at: Date | null
  storage_key: string
  quarantine_bucket: string | null
  quarantine_key: string | null
  quarantine_version_id: string | null
  quarantine_etag: string | null
  clean_version_id: string | null
  sha256: string | null
  file_size: number
}

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
const post = (p: string, session: Session, body?: unknown) =>
  fetch(`${BASE()}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), cookie: session.cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const del = (p: string, session: Session) => fetch(`${BASE()}${p}`, { method: 'DELETE', headers: { 'x-forwarded-for': uniqueIp(), cookie: session.cookie } })
const sim = (p: string, body?: unknown) =>
  fetch(`${SIM()}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json() as Promise<Record<string, unknown>>)

const walk = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const recurse = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) recurse(path.join(d, e.name))
      else out.push(path.relative(dir, path.join(d, e.name)).split(path.sep).join('/'))
    }
  }
  recurse(dir)
  return out
}
const cleanObjects = () => walk(process.env.TEST_S3_DIR!)
const quarantineObjects = () => walk(process.env.TEST_QUARANTINE_DIR!)
const versionsOf = async (bucket: string, key: string) =>
  (await (await fetch(`${S3()}/__stub/versions?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`)).json()) as { versionId: string; deleteMarker: boolean; tags: Record<string, string>; sse: string | null; kmsKeyId: string | null; checksumSha256: string | null }[]
const queueState = async () =>
  (await (await fetch(`${process.env.TEST_SQS_ENDPOINT}/__stub/queue?name=${QUEUE()}`)).json()) as { visible: number; inFlight: number; total: number; messages: { body: string; receiveCount: number; visible: boolean }[] }

const row = async (applicationId: string): Promise<Row> =>
  (await db().query('select * from app.application_documents where application_id = $1', [applicationId])).rows[0] as Row

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean, ms = 20_000): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await read()
    if (done(value) || Date.now() > deadline) return value
    await new Promise((r) => setTimeout(r, 100))
  }
}
const settled = (applicationId: string) => until(() => row(applicationId), (r) => r?.scan_status !== 'pending')

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
      applicationQuestions: [
        { label: 'Upload your deck', fieldType: 'file', required: true },
        { label: 'Optional appendix', fieldType: 'file', required: false },
      ],
      _status: 'published',
    } as never,
    overrideAccess: true,
  })
  const full = (await payload.findByID({ collection: 'programs', id: doc.id, depth: 0, overrideAccess: true })) as {
    applicationQuestions: { id: string }[]
  }
  fileQuestionId = full.applicationQuestions[0]!.id
  optionalQuestionId = full.applicationQuestions[1]!.id
  await sim('/config', { hold: false, tagging: 'on', tagDelayMs: 0 })
})
afterAll(async () => {
  await sim('/config', { hold: false, tagging: 'on', tagDelayMs: 0 }).catch(() => undefined)
  await closeDb()
})

describe('an upload waits in quarantine until its verdict is applied', () => {
  it('stores the bytes in quarantine only, bound to the exact version, and refuses every read while pending', async () => {
    await sim('/config', { hold: true })
    try {
      const { me, applicationId } = await startDraft('pending')
      const before = cleanObjects().length
      const res = await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      expect(res.status).toBe(202)
      expect(await res.json()).toEqual({ ok: true, scanStatus: 'pending' })

      const r = await row(applicationId)
      expect(r.scan_status).toBe('pending')
      expect(r.quarantine_bucket).toBe(QUARANTINE())
      expect(r.quarantine_key).toBe(r.storage_key)
      expect(r.quarantine_version_id).toBeTruthy()
      expect(r.quarantine_etag).toBeTruthy()
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(r.clean_version_id).toBeNull()
      expect(quarantineObjects()).toContain(r.storage_key)
      expect(cleanObjects().length).toBe(before)
      expect(cleanObjects()).not.toContain(r.storage_key)

      // The upload was written encrypted with the customer-managed key and carried a SHA-256 S3 verifies on receipt.
      const [version] = await versionsOf(QUARANTINE(), r.storage_key)
      expect(version!.versionId).toBe(r.quarantine_version_id)
      expect(version!.sse).toBe('aws:kms')
      expect(version!.kmsKeyId).toBe(process.env.TEST_KMS_KEY_ARN)
      expect(Buffer.from(version!.checksumSha256!, 'base64').toString('hex')).toBe(r.sha256)

      const path = `/api/applications/${applicationId}/documents/${fileQuestionId}`
      const owner = await get(path, me)
      expect(owner.status).toBe(423)
      expect(owner.headers.get('retry-after')).toBeTruthy()
      expect((await owner.json()).scanStatus).toBe('pending')
      const status = await (await get(`${path}/status`, me)).json()
      expect(status).toMatchObject({ fileName: 'deck.pdf', scanStatus: 'pending' })
      expect(status.message).toMatch(/checking this file/i)
    } finally {
      await sim('/config', { hold: false })
      await sim('/release')
    }
  })

  it('holds the submission with 423 while a file is waiting, and releases it once the verdict is clean', async () => {
    await sim('/config', { hold: true })
    try {
      const { me, applicationId } = await startDraft('submit-wait')
      expect((await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })).status).toBe(202)
      const blocked = await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)
      expect(blocked.status).toBe(423)
      expect(blocked.headers.get('retry-after')).toBeTruthy()
      const body = await blocked.json()
      expect(body.code).toBe('scan-pending')
      expect(body.error).toMatch(/still checking deck\.pdf/i)
      expect((await db().query('select status from app.applications where id = $1', [applicationId])).rows[0].status).toBe('draft')

      await sim('/config', { hold: false })
      await sim('/release')
      expect((await settled(applicationId)).scan_status).toBe('clean')
      expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(200)
    } finally {
      await sim('/config', { hold: false })
      await sim('/release')
    }
  })
})

describe('a clean verdict promotes exactly the scanned version to clean storage', () => {
  it('copies it, records the evidence, removes the quarantine copy, and lets only then the owner and staff read the same bytes', async () => {
    const { me, applicationId } = await startDraft('happy')
    const content = pdfWith('a resume with “quotes” and ünïcode')
    const res = await upload(applicationId, me, { name: 'résumé "deck".pdf', type: 'application/pdf', bytes: content })
    expect(res.status).toBe(202)
    const r = await settled(applicationId)

    expect(r.scan_status).toBe('clean')
    expect(r.scan_result).toBe('NO_THREATS_FOUND')
    expect(r.scan_event_id).toBeTruthy()
    expect(r.scan_decided_at).toBeTruthy()
    expect(r.clean_version_id).toBeTruthy()
    expect(r.file_size).toBe(content.length)

    expect(cleanObjects()).toContain(r.storage_key)
    expect(readFileSync(path.join(process.env.TEST_S3_DIR!, ...r.storage_key.split('/'))).equals(content)).toBe(true)
    const clean = await versionsOf(process.env.TEST_DOCUMENTS_BUCKET!, r.storage_key)
    expect(clean.map((v) => v.versionId)).toContain(r.clean_version_id)
    expect(clean[0]!.sse).toBe('aws:kms')
    expect(Buffer.from(clean[0]!.checksumSha256!, 'base64').toString('hex')).toBe(r.sha256)
    // The scanned quarantine version is gone once promoted.
    const left = (await versionsOf(QUARANTINE(), r.storage_key)).filter((v) => !v.deleteMarker)
    expect(left).toEqual([])

    const mine = `/api/applications/${applicationId}/documents/${fileQuestionId}`
    const download = await get(mine, me)
    expect(download.status).toBe(200)
    expect(download.headers.get('cache-control')).toContain('no-store')
    expect(Buffer.from(await download.arrayBuffer()).equals(content)).toBe(true)

    const adminPath = `/api/admin/applications/${applicationId}/documents/${fileQuestionId}`
    expect((await get(adminPath, staff)).status).toBe(404) // not submitted yet
    expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(200)
    const staffDownload = await get(adminPath, staff)
    expect(staffDownload.status).toBe(200)
    expect(Buffer.from(await staffDownload.arrayBuffer()).equals(content)).toBe(true)
    expect(staffDownload.headers.get('x-content-type-options')).toBe('nosniff')
    const disposition = staffDownload.headers.get('content-disposition') ?? ''
    expect(disposition).toMatch(/^attachment; filename="[\w. -]+"/)
    expect(disposition).not.toMatch(/[\r\n]/)
    // Opening an applicant's document is recorded: once, by the staff member, for this application.
    const viewed = await db().query("select actor_user_id from app.audit_logs where action = 'application_document_viewed' and entity_id = $1", [applicationId])
    expect(viewed.rows).toHaveLength(1)
  })

  it('lets only the owner download their own attachment and open their saved application', async () => {
    const owner = await startDraft('owner-receipt')
    const other = await startDraft('other-receipt')
    await upload(owner.applicationId, owner.me, { name: 'concept.pdf', type: 'application/pdf', bytes: PDF })
    await settled(owner.applicationId)
    const path = `/api/applications/${owner.applicationId}/documents/${fileQuestionId}`
    expect((await get(path, owner.me)).status).toBe(200)
    expect((await get(path, other.me)).status).toBe(404)
    expect((await get(path, null)).status).toBe(401)
    expect((await get(`${path}/status`, other.me)).status).toBe(404)
    expect((await get(`${path}/status`, null)).status).toBe(401)
    // Next may have started streaming the member layout before notFound(), yielding a soft 404.
    // The security boundary is that no receipt or attachment data is serialized to that user.
    const denied = await get(`/dashboard/applications/${owner.applicationId}`, other.me)
    const deniedHtml = await denied.text()
    expect([200, 404]).toContain(denied.status)
    expect(deniedHtml).not.toContain('concept.pdf')
    expect(deniedHtml).not.toContain('What you submitted')
    await post(`/api/applications/${owner.applicationId}/submit`, owner.me, CAPTCHA)
    await post(`/api/admin/applications/${owner.applicationId}/status`, staff, { status: 'under_review', note: 'STAFF-PRIVATE-RECEIPT-NOTE' })
    const notices = (await db().query('select href from app.notifications where application_id=$1', [owner.applicationId])).rows
    expect(notices.length).toBe(2)
    expect(notices.every((notice) => notice.href === `/dashboard/applications/${owner.applicationId}`)).toBe(true)
    const receipt = await get(`/dashboard/applications/${owner.applicationId}`, owner.me)
    const html = await receipt.text()
    expect(receipt.status).toBe(200)
    expect(html).toContain('What you submitted')
    expect(html).toContain('concept.pdf')
    expect(html).not.toContain('password_hash')
    expect(html).not.toContain('STAFF-PRIVATE-RECEIPT-NOTE')
    // The page shows a file's name and state in words; nothing about buckets, versions or checksums.
    expect(html).not.toMatch(/knest-it-(quarantine|documents)|quarantine_|clean_version|GuardDuty|sha256/i)
    expect((await get(path, owner.me)).status).toBe(200)
  })

  it('removes the replaced object after the new document commits', async () => {
    const { me, applicationId } = await startDraft('replace')
    expect((await upload(applicationId, me, { name: 'old.pdf', type: 'application/pdf', bytes: pdfWith('first') })).status).toBe(202)
    const first = await settled(applicationId)
    expect((await upload(applicationId, me, { name: 'new.pdf', type: 'application/pdf', bytes: pdfWith('second') })).status).toBe(202)
    const second = await settled(applicationId)
    expect(second.storage_key).not.toBe(first.storage_key)
    expect(second.scan_status).toBe('clean')
    expect(cleanObjects()).toContain(second.storage_key)
    expect(cleanObjects()).not.toContain(first.storage_key)
  })

  it('accepts a file of exactly 10 MB (the proxy must not truncate it) and screens it like any other', async () => {
    const { me, applicationId } = await startDraft('exact')
    const exact = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 - PDF.length)])
    expect(exact.length).toBe(10 * 1024 * 1024)
    const res = await upload(applicationId, me, { name: 'exact.pdf', type: 'application/pdf', bytes: exact })
    expect(res.status, JSON.stringify(await res.clone().json().catch(() => ({})))).toBe(202)
    const r = await settled(applicationId)
    expect(r.file_size).toBe(10 * 1024 * 1024)
    expect(r.scan_status).toBe('clean')
  })
})

describe('every result other than a clean scan is a rejection', () => {
  it.each([
    ['EICAR (THREATS_FOUND)', 'infected', 'THREATS_FOUND', () => Buffer.from(`%PDF-1.4\n${EICAR_SIGNATURE}\n%%EOF\n`, 'latin1'), /did not pass the security check/i],
    ['password protected (UNSUPPORTED)', 'unscannable', 'UNSUPPORTED', () => pdfWith('SIMULATED-PASSWORD-PROTECTED'), /password protected/i],
    ['scanner failure (FAILED)', 'scan_error', 'FAILED', () => pdfWith('SIMULATED-SCAN-FAILURE'), /could not be completed/i],
  ] as const)('%s ends as %s: nothing reaches clean storage, nothing is served, the applicant is told', async (_label, status, result, bytes, message) => {
    const { me, userId, applicationId } = await startDraft(`reject-${status}`)
    const cleanBefore = cleanObjects().length
    expect((await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: bytes() })).status).toBe(202)
    const r = await settled(applicationId)
    expect(r.scan_status).toBe(status)
    expect(r.scan_result).toBe(result)
    expect(r.clean_version_id).toBeNull()
    expect(cleanObjects().length).toBe(cleanBefore)
    // The rejected object stays in quarantine (where nobody can read it) until the lifecycle rule removes it.
    expect(quarantineObjects()).toContain(r.storage_key)

    const base = `/api/applications/${applicationId}/documents/${fileQuestionId}`
    expect((await get(base, me)).status).toBe(404)
    const shown = await (await get(`${base}/status`, me)).json()
    expect(shown.scanStatus).toBe(status)
    expect(shown.message).toMatch(message)
    expect(JSON.stringify(shown)).not.toMatch(/EICAR|THREATS_FOUND|quarantine|knest-it/i)

    const submit = await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)
    expect(submit.status).toBe(422)
    expect((await submit.json()).code).toBe('scan-blocked')

    const notice = (await db().query("select title, body from app.notifications where user_id = $1 and type = 'document_screening_failed'", [userId])).rows
    expect(notice).toHaveLength(1)
    expect(notice[0].body).toMatch(message)
    expect(notice[0].body).not.toMatch(/EICAR|THREATS_FOUND/i)
  })

  it('lets the applicant replace a rejected file and submit', async () => {
    const { me, applicationId } = await startDraft('recover')
    await upload(applicationId, me, { name: 'bad.pdf', type: 'application/pdf', bytes: Buffer.from(`%PDF-1.4\n${EICAR_SIGNATURE}\n%%EOF\n`, 'latin1') })
    expect((await settled(applicationId)).scan_status).toBe('infected')
    expect((await upload(applicationId, me, { name: 'good.pdf', type: 'application/pdf', bytes: pdfWith('good') })).status).toBe(202)
    expect((await settled(applicationId)).scan_status).toBe('clean')
    expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(200)
  })

  it('lets the applicant remove a rejected optional file so it cannot block the application', async () => {
    const { me, applicationId } = await startDraft('remove-optional')
    await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: pdfWith('required deck') })
    await upload(applicationId, me, { name: 'extra.pdf', type: 'application/pdf', bytes: Buffer.from(`%PDF-1.4\n${EICAR_SIGNATURE}\n%%EOF\n`, 'latin1') }, optionalQuestionId)
    await until(() => db().query('select scan_status from app.application_documents where application_id = $1', [applicationId]).then((r) => r.rows.map((x) => x.scan_status as string)), (s) => !s.includes('pending'))
    expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(422)
    const removed = await del(`/api/applications/${applicationId}/documents/${optionalQuestionId}`, me)
    expect(removed.status).toBe(200)
    expect((await db().query('select question_id from app.application_documents where application_id = $1', [applicationId])).rows.map((r) => r.question_id)).toEqual([fileQuestionId])
    expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(200)
    // A submitted application is frozen: nothing can be removed from it.
    expect((await del(`/api/applications/${applicationId}/documents/${fileQuestionId}`, me)).status).toBe(400)
  })
})

describe('a verdict applies only to the exact object it names', () => {
  /** Holds verdicts so the test, not the stand-in, decides what arrives and when. */
  async function holding<T>(run: () => Promise<T>): Promise<T> {
    await sim('/config', { hold: true })
    try {
      return await run()
    } finally {
      await sim('/config', { hold: false })
      await sim('/release')
    }
  }

  it('ignores a verdict for a different version of the same key, then accepts the right one', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('wrong-version')
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      const r = await row(applicationId)
      await sim('/emit', { key: r.quarantine_key, versionId: 'not-the-uploaded-version', etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', tag: 'NO_THREATS_FOUND' })
      await new Promise((resolve) => setTimeout(resolve, 2500))
      expect((await row(applicationId)).scan_status).toBe('pending')
      expect(cleanObjects()).not.toContain(r.storage_key)
    })
  })

  it('ignores a verdict for a different key', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('wrong-key')
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      const r = await row(applicationId)
      await sim('/emit', { key: '2020-01-01/00000000000000000000000000000000.pdf', versionId: r.quarantine_version_id, etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', tag: 'NO_THREATS_FOUND' })
      await new Promise((resolve) => setTimeout(resolve, 2500))
      expect((await row(applicationId)).scan_status).toBe('pending')
    })
  })

  it('refuses a verdict whose ETag differs from the upload, and fails the document closed', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('wrong-etag')
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      const r = await row(applicationId)
      await sim('/emit', { key: r.quarantine_key, versionId: r.quarantine_version_id, etag: 'deadbeefdeadbeefdeadbeefdeadbeef', scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND' })
      const after = await settled(applicationId)
      expect(after.scan_status).toBe('scan_error')
      expect(after.scan_result).toBe('ETAG_MISMATCH')
      expect(cleanObjects()).not.toContain(r.storage_key)
    })
  })

  it('does not trust a clean event when the object itself is tagged otherwise', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('tag-conflict')
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      const r = await row(applicationId)
      await sim('/emit', { key: r.quarantine_key, versionId: r.quarantine_version_id, etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', tag: 'THREATS_FOUND' })
      const after = await settled(applicationId)
      expect(after.scan_status).toBe('scan_error')
      expect(after.scan_result).toBe('TAG_CONFLICT')
      expect(cleanObjects()).not.toContain(r.storage_key)
    })
  })

  it('keeps a clean event waiting while the scan tag is absent, and promotes once the tag is there', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('tag-late')
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      const r = await row(applicationId)
      // The event arrives, but the version carries no tag: nothing is promoted and the document stays pending.
      await sim('/config', { tagging: 'off' })
      await sim('/emit', { key: r.quarantine_key, versionId: r.quarantine_version_id, etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', tag: null })
      await new Promise((resolve) => setTimeout(resolve, 2500))
      expect((await row(applicationId)).scan_status).toBe('pending')
      expect(cleanObjects()).not.toContain(r.storage_key)
      // The tag appears and a fresh event arrives (the held copy is retried later by the queue; this one is immediate).
      await sim('/config', { tagging: 'on' })
      await sim('/emit', { key: r.quarantine_key, versionId: r.quarantine_version_id, etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', tag: 'NO_THREATS_FOUND' })
      expect((await settled(applicationId)).scan_status).toBe('clean')
    })
  })

  it('treats three deliveries of the same event as one: a single clean copy, no change on replay', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('duplicates')
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      const r = await row(applicationId)
      await sim('/emit', { key: r.quarantine_key, versionId: r.quarantine_version_id, etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', copies: 3, eventId: 'duplicate-event-1' })
      const clean = await settled(applicationId)
      expect(clean.scan_status).toBe('clean')
      expect(clean.scan_event_id).toBe('duplicate-event-1')
      // The other two deliveries are handled right behind the first; give them time, then count the clean copies.
      await new Promise((resolve) => setTimeout(resolve, 2000))
      expect((await versionsOf(process.env.TEST_DOCUMENTS_BUCKET!, r.storage_key)).filter((v) => !v.deleteMarker)).toHaveLength(1)

      // A later THREATS_FOUND replay for the same object cannot undo or alter the recorded outcome.
      await sim('/emit', { key: r.quarantine_key, versionId: r.quarantine_version_id, etag: r.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'THREATS_FOUND', tag: 'THREATS_FOUND', eventId: 'replay-event-2' })
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const after = await row(applicationId)
      expect(after.scan_status).toBe('clean')
      expect(after.scan_event_id).toBe('duplicate-event-1')
      expect(after.clean_version_id).toBe(clean.clean_version_id)
    })
  })

  it('does not let a verdict for a replaced upload release the new one', async () => {
    await holding(async () => {
      const { me, applicationId } = await startDraft('stale')
      await upload(applicationId, me, { name: 'first.pdf', type: 'application/pdf', bytes: pdfWith('first') })
      const first = await row(applicationId)
      await upload(applicationId, me, { name: 'second.pdf', type: 'application/pdf', bytes: pdfWith('second') })
      const second = await row(applicationId)
      expect(second.quarantine_version_id).not.toBe(first.quarantine_version_id)
      // A clean verdict for the FIRST upload arrives: the row is bound to the second, so nothing happens.
      await sim('/emit', { key: first.quarantine_key, versionId: first.quarantine_version_id, etag: first.quarantine_etag, scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', tag: 'NO_THREATS_FOUND' })
      await new Promise((resolve) => setTimeout(resolve, 2500))
      expect((await row(applicationId)).scan_status).toBe('pending')
      expect(cleanObjects()).not.toContain(second.storage_key)
    })
  })

  it('leaves a malformed event in the queue instead of acknowledging it', async () => {
    const marker = `malformed-${stamp}`
    const body = JSON.stringify({ source: 'aws.guardduty', 'detail-type': 'GuardDuty Malware Protection Object Scan Result', detail: {}, marker })
    await fetch(`${process.env.TEST_SQS_ENDPOINT}/__stub/send`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queue: QUEUE(), body }) })
    const mine = (q: Awaited<ReturnType<typeof queueState>>) => q.messages.find((m) => m.body.includes(marker))
    const after = await until(() => queueState(), (q) => (mine(q)?.receiveCount ?? 0) >= 1, 8000)
    // Received, found unusable, and handed back (invisible for a while, then dead-lettered): never deleted.
    expect(mine(after)).toBeDefined()
    expect(mine(after)!.receiveCount).toBeGreaterThanOrEqual(1)
    expect(mine(after)!.visible).toBe(false)
  })
})

describe('the database refuses to record a clean file without the evidence', () => {
  it('cannot mark a document clean without a bound version, a clean copy, GuardDuty’s result and the event that said so', async () => {
    const { me, applicationId } = await startDraft('constraint')
    await sim('/config', { hold: true })
    try {
      await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF })
      await expect(db().query("update app.application_documents set scan_status = 'clean' where application_id = $1", [applicationId])).rejects.toThrow(/application_documents_clean_is_proven/)
      await expect(
        db().query("update app.application_documents set scan_status = 'clean', clean_version_id = 'v1', scan_result = 'THREATS_FOUND', scan_event_id = 'e', scan_decided_at = now() where application_id = $1", [applicationId]),
      ).rejects.toThrow(/application_documents_clean_is_proven/)
      await expect(db().query("update app.application_documents set quarantine_version_id = null where application_id = $1", [applicationId])).rejects.toThrow(/application_documents_binding_complete/)
    } finally {
      await sim('/config', { hold: false })
      await sim('/release')
    }
  })
})

describe('what is refused before anything is stored', () => {
  const storedCount = () => cleanObjects().length + quarantineObjects().length

  it('rejects an unknown question before storing any object', async () => {
    const { me, applicationId } = await startDraft('unknown-question')
    const before = storedCount()
    const response = await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: PDF }, 'forged-question')
    expect(response.status).toBe(400)
    expect(storedCount()).toBe(before)
  })

  it('refuses a file whose bytes are not what its type claims, and stores nothing', async () => {
    const { me, applicationId } = await startDraft('spoof')
    const before = storedCount()
    const spoofed = await upload(applicationId, me, { name: 'deck.pdf', type: 'application/pdf', bytes: EXE })
    expect(spoofed.status).toBe(400)
    expect((await spoofed.json()).error).toMatch(/PDF, DOCX or PPTX/)
    const wrongType = await upload(applicationId, me, { name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('hello') })
    expect(wrongType.status).toBe(400)
    const legacy = await upload(applicationId, me, { name: 'old.doc', type: 'application/msword', bytes: Buffer.from('hello') })
    expect(legacy.status).toBe(400)
    expect(storedCount()).toBe(before)
    expect((await db().query('select count(*)::int c from app.application_documents where application_id = $1', [applicationId])).rows[0].c).toBe(0)
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
    const before = storedCount()
    expect((await upload(owner.applicationId, stranger.me, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })).status).toBe(403)
    expect([401, 403]).toContain((await upload(owner.applicationId, null, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })).status)
    expect(storedCount()).toBe(before)

    expect((await upload(owner.applicationId, owner.me, { name: 'a.pdf', type: 'application/pdf', bytes: PDF })).status).toBe(202)
    await settled(owner.applicationId)
    expect((await post(`/api/applications/${owner.applicationId}/submit`, owner.me, CAPTCHA)).status).toBe(200)
    const late = await upload(owner.applicationId, owner.me, { name: 'late.pdf', type: 'application/pdf', bytes: PDF })
    expect(late.status).toBe(400)
    expect((await late.json()).error).toMatch(/already been submitted/i)
  })

  it('does not let students or anonymous callers download documents through the staff route', async () => {
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
