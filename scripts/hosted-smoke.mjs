#!/usr/bin/env node
// Signed-in smoke test of a HOSTED KNEST, run ON the application host so it needs neither the
// preview gate password nor a route to the private database. It drives the real HTTP routes of
// the running container (default http://127.0.0.1:3000) and uses the database only to create
// synthetic accounts and to read the verification state.
//
// Journey: sign up -> verify (database, because mail cannot be read back) -> sign in ->
// staff creates an open program -> apply (answers + a PDF upload that must pass GuardDuty's malware check) -> submit -> staff reviews
// (status change, document download) -> clean up: synthetic users deactivated, program closed.
//
// Run it inside the migrate image so `pg` and `bcryptjs` resolve, with the app's environment file:
//   docker run --rm --network host --env-file /run/knest/app.env \
//     -v /opt/knest/hosted-smoke.mjs:/app/hosted-smoke.mjs:ro <migrate-image> node hosted-smoke.mjs
//
// Nothing is printed that is a secret: passwords are generated per run and never logged.
// Exit code 1 if any step fails. Records are tagged `smoke-<stamp>@knest.invalid`.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { Pool } = require('pg')
const { hash } = require('bcryptjs')

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'
const SITE = process.env.SITE_URL
const VERIFY = process.env.ORIGIN_VERIFY_SECRET
if (!SITE || !VERIFY || !process.env.DATABASE_URL) {
  console.error('SITE_URL, ORIGIN_VERIFY_SECRET and DATABASE_URL must be in the environment (use the app env file).')
  process.exit(2)
}
const stamp = Date.now()
const studentEmail = `smoke-student-${stamp}@knest.invalid`
const staffEmail = `smoke-staff-${stamp}@knest.invalid`
const password = 'Sm0ke-' + randomBytes(18).toString('base64url')
let ipCounter = Math.floor(Math.random() * 200)
const nextIp = () => `198.51.100.${(ipCounter = (ipCounter + 1) % 250 + 1)}`

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: process.env.DATABASE_SSL === 'verify' ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, 'utf8'), rejectUnauthorized: true } : false,
})

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''))
}

async function call(path, { method = 'GET', cookie, json, form, ip } = {}) {
  const headers = {
    'x-origin-verify': VERIFY,
    'cloudfront-viewer-address': `${ip ?? nextIp()}:40000`,
    origin: new URL(SITE).origin,
    host: new URL(SITE).host,
  }
  if (cookie) headers.cookie = cookie
  let body
  if (json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) body = form
  const res = await fetch(BASE + path, { method, headers, body, redirect: 'manual' })
  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  const setCookie = res.headers.getSetCookie?.() ?? []
  return { status: res.status, data, text, setCookie, headers: res.headers }
}

const cookieFrom = (res) => res.setCookie.map((c) => c.split(';')[0]).join('; ')
const CAPTCHA = { turnstileToken: 'smoke-token' }

async function main() {
  const health = await call('/api/health')
  record('health endpoint answers 200', health.status === 200, String(health.status))

  // Staff account created in the database (the only way to obtain staff rights; there is no sign-up path to it).
  const staffHash = await hash(password, 12)
  await pool.query(
    `insert into app.users (id, email, name, password_hash, platform_role, staff_role, email_verified, is_active)
     values (gen_random_uuid()::text, $1, 'Smoke Staff', $2, 'other', 'super_admin', now(), true)`,
    [staffEmail, staffHash],
  )

  // 1. Sign up through the real route.
  const signup = await call('/api/auth/password/signup', {
    method: 'POST',
    json: { name: 'Smoke Student', email: studentEmail, password, ...CAPTCHA },
  })
  record('sign up accepted', signup.status === 201, `${signup.status} ${signup.data?.error ?? ''}`.trim())

  // 2. Verification: the mail goes to a non-routable address, so mark verified in the database.
  const u = await pool.query('select id, email_verified from app.users where email = $1', [studentEmail])
  record('student row exists after sign up', u.rowCount === 1)
  const verifiedBefore = Boolean(u.rows[0]?.email_verified)
  record('account starts unverified', !verifiedBefore, verifiedBefore ? 'already verified' : 'unverified, as designed')
  await pool.query('update app.users set email_verified = now() where email = $1', [studentEmail])

  const login = await call('/api/auth/password/login', { method: 'POST', json: { email: studentEmail, password, ...CAPTCHA } })
  const student = cookieFrom(login)
  record('student sign in', login.status === 200 && student.length > 0, String(login.status))

  const staffLogin = await call('/api/auth/password/login', { method: 'POST', json: { email: staffEmail, password, ...CAPTCHA } })
  const staff = cookieFrom(staffLogin)
  record('staff sign in', staffLogin.status === 200 && staff.length > 0, String(staffLogin.status))

  const asStudentAdmin = await call('/admin', { cookie: student })
  record('student is refused the admin area (404)', asStudentAdmin.status === 404, String(asStudentAdmin.status))
  const asStaffAdmin = await call('/admin', { cookie: staff })
  record('staff reach the admin area', asStaffAdmin.status === 200, String(asStaffAdmin.status))

  // 3. Staff create a program with one text and one file question, published and open.
  const slug = `smoke-program-${stamp}`
  const lexical = (t) => ({
    root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: t, version: 1 }], version: 1 }], direction: null, format: '', indent: 0, version: 1 },
  })
  const created = await call('/api/programs', {
    method: 'POST',
    cookie: staff,
    json: {
      title: 'Smoke test program (internal)',
      slug,
      tagline: 'Synthetic. Not a real programme.',
      whoItsFor: lexical('Smoke test only'),
      stage: ['idea'],
      applicationStatus: 'open',
      _status: 'published',
      applicationQuestions: [
        { label: 'What are you building', fieldType: 'textarea', required: true, maxLength: 500 },
        { label: 'Pitch deck', fieldType: 'file', required: true },
      ],
    },
  })
  const programId = created.data?.doc?.id
  record('staff create the program through the CMS API', created.status === 201 && Boolean(programId), `${created.status} ${created.status === 201 ? '' : created.text.slice(0, 160)}`.trim())
  if (!programId) throw new Error('cannot continue without a program')

  try {
    const page = await call(`/programs/${slug}`)
    record('program page renders publicly', page.status === 200, String(page.status))

    // 4. Apply.
    const start = await call('/api/applications/start', { method: 'POST', cookie: student, json: { programSlug: slug } })
    const appId = start.data?.applicationId
    record('student starts an application', start.status === 200 && Boolean(appId), `${start.status} ${start.data?.error ?? ''}`.trim())
    if (!appId) throw new Error('cannot continue without an application')

    const fetched = await pool.query(
      `select a.id from app.applications a where a.id = $1`,
      [appId],
    )
    record('application row stored', fetched.rowCount === 1)

    const prog = await call(`/api/programs/${programId}?depth=0`, { cookie: staff })
    const qs = prog.data?.applicationQuestions ?? []
    const textQ = qs.find((q) => q.fieldType === 'textarea')
    const fileQ = qs.find((q) => q.fieldType === 'file')
    record('program questions carry ids', Boolean(textQ?.id && fileQ?.id))

    const ans = await call(`/api/applications/${appId}/answer`, { method: 'POST', cookie: student, json: { questionId: textQ.id, value: 'A synthetic smoke-test answer.' } })
    record('answer saved', ans.status === 200, `${ans.status} ${ans.data?.error ?? ''}`.trim())

    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
    const form = new FormData()
    form.set('questionId', fileQ.id)
    form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'smoke.pdf')
    const up = await call(`/api/applications/${appId}/documents`, { method: 'POST', cookie: student, form })
    record('PDF accepted into quarantine (202, pending)', up.status === 202 && up.data?.scanStatus === 'pending', `${up.status} ${up.data?.error ?? ''}`.trim())

    // Until GuardDuty's verdict is applied the file cannot be read by anyone: 423 (or already 200 if the scan was very fast).
    const early = await call(`/api/applications/${appId}/documents/${fileQ.id}`, { cookie: student })
    record('file is locked while being checked (423), or already passed (200)', early.status === 423 || early.status === 200, String(early.status))

    // The real verdict arrives through GuardDuty -> EventBridge -> SQS -> the app's worker. Wait for it (up to 5 minutes).
    let scan = 'pending'
    const waitedFrom = Date.now()
    while (scan === 'pending' && Date.now() - waitedFrom < 300_000) {
      const state = await call(`/api/applications/${appId}/documents/${fileQ.id}/status`, { cookie: student })
      scan = state.data?.scanStatus ?? 'unknown'
      if (scan === 'pending') await new Promise((resolve) => setTimeout(resolve, 5000))
    }
    record('GuardDuty verdict applied: the file is clean', scan === 'clean', `${scan} after ${Math.round((Date.now() - waitedFrom) / 1000)}s`)

    const doc = await pool.query('select scan_status, scan_result, quarantine_version_id, clean_version_id, scan_event_id, sha256 from app.application_documents where application_id = $1', [appId]).catch(() => null)
    if (doc) {
      const r = doc.rows[0]
      record('document row bound to a quarantine version, a clean version and the deciding event', doc.rowCount === 1 && r.scan_status === 'clean' && r.scan_result === 'NO_THREATS_FOUND' && Boolean(r.quarantine_version_id && r.clean_version_id && r.scan_event_id && r.sha256))
    }
    const own = await call(`/api/applications/${appId}/documents/${fileQ.id}`, { cookie: student })
    record('owner can download the clean file', own.status === 200, String(own.status))

    const submit = await call(`/api/applications/${appId}/submit`, { method: 'POST', cookie: student, json: { ...CAPTCHA } })
    record('application submitted', submit.status === 200, `${submit.status} ${submit.data?.error ?? ''}`.trim())

    // 5. Staff review.
    const list = await call('/admin/applications', { cookie: staff })
    record('staff applications list renders', list.status === 200, String(list.status))
    const detail = await call(`/admin/applications/${appId}`, { cookie: staff })
    record('staff application detail renders', detail.status === 200, String(detail.status))
    const dl = await call(`/api/admin/applications/${appId}/documents/${fileQ.id}`, { cookie: staff })
    record('staff download the document', dl.status === 200 || dl.status === 302, String(dl.status))
    const status = await call(`/api/admin/applications/${appId}/status`, { method: 'POST', cookie: staff, json: { status: 'under_review', note: 'smoke test' } })
    record('staff move it to under review', status.status === 200, `${status.status} ${status.data?.error ?? ''}`.trim())
    const studentSees = await call('/dashboard', { cookie: student })
    record('student dashboard renders', studentSees.status === 200, String(studentSees.status))
    const crossRead = await call(`/api/admin/applications/${appId}/status`, { method: 'POST', cookie: student, json: { status: 'accepted' } })
    record('student cannot change a status', crossRead.status === 403 || crossRead.status === 401 || crossRead.status === 404, String(crossRead.status))

    // 6. Contact enquiry, as an anonymous visitor.
    const enquiry = await call('/api/enquiries', {
      method: 'POST',
      json: { name: 'Smoke Visitor', email: `smoke-visitor-${stamp}@knest.invalid`, message: 'Synthetic smoke-test message.', ...CAPTCHA },
    })
    record('contact enquiry accepted', enquiry.status === 200 || enquiry.status === 201, `${enquiry.status} ${enquiry.data?.error ?? ''}`.trim())
  } finally {
    // Clean up what this run created: close the program, deactivate the synthetic accounts.
    // Application and document rows are kept as evidence; delete them with an operator command, never from here.
    const close = await call(`/api/programs/${programId}`, { method: 'PATCH', cookie: staff, json: { applicationStatus: 'closed', _status: 'draft' } })
    record('smoke program closed and unpublished', close.status === 200, String(close.status))
    await pool.query('update app.users set is_active = false where email = any($1)', [[studentEmail, staffEmail]])
    record('synthetic accounts deactivated', true)
  }
}

try {
  await main()
} catch (error) {
  record('run completed', false, String(error?.message ?? error))
}
await pool.end()
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed} passed, ${failed} failed (synthetic marker: smoke-*-${stamp}@knest.invalid)`)
process.exit(failed ? 1 : 0)
