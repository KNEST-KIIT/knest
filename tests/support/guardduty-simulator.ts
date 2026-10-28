import { randomUUID } from 'node:crypto'
import http from 'node:http'
import { EICAR_SIGNATURE } from './eicar'
import type { S3Stub } from './s3-stub'
import type { SqsStub } from './sqs-stub'

/**
 * A TEST DOUBLE for the event source of the document pipeline. It is not an antivirus and proves nothing about
 * malware detection.
 *
 * What the real thing does, in order: GuardDuty Malware Protection for S3 sees a new object version in the
 * quarantine bucket, scans it, tags that version GuardDutyMalwareScanStatus=<result>, and EventBridge delivers a
 * "GuardDuty Malware Protection Object Scan Result" event to the verdict queue. This stand-in reproduces those
 * three effects against the S3 and SQS stand-ins so the application's real code (upload, verdict worker, promotion,
 * download, submit gating) can be exercised end to end. It decides a verdict by looking for three fixed marker
 * strings, nothing else: the standard EICAR test string (reported as a threat), SIMULATED-PASSWORD-PROTECTED
 * (reported as skipped/unsupported) and SIMULATED-SCAN-FAILURE (reported as failed). Every other byte sequence is
 * reported clean, which a real scanner would not do. Real detection is proven only by the hosted acceptance drill
 * (scripts/ops/malware-protection-drill.mjs) against the real quarantine bucket.
 *
 * Control (HTTP, so tests in other processes can steer it):
 *   POST /config   {hold?, tagging?: 'on'|'off', tagDelayMs?, delayMs?}
 *   POST /release  publish every held verdict
 *   POST /emit     {key, versionId, bucket?, etag?, scanStatus, scanResultStatus, threats?, statusReasons?, tag?, copies?}
 *   GET  /held     the verdicts waiting for /release
 */

export type SimulatedVerdict = {
  scanStatus: 'COMPLETED' | 'SKIPPED' | 'FAILED'
  scanResultStatus: 'NO_THREATS_FOUND' | 'THREATS_FOUND' | 'UNSUPPORTED' | 'ACCESS_DENIED' | 'FAILED'
  threats?: { name: string; source: string; itemDetails: { hash: string; itemPath: string }[] }[] | null
  statusReasons?: string[] | null
}

export const SIMULATOR_MARKERS = { passwordProtected: 'SIMULATED-PASSWORD-PROTECTED', scanFailure: 'SIMULATED-SCAN-FAILURE' } as const

export function defaultVerdict(body: Buffer, key: string): SimulatedVerdict {
  const text = body.toString('latin1')
  if (text.includes(EICAR_SIGNATURE)) {
    return {
      scanStatus: 'COMPLETED',
      scanResultStatus: 'THREATS_FOUND',
      threats: [{ name: 'EICAR-Test-File (not a virus)', source: 'AMAZON', itemDetails: [{ hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', itemPath: key }] }],
      statusReasons: null,
    }
  }
  if (text.includes(SIMULATOR_MARKERS.passwordProtected)) return { scanStatus: 'SKIPPED', scanResultStatus: 'UNSUPPORTED', threats: null, statusReasons: ['PASSWORD_PROTECTED'] }
  if (text.includes(SIMULATOR_MARKERS.scanFailure)) return { scanStatus: 'FAILED', scanResultStatus: 'FAILED', threats: null, statusReasons: null }
  return { scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', threats: null, statusReasons: null }
}

export type EventInput = {
  account: string
  region: string
  planId: string
  bucket: string
  key: string
  versionId: string
  etag: string
  verdict: SimulatedVerdict
  eventId?: string
}

/** The EventBridge envelope exactly as AWS documents it for this detail-type. */
export function scanResultEvent(input: EventInput) {
  return {
    version: '0',
    id: input.eventId ?? randomUUID(),
    'detail-type': 'GuardDuty Malware Protection Object Scan Result',
    source: 'aws.guardduty',
    account: input.account,
    time: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    region: input.region,
    resources: [`arn:aws:guardduty:${input.region}:${input.account}:malware-protection-plan/${input.planId}`],
    detail: {
      schemaVersion: '1.0',
      scanStatus: input.verdict.scanStatus,
      resourceType: 'S3_OBJECT',
      s3ObjectDetails: { bucketName: input.bucket, objectKey: input.key, eTag: input.etag.replace(/"/g, ''), versionId: input.versionId, s3Throttled: false },
      scanResultDetails: {
        scanResultStatus: input.verdict.scanResultStatus,
        threats: input.verdict.threats ?? null,
        statusReasons: input.verdict.statusReasons ?? null,
      },
    },
  }
}

export type GuardDutySimulator = {
  controlUrl: string
  /** Direct (same-process) steering, for the local platform. */
  config: { hold: boolean; tagging: 'on' | 'off'; tagDelayMs: number; delayMs: number }
  release: () => number
  close: () => Promise<void>
}

export function startGuardDutySimulator(options: {
  s3: S3Stub
  sqs: SqsStub
  queue: string
  quarantineBucket: string
  region?: string
  account?: string
  delayMs?: number
  decide?: (body: Buffer, key: string) => SimulatedVerdict
}): Promise<GuardDutySimulator> {
  const region = options.region ?? 'ap-south-1'
  const account = options.account ?? '000000000000'
  const planId = 'b4c7f464ab3a4simulated'
  const decide = options.decide ?? defaultVerdict
  const config = { hold: false, tagging: 'on' as 'on' | 'off', tagDelayMs: 0, delayMs: options.delayMs ?? 30 }
  const held: { bucket: string; key: string; versionId: string; etag: string; verdict: SimulatedVerdict }[] = []

  options.s3.denyReadUnlessClean(options.quarantineBucket)

  const publish = (item: (typeof held)[number], copies = 1) => {
    const tagIt = () => {
      if (config.tagging === 'on') options.s3.tagVersion(item.bucket, item.key, item.versionId, { GuardDutyMalwareScanStatus: item.verdict.scanResultStatus })
    }
    if (config.tagDelayMs > 0) setTimeout(tagIt, config.tagDelayMs).unref?.()
    else tagIt()
    const eventId = randomUUID()
    for (let n = 0; n < copies; n += 1) {
      options.sqs.send(options.queue, JSON.stringify(scanResultEvent({ account, region, planId, ...item, eventId })))
    }
  }

  options.s3.onObjectCreated((created) => {
    if (created.bucket !== options.quarantineBucket) return
    const version = options.s3.readVersion(created.bucket, created.key, created.versionId)
    if (!version) return
    const item = { bucket: created.bucket, key: created.key, versionId: created.versionId, etag: created.etag, verdict: decide(version.body, created.key) }
    setTimeout(() => {
      if (config.hold) held.push(item)
      else publish(item)
    }, config.delayMs).unref?.()
  })

  const release = () => {
    const batch = held.splice(0, held.length)
    for (const item of batch) publish(item)
    return batch.length
  }

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://sim')
      const body = chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>) : {}
      const json = (status: number, value: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value))
      if (url.pathname === '/config' && req.method === 'POST') {
        if (typeof body.hold === 'boolean') config.hold = body.hold
        if (body.tagging === 'on' || body.tagging === 'off') config.tagging = body.tagging
        if (typeof body.tagDelayMs === 'number') config.tagDelayMs = body.tagDelayMs
        if (typeof body.delayMs === 'number') config.delayMs = body.delayMs
        return json(200, config)
      }
      if (url.pathname === '/release' && req.method === 'POST') return json(200, { released: release() })
      if (url.pathname === '/held') return json(200, held.map(({ key, versionId, verdict }) => ({ key, versionId, result: verdict.scanResultStatus })))
      if (url.pathname === '/emit' && req.method === 'POST') {
        const verdict: SimulatedVerdict = {
          scanStatus: body.scanStatus as SimulatedVerdict['scanStatus'],
          scanResultStatus: body.scanResultStatus as SimulatedVerdict['scanResultStatus'],
          threats: (body.threats as SimulatedVerdict['threats']) ?? null,
          statusReasons: (body.statusReasons as string[] | null | undefined) ?? null,
        }
        const bucket = (body.bucket as string | undefined) ?? options.quarantineBucket
        const key = String(body.key)
        const versionId = String(body.versionId)
        const known = options.s3.readVersion(bucket, key, versionId)
        const etag = (body.etag as string | undefined) ?? known?.etag ?? '"unknown"'
        // `tag` overrides what is written on the object: a string writes that tag, null writes none.
        if ('tag' in body) {
          if (typeof body.tag === 'string') options.s3.tagVersion(bucket, key, versionId, { GuardDutyMalwareScanStatus: body.tag })
        } else if (config.tagging === 'on') options.s3.tagVersion(bucket, key, versionId, { GuardDutyMalwareScanStatus: verdict.scanResultStatus })
        const eventId = (body.eventId as string | undefined) ?? randomUUID()
        for (let n = 0; n < Number(body.copies ?? 1); n += 1) {
          options.sqs.send(options.queue, JSON.stringify(scanResultEvent({ account, region, planId, bucket, key, versionId, etag, verdict, eventId })))
        }
        return json(200, { eventId })
      }
      json(404, { error: 'unknown control path' })
    })
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as import('node:net').AddressInfo
      resolve({
        controlUrl: `http://127.0.0.1:${port}`,
        config,
        release,
        close: () => new Promise<void>((done) => { server.closeAllConnections?.(); server.close(() => done()) }),
      })
    })
  })
}
