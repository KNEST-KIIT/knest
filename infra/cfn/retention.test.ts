import { describe, expect, it } from 'vitest'
import { assessRetention, collectRetention, FIVE_YEAR_LOG_DAYS } from '../../scripts/ops/retention-evidence.mjs'

const baseline = () => ({
  logGroup: { retentionInDays: 7 },
  bucket: { versioning: 'Enabled', rules: [{ ID: 'old', Status: 'Enabled', NoncurrentVersionExpiration: { NoncurrentDays: 90 } }] },
  database: { backupRetentionDays: 7 },
})

describe('retention evidence', () => {
  it('flags the current seven-day logs and 90-day upload version expiry', () => {
    const report = assessRetention(baseline())
    expect(report.logPreservation).toBe('unknown')
    expect(report.gaps.join(' ')).toMatch(/shorter.*expires records/)
    expect(report.backupRetentionDays).toBe(7)
    expect(report.hostedCompliance).toBe('not-established')
  })
  it.each([1826, 1825, -1, '1827', null])('does not accept an invalid/short five-year value: %s', (days) => {
    expect(assessRetention({ ...baseline(), logGroup: { retentionInDays: days } }).logPreservation).toBe('unknown')
  })
  it('recognises long log preservation without pretending that expiry is archiving', () => {
    const report = assessRetention({ ...baseline(), logGroup: { retentionInDays: FIVE_YEAR_LOG_DAYS } })
    expect(report.logPreservation).toBe('five-year-floor')
    expect(report.status).toBe('blocked')
    expect(report.gaps.join(' ')).toContain('Approved archive')
  })
  it('distinguishes no-expiry from a missing group', () => {
    expect(assessRetention({ ...baseline(), logGroup: {} }).logPreservation).toBe('no-expiry')
    expect(assessRetention({ ...baseline(), logGroup: null }).gaps.join(' ')).toContain('not found')
  })
  it('ignores disabled expiry rules and multipart aborts, but flags date-based expiry', () => {
    const report = assessRetention({ ...baseline(), bucket: { versioning: 'Enabled', rules: [
      { ID: 'disabled', Status: 'Disabled', Expiration: { Days: 1 } },
      { ID: 'multipart', Status: 'Enabled', AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 } },
      { ID: 'date', Status: 'Enabled', Expiration: { Date: '2030-01-01' } },
    ] } })
    expect(report.gaps.filter((g) => g.includes('lifecycle'))).toEqual([expect.stringContaining('date')])
  })
  it('does not treat missing bucket observations as a safe configuration', () => {
    expect(assessRetention({}).gaps.join(' ')).toMatch(/versioning.*lifecycle/)
  })
  it('rejects the documented root profile before invoking AWS', () => {
    const calls: string[] = []
    expect(() => collectRetention({ profile: 'claude-deploy', stack: 'knest-production-app' }, (...args) => { calls.push(String(args)); return '{}' })).toThrow(/root profile/)
    expect(calls).toEqual([])
  })
  it('stops after identity inspection if any other profile resolves to root', () => {
    let calls = 0
    expect(() => collectRetention({ profile: 'test', stack: 'knest-production-app' }, () => { calls++; return JSON.stringify({ Arn: 'arn:aws:iam::166917387892:root' }) })).toThrow(/assumed role/)
    expect(calls).toBe(1)
  })
  it('collects metadata with read-only commands and selects the exact log group', () => {
    const calls: string[][] = []
    const replies = [
      { Arn: 'arn:aws:sts::166917387892:assumed-role/knest-production-operator/test' },
      ...['/knest-production', 'bucket', 'db'].map((id) => ({ StackResourceDetail: { PhysicalResourceId: id } })),
      { logGroups: [{ logGroupName: '/knest-production-other', retentionInDays: 1827 }, { logGroupName: '/knest-production', retentionInDays: 7 }] },
      { Status: 'Enabled' }, { Rules: baseline().bucket.rules }, { DBInstances: [{ BackupRetentionPeriod: 7 }] },
    ]
    const report = collectRetention({ profile: 'test', stack: 'knest-production-app' }, (_command, args) => { calls.push(args); return JSON.stringify(replies.shift()) })
    expect(report.observation.logGroup?.retentionInDays).toBe(7)
    expect(calls.map((args) => args.slice(0, 2).join(' '))).toEqual([
      'sts get-caller-identity', ...Array(3).fill('cloudformation describe-stack-resource'),
      'logs describe-log-groups', 's3api get-bucket-versioning', 's3api get-bucket-lifecycle-configuration', 'rds describe-db-instances',
    ])
    expect(calls.every((args) => args.includes('--profile') && args.includes('test'))).toBe(true)
  })
})
