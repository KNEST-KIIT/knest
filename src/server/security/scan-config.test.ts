import { describe, expect, it } from 'vitest'
import { readScanConfig, scanConfigOrNull } from './scan-config'

const good = {
  S3_REGION: 'ap-south-1',
  QUARANTINE_BUCKET: 'knest-quarantine',
  DOCUMENTS_BUCKET: 'knest-documents',
  DOCUMENTS_KMS_KEY_ARN: 'arn:aws:kms:ap-south-1:123456789012:key/11111111-2222-3333-4444-555555555555',
  MALWARE_SCAN_QUEUE_URL: 'https://sqs.ap-south-1.amazonaws.com/123456789012/knest-scan-results',
}

describe('document screening configuration', () => {
  it('reads a complete configuration with sensible defaults', () => {
    const out = readScanConfig(good)
    expect(out).toEqual({
      ok: true,
      config: {
        region: 'ap-south-1',
        quarantineBucket: 'knest-quarantine',
        documentsBucket: 'knest-documents',
        kmsKeyArn: good.DOCUMENTS_KMS_KEY_ARN,
        queueUrl: good.MALWARE_SCAN_QUEUE_URL,
        verdictDeadlineMinutes: 30,
        pollWaitSeconds: 20,
      },
    })
  })

  it('is absent, not partially present: one missing variable turns screening off', () => {
    for (const name of Object.keys(good)) {
      expect(scanConfigOrNull({ ...good, [name]: undefined }), name).toBeNull()
      expect(scanConfigOrNull({ ...good, [name]: '  ' }), name).toBeNull()
    }
  })

  it('reports each problem by variable name and never repeats a value', () => {
    const out = readScanConfig({ ...good, QUARANTINE_BUCKET: 'Not_A_Bucket', DOCUMENTS_KMS_KEY_ARN: 'secret-looking-value', MALWARE_SCAN_QUEUE_URL: 'queue' })
    expect(out.ok).toBe(false)
    if (out.ok) return
    const text = out.problems.join('\n')
    expect(text).toContain('QUARANTINE_BUCKET')
    expect(text).toContain('DOCUMENTS_KMS_KEY_ARN')
    expect(text).toContain('MALWARE_SCAN_QUEUE_URL')
    expect(text).not.toContain('secret-looking-value')
    expect(text).not.toContain('Not_A_Bucket')
  })

  it('requires clean storage, quarantine and CMS media to be three different buckets', () => {
    expect(readScanConfig({ ...good, DOCUMENTS_BUCKET: good.QUARANTINE_BUCKET }).ok).toBe(false)
    expect(readScanConfig({ ...good, S3_BUCKET: good.QUARANTINE_BUCKET }).ok).toBe(false)
    expect(readScanConfig({ ...good, S3_BUCKET: good.DOCUMENTS_BUCKET }).ok).toBe(false)
    expect(readScanConfig({ ...good, S3_BUCKET: 'knest-media' }).ok).toBe(true)
  })

  it('accepts a KMS key or alias ARN only', () => {
    expect(readScanConfig({ ...good, DOCUMENTS_KMS_KEY_ARN: 'arn:aws:kms:ap-south-1:123456789012:alias/knest' }).ok).toBe(true)
    expect(readScanConfig({ ...good, DOCUMENTS_KMS_KEY_ARN: 'arn:aws:s3:::bucket' }).ok).toBe(false)
    expect(readScanConfig({ ...good, DOCUMENTS_KMS_KEY_ARN: '11111111-2222-3333-4444-555555555555' }).ok).toBe(false)
  })

  it('bounds the tunables instead of trusting them', () => {
    const at = (env: Record<string, string>) => {
      const out = readScanConfig({ ...good, ...env })
      if (!out.ok) throw new Error('expected ok')
      return out.config
    }
    expect(at({ MALWARE_SCAN_DEADLINE_MINUTES: '1' }).verdictDeadlineMinutes).toBe(5)
    expect(at({ MALWARE_SCAN_DEADLINE_MINUTES: '999999' }).verdictDeadlineMinutes).toBe(1440)
    expect(at({ MALWARE_SCAN_DEADLINE_MINUTES: 'soon' }).verdictDeadlineMinutes).toBe(30)
    expect(at({ MALWARE_SCAN_POLL_WAIT_SECONDS: '60' }).pollWaitSeconds).toBe(20)
    expect(at({ MALWARE_SCAN_POLL_WAIT_SECONDS: '0' }).pollWaitSeconds).toBe(0)
    expect(at({ MALWARE_SCAN_POLL_WAIT_SECONDS: '-5' }).pollWaitSeconds).toBe(0)
  })

  it('refuses to run beside the retired HTTP scanner variable', () => {
    const out = readScanConfig({ ...good, MALWARE_SCANNER_URL: 'http://127.0.0.1:3310/scan' })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.problems.join('\n')).toContain('MALWARE_SCANNER_URL: is no longer supported')
  })
})
