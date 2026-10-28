import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { startTestDatabase } from '../support/pg'
import { startS3Stub } from '../support/s3-stub'
import { startSmtpStub } from '../support/smtp-stub'
import { startTurnstileVerifyStub, TURNSTILE_TEST_SECRET, TURNSTILE_TEST_SITE_KEY } from '../support/turnstile-stub'
import { startGuardDutySimulator } from '../support/guardduty-simulator'
import { startSqsStub } from '../support/sqs-stub'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SECRET = 'integration-test-secret-0123456789abcdef0123456789'
// Three buckets, as in production: CMS media, clean documents, and the quarantine every upload lands in first.
const S3_MEDIA_BUCKET = 'knest-it-media'
const DOCUMENTS_BUCKET = 'knest-it-documents'
const QUARANTINE_BUCKET = 'knest-it-quarantine'
const SCAN_QUEUE = 'knest-it-scan-results'
const SCAN_DLQ = 'knest-it-scan-results-dlq'
const KMS_KEY_ARN = 'arn:aws:kms:ap-south-1:000000000000:key/00000000-0000-0000-0000-000000000000'
const TSX_CLI = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs')
const PAYLOAD_CLI = path.join(ROOT, 'node_modules/payload/bin.js')

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo
      s.close(() => resolve(port))
    })
  })
}

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms
  for (;;) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status < 600) return
    } catch {
      // not up yet
    }
    if (Date.now() > until) throw new Error(`server did not become ready: ${url}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

export default async function setup() {
  const db = await startTestDatabase()
  const work = mkdtempSync(path.join(os.tmpdir(), 'knest-it-'))
  const captureFile = path.join(work, 'smtp.jsonl')
  writeFileSync(captureFile, '')
  const smtp = await startSmtpStub(captureFile)
  const s3 = await startS3Stub(path.join(work, 's3'))
  const turnstile = await startTurnstileVerifyStub()
  const sqs = await startSqsStub()
  sqs.createQueue(SCAN_DLQ)
  sqs.createQueue(SCAN_QUEUE, { deadLetterQueue: SCAN_DLQ, maxReceiveCount: 4, defaultVisibilitySeconds: 30 })
  // A TEST DOUBLE for GuardDuty's event source (see tests/support/guardduty-simulator.ts): it tags new quarantine
  // versions and queues EventBridge-shaped results. It is not a scanner and proves nothing about malware detection.
  const simulator = await startGuardDutySimulator({ s3, sqs, queue: SCAN_QUEUE, quarantineBucket: QUARANTINE_BUCKET })
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: db.url,
    AUTH_SECRET: SECRET,
    PAYLOAD_SECRET: SECRET,
    AUTH_URL: baseUrl,
    AUTH_TRUST_HOST: 'true',
    NEXT_PUBLIC_SITE_URL: baseUrl,
    SITE_URL: baseUrl,
    // The suite gives every request its own X-Forwarded-For; production reads CloudFront's header.
    CLIENT_IP_SOURCE: 'x-forwarded-for',
    // The human check is enforced in the suite, against a local stand-in for Cloudflare.
    TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
    TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
    TURNSTILE_VERIFY_URL: turnstile.endpoint,
    DATABASE_SSL: 'off',
    // Lab booking is built and tested locally, but stays off by default everywhere else (HD-16 is open).
    FEATURE_LAB_BOOKING: 'true',
    // QR attendance is exercised here against real keys; it stays off everywhere else until the threat model is signed off.
    FEATURE_LAB_ATTENDANCE_QR: 'true',
    SMTP_HOST: '127.0.0.1',
    EMAIL_TRANSPORT: 'smtp',
    SMTP_PORT: String(smtp.port),
    SMTP_USER: '',
    EMAIL_FROM: 'KNEST Tests <no-reply@knest.test>',
    // Every S3_* variable is set explicitly so nothing from a developer's own
    // .env files can reach the server: documents go to the local stub only.
    S3_BUCKET: S3_MEDIA_BUCKET,
    S3_REGION: 'ap-south-1',
    S3_ENDPOINT: s3.endpoint,
    QUARANTINE_BUCKET,
    DOCUMENTS_BUCKET,
    DOCUMENTS_KMS_KEY_ARN: KMS_KEY_ARN,
    MALWARE_SCAN_QUEUE_URL: sqs.queueUrl(SCAN_QUEUE),
    SQS_ENDPOINT: sqs.endpoint,
    MALWARE_SCAN_POLL_WAIT_SECONDS: '1',
    S3_ACCESS_KEY_ID: 'test-access-key-id',
    S3_SECRET_ACCESS_KEY: 'test-secret-access-key',
    AUTH_GOOGLE_ID: '',
    AUTH_GOOGLE_SECRET: '',
    SEED_PASSWORD: 'integration-seed-password-1',
  }

  // 1. Migrate an EMPTY database exactly as a deployment would (`pnpm migrate`):
  //    Drizzle migrations for `app`, then Payload migrations for `cms`, with
  //    NODE_ENV=production so no development-only schema push can mask a gap.
  for (const args of [
    [TSX_CLI, 'src/db/migrate.ts'],
    [PAYLOAD_CLI, 'migrate'],
  ]) {
    const step = spawnSync(process.execPath, args, {
      cwd: ROOT,
      env: { ...env, NODE_ENV: 'production' },
      encoding: 'utf8',
      input: '',
      timeout: 240_000,
    })
    if (step.status !== 0) {
      throw new Error(`migration step failed (${args.join(' ')}):
${step.stdout.slice(-1500)}
${step.stderr.slice(-1500)}`)
    }
  }

  // 1b. Provision the least-privilege runtime role exactly as the release's migration job does, and run
  //     the server as that role. The whole suite therefore also proves that the application needs no
  //     schema rights (src/db/runtime-role.ts). Tests and helpers keep using the owner's URL.
  const RUNTIME_USER = 'knest_app'
  const RUNTIME_PASSWORD = 'integration-runtime-password-0123456789'
  const roleStep = spawnSync(process.execPath, [TSX_CLI, 'src/db/runtime-role.ts'], {
    cwd: ROOT,
    env: { ...env, NODE_ENV: 'production', DB_RUNTIME_USER: RUNTIME_USER, DB_RUNTIME_PASSWORD: RUNTIME_PASSWORD },
    encoding: 'utf8',
    input: '',
    timeout: 120_000,
  })
  if (roleStep.status !== 0) throw new Error(`runtime role step failed:
${roleStep.stdout.slice(-800)}
${roleStep.stderr.slice(-800)}`)
  const runtimeUrl = new URL(db.url)
  runtimeUrl.username = RUNTIME_USER
  runtimeUrl.password = RUNTIME_PASSWORD

  // 2. The PRODUCTION build, run the way it would be deployed. cwd is a temp
  //    directory so Payload's relative media directory lands there, not in the repo.
  let server: ChildProcess | null = null
  if (existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', ROOT, '-p', String(port), '-H', '127.0.0.1'], {
      cwd: work,
      env: { ...env, DATABASE_URL: runtimeUrl.toString(), NODE_ENV: 'production', PATH: process.env.PATH },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const log: string[] = []
    server.stdout?.on('data', (d) => log.push(String(d)))
    server.stderr?.on('data', (d) => log.push(String(d)))
    server.on('exit', (code) => log.push(`[server exited ${code}]`))
    try {
      await waitFor(`${baseUrl}/login`, 90_000)
    } catch (error) {
      server.kill()
      throw new Error(`${(error as Error).message}\n${log.join('').slice(-2000)}`)
    }
    writeFileSync(path.join(work, 'server.log'), '')
    server.stdout?.on('data', (d) => writeFileSync(path.join(work, 'server.log'), String(d), { flag: 'a' }))
    server.stderr?.on('data', (d) => writeFileSync(path.join(work, 'server.log'), String(d), { flag: 'a' }))
    process.env.TEST_BASE_URL = baseUrl
  }

  process.env.DATABASE_URL = db.url
  process.env.TEST_SMTP_CAPTURE = captureFile
  process.env.TEST_SMTP_PORT = String(smtp.port)
  // TEST_S3_DIR is the CLEAN documents bucket's directory (what the document tests have always inspected).
  process.env.TEST_S3_DIR = path.join(s3.dir, DOCUMENTS_BUCKET)
  process.env.TEST_QUARANTINE_DIR = path.join(s3.dir, QUARANTINE_BUCKET)
  process.env.TEST_S3_ENDPOINT = s3.endpoint
  process.env.TEST_S3_BUCKET = S3_MEDIA_BUCKET
  process.env.TEST_DOCUMENTS_BUCKET = DOCUMENTS_BUCKET
  process.env.TEST_QUARANTINE_BUCKET = QUARANTINE_BUCKET
  process.env.TEST_KMS_KEY_ARN = KMS_KEY_ARN
  process.env.TEST_SQS_ENDPOINT = sqs.endpoint
  process.env.TEST_SCAN_QUEUE = SCAN_QUEUE
  process.env.TEST_SCAN_DLQ = SCAN_DLQ
  process.env.TEST_SCAN_QUEUE_URL = sqs.queueUrl(SCAN_QUEUE)
  process.env.TEST_SIM_URL = simulator.controlUrl
  process.env.TEST_WORKDIR = work
  process.env.TEST_PORT = String(port)
  process.env.AUTH_SECRET = SECRET
  process.env.PAYLOAD_SECRET = SECRET

  return async () => {
    if (server?.pid) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
      } else {
        server.kill('SIGTERM')
      }
    }
    await smtp.close()
    await s3.close()
    await turnstile.close()
    await simulator.close()
    await sqs.close()
    await db.stop()
    rmSync(work, { recursive: true, force: true })
  }
}
