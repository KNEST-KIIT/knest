import { z } from 'zod'

/**
 * GuardDuty Malware Protection for S3 publishes one EventBridge event per scanned object version
 * ("GuardDuty Malware Protection Object Scan Result", source aws.guardduty, default event bus). This module is the
 * only place that reads such an event, and it is deliberately stingy: a document is `clean` only for the single
 * combination scanStatus COMPLETED + scanResultStatus NO_THREATS_FOUND + no threats listed, anything that reports a
 * threat is `infected`, UNSUPPORTED is `unscannable`, and every other value, including values AWS adds later, is
 * `scan_error`. Skipped, unscannable and error results are therefore never read as success.
 *
 * Event shape and value lists were checked against the AWS documentation on 2026-10-27
 * ("Monitoring S3 object scans with Amazon EventBridge"); the fixtures in scan-verdict.test.ts are its samples.
 * Nothing here scans bytes or claims to: it interprets what GuardDuty reported about one S3 object version.
 */

export const GUARDDUTY_SOURCE = 'aws.guardduty'
export const OBJECT_SCAN_DETAIL_TYPE = 'GuardDuty Malware Protection Object Scan Result'
/** GuardDuty writes this object itself when a protection plan is created or checked. It is not an upload. */
export const GUARDDUTY_VALIDATION_KEY = 'malware-protection-resource-validation-object'
/** The tag GuardDuty writes on a scanned object version when tagging is enabled on the plan. */
export const SCAN_TAG_KEY = 'GuardDutyMalwareScanStatus'

const text = z.string().min(1).max(2048)

const eventSchema = z.object({
  id: text,
  'detail-type': z.literal(OBJECT_SCAN_DETAIL_TYPE),
  source: z.literal(GUARDDUTY_SOURCE),
  account: z.string().regex(/^\d{12}$/),
  region: text,
  time: text,
  resources: z.array(z.string()).optional(),
  detail: z.object({
    schemaVersion: z.literal('1.0'),
    scanStatus: z.string().min(1),
    resourceType: z.literal('S3_OBJECT'),
    s3ObjectDetails: z.object({
      bucketName: text,
      objectKey: text,
      eTag: text,
      // Without a version id the verdict cannot be tied to one object, so it is not accepted.
      versionId: text,
      s3Throttled: z.boolean().optional(),
    }),
    scanResultDetails: z.object({
      scanResultStatus: z.string().min(1),
      threats: z
        .array(z.object({ name: z.string().optional() }).passthrough())
        .nullable()
        .optional(),
      statusReasons: z.array(z.string()).nullable().optional(),
    }),
  }),
})

export type ParsedScanEvent = {
  eventId: string
  account: string
  region: string
  time: string
  bucket: string
  key: string
  versionId: string
  etag: string
  scanStatus: string
  scanResultStatus: string
  threatNames: string[]
  statusReasons: string[]
}

export type ParseOutcome =
  | { ok: true; event: ParsedScanEvent }
  | { ok: false; reason: 'not-json' | 'not-object-scan-result' | 'malformed'; detail: string }

/** ETags arrive quoted in some responses and bare in others; compare them without the quotes. */
export function normalizeEtag(etag: string): string {
  return etag.trim().replace(/^"(.*)"$/, '$1')
}

/** Parses the body of one queue message. Never throws and never trusts a field it did not validate. */
export function parseScanResultMessage(body: string): ParseOutcome {
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return { ok: false, reason: 'not-json', detail: 'body is not JSON' }
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: false, reason: 'not-json', detail: 'body is not a JSON object' }
  }
  const envelope = json as Record<string, unknown>
  if (envelope.source !== GUARDDUTY_SOURCE || envelope['detail-type'] !== OBJECT_SCAN_DETAIL_TYPE) {
    return { ok: false, reason: 'not-object-scan-result', detail: `source=${String(envelope.source)} detail-type=${String(envelope['detail-type'])}` }
  }
  const parsed = eventSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, reason: 'malformed', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 5).join('; ') }
  }
  const { detail } = parsed.data
  const results = detail.scanResultDetails
  return {
    ok: true,
    event: {
      eventId: parsed.data.id,
      account: parsed.data.account,
      region: parsed.data.region,
      time: parsed.data.time,
      bucket: detail.s3ObjectDetails.bucketName,
      key: detail.s3ObjectDetails.objectKey,
      versionId: detail.s3ObjectDetails.versionId,
      etag: normalizeEtag(detail.s3ObjectDetails.eTag),
      scanStatus: detail.scanStatus,
      scanResultStatus: results.scanResultStatus,
      threatNames: (results.threats ?? []).map((threat) => (typeof threat.name === 'string' ? threat.name : '')).filter(Boolean),
      statusReasons: results.statusReasons ?? [],
    },
  }
}

export type VerdictDecision =
  | { status: 'clean'; result: 'NO_THREATS_FOUND' }
  | { status: 'infected'; result: string; threat: string | null }
  | { status: 'unscannable'; result: string; reasons: string[] }
  | { status: 'scan_error'; result: string; reasons: string[] }

/** The one function that can say a document is clean. Everything it does not recognise is an error. */
export function decideVerdict(event: Pick<ParsedScanEvent, 'scanStatus' | 'scanResultStatus' | 'threatNames' | 'statusReasons'>): VerdictDecision {
  const { scanStatus, scanResultStatus: result, threatNames, statusReasons } = event
  if (result === 'THREATS_FOUND' || threatNames.length > 0) {
    // A threat anywhere in the result is a threat, whatever else the event claims.
    return { status: 'infected', result: result || 'THREATS_FOUND', threat: threatNames[0]?.slice(0, 200) ?? null }
  }
  if (scanStatus === 'COMPLETED' && result === 'NO_THREATS_FOUND') {
    return { status: 'clean', result: 'NO_THREATS_FOUND' }
  }
  if (result === 'UNSUPPORTED') {
    return { status: 'unscannable', result, reasons: statusReasons.length ? statusReasons : ['UNSUPPORTED'] }
  }
  // ACCESS_DENIED, FAILED, a skipped or failed scan carrying a "clean" result, or a value we have never seen.
  return { status: 'scan_error', result: result || 'UNKNOWN', reasons: statusReasons.length ? statusReasons : [`scanStatus=${scanStatus}`] }
}

/** What an applicant is told, in plain words. No threat names, no internal codes. */
export function applicantMessage(status: 'pending' | 'clean' | 'infected' | 'unscannable' | 'scan_error', reasons: readonly string[] = []): string {
  switch (status) {
    case 'pending':
      return 'We are checking this file for malware. This usually takes a minute or two.'
    case 'clean':
      return 'This file passed the security check.'
    case 'infected':
      return 'This file did not pass the security check and was blocked. Choose a different file.'
    case 'unscannable':
      return reasons.includes('PASSWORD_PROTECTED')
        ? 'This file is password protected, so it could not be checked. Remove the password and upload it again.'
        : reasons.includes('OBJECT_SIZE_LIMIT_EXCEEDED') || reasons.includes('EXTRACTION_RATIO_LIMIT_EXCEEDED')
          ? 'This file is too large or too heavily compressed to be checked. Choose a smaller file.'
          : 'This file could not be checked, so it was not accepted. Upload it again or choose a different file.'
    case 'scan_error':
      return 'The security check could not be completed for this file. Upload it again.'
  }
}
