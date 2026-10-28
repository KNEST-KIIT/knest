type Env = Record<string, string | undefined>

/**
 * Where uploaded documents go and how their verdicts come back. One place reads these variables so the upload
 * route, the verdict worker, the reconcile job and the startup check agree.
 *
 *   QUARANTINE_BUCKET        isolated, versioned bucket every upload lands in first; GuardDuty scans it
 *   DOCUMENTS_BUCKET         separate bucket a document is copied to only after a clean verdict bound to its version
 *   DOCUMENTS_KMS_KEY_ARN    customer-managed KMS key both buckets encrypt with
 *   MALWARE_SCAN_QUEUE_URL   SQS queue that receives GuardDuty's EventBridge scan results
 *   S3_REGION                region of all of the above
 *
 * Optional: MALWARE_SCAN_DEADLINE_MINUTES (how long to wait for a verdict before failing the document, default 30),
 * MALWARE_SCAN_POLL_WAIT_SECONDS (SQS long-poll, default 20), SQS_ENDPOINT / S3_ENDPOINT (a local stand-in, tests only).
 */
export type ScanConfig = {
  region: string
  quarantineBucket: string
  documentsBucket: string
  kmsKeyArn: string
  queueUrl: string
  verdictDeadlineMinutes: number
  pollWaitSeconds: number
}

export type ScanConfigResult = { ok: true; config: ScanConfig } | { ok: false; problems: string[] }

const KMS_ARN = /^arn:aws[a-z-]*:kms:[a-z0-9-]+:\d{12}:(key|alias)\/\S+$/
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

function bounded(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw)
  return Number.isFinite(value) && raw !== undefined && raw !== '' ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback
}

/** Pure: takes the environment as a parameter so it can be tested. Reports variable names and rules, never values. */
export function readScanConfig(env: Env = process.env): ScanConfigResult {
  const problems: string[] = []
  const need = (name: string): string => {
    const value = env[name]?.trim()
    if (!value) problems.push(`${name}: is required but not set`)
    return value ?? ''
  }
  const region = need('S3_REGION')
  const quarantineBucket = need('QUARANTINE_BUCKET')
  const documentsBucket = need('DOCUMENTS_BUCKET')
  const kmsKeyArn = need('DOCUMENTS_KMS_KEY_ARN')
  const queueUrl = need('MALWARE_SCAN_QUEUE_URL')

  if (quarantineBucket && !BUCKET.test(quarantineBucket)) problems.push('QUARANTINE_BUCKET: is not a valid bucket name')
  if (documentsBucket && !BUCKET.test(documentsBucket)) problems.push('DOCUMENTS_BUCKET: is not a valid bucket name')
  if (quarantineBucket && documentsBucket && quarantineBucket === documentsBucket) {
    problems.push('DOCUMENTS_BUCKET: must differ from QUARANTINE_BUCKET (clean storage is separate from quarantine)')
  }
  if (env.S3_BUCKET && (env.S3_BUCKET === quarantineBucket || env.S3_BUCKET === documentsBucket)) {
    problems.push('S3_BUCKET: the CMS media bucket must differ from the quarantine and documents buckets')
  }
  if (kmsKeyArn && !KMS_ARN.test(kmsKeyArn)) problems.push('DOCUMENTS_KMS_KEY_ARN: must be a KMS key or alias ARN')
  if (queueUrl) {
    try {
      const url = new URL(queueUrl)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') problems.push('MALWARE_SCAN_QUEUE_URL: must be an http(s) URL')
    } catch {
      problems.push('MALWARE_SCAN_QUEUE_URL: must be an absolute URL')
    }
  }
  if (env.MALWARE_SCANNER_URL) {
    problems.push('MALWARE_SCANNER_URL: is no longer supported. Screening is GuardDuty plus the verdict queue; remove this variable so nobody believes an HTTP scanner is in use')
  }
  if (problems.length) return { ok: false, problems }
  return {
    ok: true,
    config: {
      region,
      quarantineBucket,
      documentsBucket,
      kmsKeyArn,
      queueUrl,
      verdictDeadlineMinutes: bounded(env.MALWARE_SCAN_DEADLINE_MINUTES, 30, 5, 1440),
      pollWaitSeconds: bounded(env.MALWARE_SCAN_POLL_WAIT_SECONDS, 20, 0, 20),
    },
  }
}

/** The configuration of this process, or null when document screening is not configured. */
export function scanConfigOrNull(env: Env = process.env): ScanConfig | null {
  const result = readScanConfig(env)
  return result.ok ? result.config : null
}
