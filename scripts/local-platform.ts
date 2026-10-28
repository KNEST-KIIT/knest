/** Persistent, loopback-only sandbox. Existing .env files are never changed. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'dotenv'
import EmbeddedPostgres from 'embedded-postgres'
import { startGuardDutySimulator } from '../tests/support/guardduty-simulator'
import { startS3Stub } from '../tests/support/s3-stub'
import { startSmtpStub } from '../tests/support/smtp-stub'
import { startSqsStub } from '../tests/support/sqs-stub'

const root = path.resolve(import.meta.dirname, '..')
const work = path.join(process.env.LOCALAPPDATA || os.homedir(), 'KNEST', 'local-platform')
mkdirSync(work, { recursive: true })
const base = 'http://127.0.0.1:3000'
const capture = path.join(work, 'mail.jsonl')
if (!existsSync(capture)) writeFileSync(capture, '')
const settingsFile = path.join(work, 'settings.json')
const settings = existsSync(settingsFile)
  ? JSON.parse(readFileSync(settingsFile, 'utf8')) as { secret: string; password: string }
  : { secret: randomBytes(40).toString('hex'), password: randomBytes(24).toString('hex') }
writeFileSync(settingsFile, JSON.stringify(settings, null, 2))

// Block credentials and endpoints from the shell AND all Next/dotenv files.
const env: NodeJS.ProcessEnv = { NODE_ENV: 'development' }
const systemKeys = new Set(['path', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'home', 'userprofile', 'localappdata', 'appdata', 'programfiles', 'programfiles(x86)', 'programdata', 'pathext', 'systemdrive', 'number_of_processors', 'processor_architecture'])
for (const [name, value] of Object.entries(process.env)) if (systemKeys.has(name.toLowerCase())) env[name] = value
for (const name of Object.keys(env)) {
  if (/^(AWS_|S3_|SMTP_|AUTH_|NEXTAUTH_|PAYLOAD_|TURNSTILE_|VERCEL|SUPABASE_|NEXT_PUBLIC_|DATABASE_|DB_|SEED_|TEST_|ORIGIN_|ALLOWED_ORIGINS|EMAIL_|SES_|APP_ENV|SITE_)/.test(name)) env[name] = ''
}
for (const file of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local', '.env.test', '.env.test.local']) {
  const full = path.join(root, file)
  if (existsSync(full)) for (const name of Object.keys(parse(readFileSync(full)))) env[name] = ''
}

async function availablePort(preferred = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(preferred, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

const children = new Set<ChildProcess>()
function child(args: string[], logName: string, childEnv = env): ChildProcess {
  const proc = spawn(process.execPath, args, { cwd: root, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  children.add(proc)
  const log = (data: Buffer) => {
    appendFileSync(path.join(work, logName), data)
    process.stdout.write(data)
  }
  proc.stdout?.on('data', log)
  proc.stderr?.on('data', log)
  proc.on('exit', () => children.delete(proc))
  return proc
}
async function run(args: string[], childEnv = env) {
  const proc = child(args, 'setup.log', childEnv)
  await new Promise<void>((resolve, reject) => {
    proc.once('error', reject)
    proc.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Local setup failed: ${args.join(' ')} (${code})`)))
  })
}

let pg: EmbeddedPostgres | undefined
let smtp: Awaited<ReturnType<typeof startSmtpStub>> | undefined
let s3: Awaited<ReturnType<typeof startS3Stub>> | undefined
let sqs: Awaited<ReturnType<typeof startSqsStub>> | undefined
let simulator: Awaited<ReturnType<typeof startGuardDutySimulator>> | undefined
let inbox: http.Server | undefined
let stopping = false
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const proc of children) {
    if (process.platform === 'win32' && proc.pid) spawnSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
    else proc.kill('SIGTERM')
  }
  inbox?.closeAllConnections()
  inbox?.close()
  await Promise.allSettled([smtp?.close(), s3?.close(), simulator?.close(), sqs?.close()])
  await pg?.stop()
  process.exit(code)
}
process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())

async function main() {
  const preview = process.argv.includes('--preview')
  const previewServer = path.join(root, '.next/standalone/server.js')
  if (preview && !process.argv.includes('--verify') && !existsSync(previewServer)) {
    throw new Error('Run pnpm build before starting the local preview.')
  }
  await availablePort(3000)
  await availablePort(8025)
  const port = await availablePort()
  const dir = path.join(work, 'postgres')
  const fresh = !existsSync(path.join(dir, 'PG_VERSION'))
  pg = new EmbeddedPostgres({ databaseDir: dir, port, user: 'knest_local', password: settings.password, persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: (e) => appendFileSync(path.join(work, 'postgres.log'), String(e) + '\n') })
  if (fresh) await pg.initialise()
  await pg.start()
  if (fresh) await pg.createDatabase('knest_local_test')
  smtp = await startSmtpStub(capture)
  s3 = await startS3Stub(path.join(work, 'objects'), { persist: true })
  // Document screening runs the same code as production against local stand-ins. The GuardDuty stand-in only tags
  // new quarantine versions and queues EventBridge-shaped results (a few fixed marker strings pick the verdict); it
  // is NOT a scanner, so a document that passes here has proved nothing about malware (tests/support/guardduty-simulator.ts).
  sqs = await startSqsStub()
  sqs.createQueue('knest-local-scan-results-dlq')
  sqs.createQueue('knest-local-scan-results', { deadLetterQueue: 'knest-local-scan-results-dlq', maxReceiveCount: 5 })
  simulator = await startGuardDutySimulator({ s3, sqs, queue: 'knest-local-scan-results', quarantineBucket: 'knest-local-quarantine', delayMs: 1500 })
  Object.assign(env, {
    NODE_ENV: 'development', APP_ENV: 'local', VERCEL_ENV: '',
    DATABASE_URL: `postgres://knest_local:${settings.password}@127.0.0.1:${port}/knest_local_test`, DATABASE_SSL: 'off',
    AUTH_SECRET: settings.secret, PAYLOAD_SECRET: settings.secret, AUTH_URL: base, AUTH_TRUST_HOST: 'true',
    SITE_URL: base, NEXT_PUBLIC_SITE_URL: base, CLIENT_IP_SOURCE: 'x-forwarded-for', SITE_INDEXING: 'off',
    FEATURE_LAB_BOOKING: 'true', FEATURE_LAB_ATTENDANCE_QR: 'true',
    EMAIL_TRANSPORT: 'smtp', EMAIL_FROM: 'KNEST Local <no-reply@knest.test>', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: '', SMTP_PASSWORD: '', EMAIL_OUTBOX: '',
    S3_BUCKET: 'knest-local-media', S3_REGION: 'ap-south-1', S3_ENDPOINT: s3.endpoint, S3_ACCESS_KEY_ID: 'local-only', S3_SECRET_ACCESS_KEY: 'local-only', CLOUDFRONT_URL: '',
    QUARANTINE_BUCKET: 'knest-local-quarantine', DOCUMENTS_BUCKET: 'knest-local-documents', DOCUMENTS_KMS_KEY_ARN: 'arn:aws:kms:ap-south-1:000000000000:key/00000000-0000-0000-0000-000000000000',
    MALWARE_SCAN_QUEUE_URL: sqs.queueUrl('knest-local-scan-results'), SQS_ENDPOINT: sqs.endpoint, MALWARE_SCAN_POLL_WAIT_SECONDS: '2',
    AWS_EC2_METADATA_DISABLED: 'true', AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '', TURNSTILE_SECRET_KEY: '', TURNSTILE_SITE_KEY: '', ORIGIN_VERIFY_SECRET: '',
    SEED_PASSWORD: 'Knest-Local-Test-2026!', SEED_ADMIN_EMAIL: 'admin@knest.local', SEED_RESET_EXISTING: '',
  })
  // Real Google sign-in is opt-in; ordinary fictional review never loads credentials.
  if (process.argv.includes('--google')) {
    const credentialFile = path.join(work, 'google-oauth.json')
    if (!existsSync(credentialFile)) throw new Error('Private Google settings are missing. Complete local OAuth setup first.')
    const credential = JSON.parse(readFileSync(credentialFile, 'utf8')) as { clientId?: string; clientSecret?: string }
    if (!credential.clientId?.trim() || !credential.clientSecret?.trim()) throw new Error('Private Google settings are incomplete.')
    env.AUTH_GOOGLE_ID = credential.clientId
    env.AUTH_GOOGLE_SECRET = credential.clientSecret
    env.AUTH_GOOGLE_ISSUER = ''
  }
  const tsx = path.join(root, 'node_modules/tsx/dist/cli.mjs')
  const migrated: NodeJS.ProcessEnv = { ...env, NODE_ENV: 'production' }
  await run([tsx, 'src/db/migrate.ts'], migrated)
  await run([path.join(root, 'node_modules/payload/bin.js'), 'migrate'], migrated)
  await run([tsx, 'src/db/seed.ts'])
  await run([tsx, 'src/db/seed-demo.ts'])
  await run([tsx, 'scripts/seed-local-platform.ts'])
  await run([tsx, 'scripts/seed-local-journey.ts'])

  // Synthetic messages only. Escaped plain text keeps email HTML inert.
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  inbox = http.createServer((_req, res) => {
    const mails = readFileSync(capture, 'utf8').trim().split('\n').filter(Boolean).reverse().map((line) => {
      const m = JSON.parse(line) as { to: string[]; body: string }
      return `<article><h2>${escape(m.to.join(', '))}</h2><pre>${escape(m.body)}</pre></article>`
    }).join('')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" })
    res.end(`<title>KNEST local mail</title><style>body{font:16px system-ui;margin:3rem;max-width:1000px}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:1px solid #ccc;padding:1rem 0}</style><h1>KNEST local test inbox</h1><p>Refresh to see verification, recovery and notification emails. Copy a local link into the application tab.</p>${mails || '<p>No messages yet.</p>'}`)
  })
  await new Promise<void>((resolve) => inbox!.listen(8025, '127.0.0.1', resolve))
  const serverEnv: NodeJS.ProcessEnv = preview ? {
    ...env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '3000',
    // Cloudflare's published dummy pair exercises the normal widget/verification
    // path on this loopback-only preview; no real challenge or account is used.
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  } : env
  const runtime = { baseUrl: base, inboxUrl: 'http://127.0.0.1:8025', workdir: work, pid: process.pid, mode: preview ? 'preview' : 'development', env: serverEnv }
  writeFileSync(path.join(work, 'runtime.json'), JSON.stringify(runtime, null, 2))
  if (process.argv.includes('--verify')) {
    // The integration harness creates its own disposable DB and provider stubs.
    const checkEnv: NodeJS.ProcessEnv = { ...env, NODE_ENV: 'test' }
    await run([path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--maxWorkers=2'], checkEnv)
    await run([path.join(root, 'node_modules/next/dist/bin/next'), 'build'], { ...checkEnv, NODE_ENV: 'production' })
    await run([path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.integration.config.mts'], checkEnv)
  }
  if (preview && process.platform === 'win32') {
    // Next traces the native .node file, but Windows also needs its sibling DLLs.
    const localRequire = createRequire(import.meta.url)
    const sharpRoot = path.dirname(localRequire.resolve('sharp'))
    const binaryRoot = path.dirname(localRequire.resolve(`@img/sharp-win32-${process.arch}/package`, { paths: [sharpRoot] }))
    const source = path.join(binaryRoot, 'lib')
    const target = path.join(root, '.next/standalone', path.relative(root, source))
    mkdirSync(target, { recursive: true })
    for (const name of readdirSync(source)) if (name.endsWith('.dll')) copyFileSync(path.join(source, name), path.join(target, name))
  }
  // Product review uses the tested build without development refresh/compilation.
  const server = preview
    ? child([previewServer], 'server.log', serverEnv)
    : child([path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3000'], 'server.log')
  server.once('exit', (code) => void stop(code ?? 1))
  console.log(`\nLocal app: ${base}\nLocal test inbox: http://127.0.0.1:8025\nData and logs: ${work}\n`)
}
main().catch((error) => { console.error(error); void stop(1) })
