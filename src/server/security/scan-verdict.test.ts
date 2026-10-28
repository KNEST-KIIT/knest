import { describe, expect, it } from 'vitest'
import { applicantMessage, decideVerdict, normalizeEtag, parseScanResultMessage, type ParsedScanEvent } from './scan-verdict'

/**
 * The fixtures are the sample events AWS documents for "GuardDuty Malware Protection Object Scan Result"
 * ("Monitoring S3 object scans with Amazon EventBridge", checked 2026-10-27), with the placeholders filled in.
 */

const base = {
  version: '0',
  id: '72c7d362-737a-6dce-fc78-9e27a0171419',
  'detail-type': 'GuardDuty Malware Protection Object Scan Result',
  source: 'aws.guardduty',
  account: '111122223333',
  time: '2024-02-28T01:01:01Z',
  region: 'ap-south-1',
  resources: ['arn:aws:guardduty:ap-south-1:111122223333:malware-protection-plan/b4c7f464ab3a4EXAMPLE'],
}
const s3ObjectDetails = { bucketName: 'knest-quarantine', objectKey: '2026-10-27/0123456789abcdef0123456789abcdef.pdf', eTag: 'd41d8cd98f00b204e9800998ecf8427e', versionId: 'd41d8cd98f00b204e9800998eEXAMPLE', s3Throttled: false }
const event = (scanStatus: string, scanResultDetails: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ ...base, detail: { schemaVersion: '1.0', scanStatus, resourceType: 'S3_OBJECT', s3ObjectDetails, scanResultDetails, ...extra } })

const SAMPLES = {
  clean: event('COMPLETED', { scanResultStatus: 'NO_THREATS_FOUND', threats: null, statusReasons: null }),
  infected: event('COMPLETED', {
    scanResultStatus: 'THREATS_FOUND',
    threats: [{ name: 'EICAR-Test-File (not a virus)', source: 'AMAZON', itemDetails: [{ hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', itemPath: 'x' }] }],
    statusReasons: null,
  }),
  unsupported: event('SKIPPED', { scanResultStatus: 'UNSUPPORTED', threats: null, statusReasons: ['PASSWORD_PROTECTED'] }),
  accessDenied: event('SKIPPED', { scanResultStatus: 'ACCESS_DENIED', threats: null, statusReasons: ['SSE_C_ENCRYPTED_OBJECT'] }),
  failed: event('FAILED', { scanResultStatus: 'FAILED', threats: null, statusReasons: null }),
}

const parsed = (body: string): ParsedScanEvent => {
  const out = parseScanResultMessage(body)
  if (!out.ok) throw new Error(`expected a valid event, got ${out.reason}: ${out.detail}`)
  return out.event
}
const decide = (body: string) => decideVerdict(parsed(body))

describe('parsing the documented sample events', () => {
  it('reads the object binding: bucket, key, version id, ETag, event id', () => {
    const e = parsed(SAMPLES.clean)
    expect(e).toMatchObject({
      eventId: '72c7d362-737a-6dce-fc78-9e27a0171419',
      account: '111122223333',
      region: 'ap-south-1',
      bucket: 'knest-quarantine',
      key: '2026-10-27/0123456789abcdef0123456789abcdef.pdf',
      versionId: 'd41d8cd98f00b204e9800998eEXAMPLE',
      etag: 'd41d8cd98f00b204e9800998ecf8427e',
      scanStatus: 'COMPLETED',
      scanResultStatus: 'NO_THREATS_FOUND',
      threatNames: [],
      statusReasons: [],
    })
  })

  it('reads the first threat name and the skip reasons', () => {
    expect(parsed(SAMPLES.infected).threatNames).toEqual(['EICAR-Test-File (not a virus)'])
    expect(parsed(SAMPLES.unsupported).statusReasons).toEqual(['PASSWORD_PROTECTED'])
  })

  it('compares ETags without their quotes', () => {
    expect(normalizeEtag('"abc"')).toBe('abc')
    expect(normalizeEtag('abc')).toBe('abc')
    expect(normalizeEtag(' "abc" ')).toBe('abc')
    expect(parsed(event('COMPLETED', { scanResultStatus: 'NO_THREATS_FOUND' }).replace('d41d8cd98f00b204e9800998ecf8427e', '\\"d41d8cd98f00b204e9800998ecf8427e\\"')).etag).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })
})

describe('the only clean verdict', () => {
  it('is a completed scan that found no threats', () => {
    expect(decide(SAMPLES.clean)).toEqual({ status: 'clean', result: 'NO_THREATS_FOUND' })
  })

  it('is not granted to a clean result on a scan that did not complete', () => {
    for (const scanStatus of ['SKIPPED', 'FAILED', 'PENDING', '']) {
      const d = decideVerdict({ scanStatus, scanResultStatus: 'NO_THREATS_FOUND', threatNames: [], statusReasons: [] })
      expect(d.status, `scanStatus=${scanStatus}`).toBe('scan_error')
    }
  })

  it('is not granted when a threat is listed alongside a clean result', () => {
    const d = decideVerdict({ scanStatus: 'COMPLETED', scanResultStatus: 'NO_THREATS_FOUND', threatNames: ['Eicar'], statusReasons: [] })
    expect(d).toMatchObject({ status: 'infected', threat: 'Eicar' })
  })

  it.each(['no_threats_found', 'NO_THREATS_FOUND ', 'CLEAN', 'OK', 'SAFE', 'NO_THREATS', 'true', ''])('is not granted to the look-alike result %j', (result) => {
    const d = decideVerdict({ scanStatus: 'COMPLETED', scanResultStatus: result, threatNames: [], statusReasons: [] })
    expect(d.status).toBe('scan_error')
  })
})

describe('every other outcome is a rejection', () => {
  it('maps THREATS_FOUND to infected and keeps the threat name for staff', () => {
    expect(decide(SAMPLES.infected)).toEqual({ status: 'infected', result: 'THREATS_FOUND', threat: 'EICAR-Test-File (not a virus)' })
  })

  it('treats a threat as a threat whatever else the event claims', () => {
    const d = decideVerdict({ scanStatus: 'SKIPPED', scanResultStatus: 'THREATS_FOUND', threatNames: [], statusReasons: [] })
    expect(d.status).toBe('infected')
  })

  it('maps UNSUPPORTED (skipped) to unscannable with its reasons', () => {
    expect(decide(SAMPLES.unsupported)).toEqual({ status: 'unscannable', result: 'UNSUPPORTED', reasons: ['PASSWORD_PROTECTED'] })
  })

  it('maps ACCESS_DENIED and FAILED to scan_error, never to success', () => {
    expect(decide(SAMPLES.accessDenied)).toMatchObject({ status: 'scan_error', result: 'ACCESS_DENIED', reasons: ['SSE_C_ENCRYPTED_OBJECT'] })
    expect(decide(SAMPLES.failed)).toMatchObject({ status: 'scan_error', result: 'FAILED' })
  })

  it('maps a value AWS adds later to scan_error', () => {
    const d = decideVerdict({ scanStatus: 'COMPLETED', scanResultStatus: 'QUARANTINED_BY_POLICY', threatNames: [], statusReasons: [] })
    expect(d).toMatchObject({ status: 'scan_error', result: 'QUARANTINED_BY_POLICY' })
  })
})

/** The parts of an event the malformed-event cases below change. */
type EventDoc = {
  id?: string
  account?: string
  detail: {
    schemaVersion?: string
    scanStatus?: string
    resourceType?: string
    s3ObjectDetails: Record<string, unknown>
    scanResultDetails?: Record<string, unknown>
  }
}

describe('events that are not usable', () => {
  const bad = (body: string) => {
    const out = parseScanResultMessage(body)
    expect(out.ok).toBe(false)
    return out.ok ? null : out
  }

  it('rejects text that is not JSON, or JSON that is not an object', () => {
    expect(bad('not json')).toMatchObject({ reason: 'not-json' })
    expect(bad('[]')).toMatchObject({ reason: 'not-json' })
    expect(bad('"a string"')).toMatchObject({ reason: 'not-json' })
    expect(bad('null')).toMatchObject({ reason: 'not-json' })
  })

  it('rejects another source or detail type', () => {
    expect(bad(SAMPLES.clean.replace('aws.guardduty', 'aws.s3'))).toMatchObject({ reason: 'not-object-scan-result' })
    expect(bad(SAMPLES.clean.replace('Object Scan Result', 'Resource Status Active'))).toMatchObject({ reason: 'not-object-scan-result' })
    expect(bad(SAMPLES.clean.replace('"source":"aws.guardduty"', '"source":"custom.app"'))).toMatchObject({ reason: 'not-object-scan-result' })
  })

  it.each([
    ['no version id', (e: EventDoc) => delete e.detail.s3ObjectDetails.versionId],
    ['an empty version id', (e: EventDoc) => (e.detail.s3ObjectDetails.versionId = '')],
    ['no object key', (e: EventDoc) => delete e.detail.s3ObjectDetails.objectKey],
    ['no bucket', (e: EventDoc) => delete e.detail.s3ObjectDetails.bucketName],
    ['no ETag', (e: EventDoc) => delete e.detail.s3ObjectDetails.eTag],
    ['no scan result', (e: EventDoc) => delete e.detail.scanResultDetails?.scanResultStatus],
    ['no scan result block', (e: EventDoc) => delete e.detail.scanResultDetails],
    ['no scan status', (e: EventDoc) => delete e.detail.scanStatus],
    ['a different resource type', (e: EventDoc) => (e.detail.resourceType = 'EC2_VOLUME')],
    ['a different schema version', (e: EventDoc) => (e.detail.schemaVersion = '2.0')],
    ['no event id', (e: EventDoc) => delete e.id],
    ['a malformed account', (e: EventDoc) => (e.account = 'abc')],
    ['a non-string version id', (e: EventDoc) => (e.detail.s3ObjectDetails.versionId = 12345)],
  ])('rejects an event with %s', (_label, mutate) => {
    const e = JSON.parse(SAMPLES.clean) as EventDoc
    mutate(e)
    expect(bad(JSON.stringify(e))).toMatchObject({ reason: 'malformed' })
  })
})

describe('what an applicant is told', () => {
  it('uses plain words for every state and never mentions a threat or an internal code', () => {
    const states = ['pending', 'clean', 'infected', 'unscannable', 'scan_error'] as const
    for (const state of states) {
      const message = applicantMessage(state)
      expect(message.length).toBeGreaterThan(10)
      expect(message).not.toMatch(/THREATS?_FOUND|EICAR|GuardDuty|quarantine|S3|ACCESS_DENIED|[A-Z]{4,}_[A-Z_]+/)
    }
  })

  it('explains the common unscannable reasons specifically', () => {
    expect(applicantMessage('unscannable', ['PASSWORD_PROTECTED'])).toMatch(/password protected/i)
    expect(applicantMessage('unscannable', ['OBJECT_SIZE_LIMIT_EXCEEDED'])).toMatch(/too large/i)
    expect(applicantMessage('unscannable', ['EXTRACTION_RATIO_LIMIT_EXCEEDED'])).toMatch(/compressed/i)
    expect(applicantMessage('unscannable', ['SOMETHING_NEW'])).toMatch(/could not be checked/i)
  })
})
