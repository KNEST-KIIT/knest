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

describe('five years, then archive: what the evidence recognises', () => {
  const withRules = (rules: unknown[]) => assessRetention({ ...baseline(), bucket: { versioning: 'Enabled', rules } })
  const archive = (over: Record<string, unknown> = {}) => ({ ID: 'archive-after-five-years', Status: 'Enabled', Transitions: [{ Days: 1827, StorageClass: 'DEEP_ARCHIVE' }], ...over })

  it('recognises an enabled rule that moves documents to an archive tier at five years', () => {
    const report = withRules([archive()])
    expect(report.archiveTransition).toBe('five-year-archive-transition')
    expect(report.gaps.join(' ')).not.toContain('No enabled rule moves documents')
    // Still blocked: the destination is not an approved procedure, and nothing here proves restore or access.
    expect(report.status).toBe('blocked')
    expect(report.gaps.join(' ')).toContain('Approved archive destination')
  })

  it.each([
    ['moves at one year, not five', archive({ Transitions: [{ Days: 365, StorageClass: 'DEEP_ARCHIVE' }] })],
    ['moves at 1826 days, a day short of five years', archive({ Transitions: [{ Days: 1826, StorageClass: 'GLACIER' }] })],
    ['is disabled', archive({ Status: 'Disabled' })],
    ['moves to a tier that is not an archive', archive({ Transitions: [{ Days: 1827, StorageClass: 'STANDARD_IA' }] })],
    ['has no transition at all', { ID: 'noncurrent-only', Status: 'Enabled', NoncurrentVersionExpiration: { NoncurrentDays: 90 } }],
  ])('does not count a rule that %s', (_label, rule) => {
    const report = withRules([rule])
    expect(report.archiveTransition).toBe('not-found')
    expect(report.gaps.join(' ')).toContain('No enabled rule moves documents to an archive storage class at five years or later')
  })

  it('flags an archive rule that would skip small files, since S3 does not archive objects under 128 KB by default', () => {
    const optedIn = assessRetention({ ...baseline(), bucket: { versioning: 'Enabled', transitionDefaultMinimumObjectSize: 'varies_by_storage_class', rules: [archive()] } })
    expect(optedIn.gaps.join(' ')).not.toContain('128 KB')
    for (const setting of [undefined, 'all_storage_classes_128K']) {
      const report = assessRetention({ ...baseline(), bucket: { versioning: 'Enabled', transitionDefaultMinimumObjectSize: setting, rules: [archive()] } })
      expect(report.archiveTransition).toBe('five-year-archive-transition')
      expect(report.gaps.join(' ')).toContain('smaller than 128 KB are not moved to the archive tier')
    }
  })

  it('reads the default-minimum-object-size setting from the lifecycle response', () => {
    const replies = [
      { Arn: 'arn:aws:sts::166917387892:assumed-role/knest-production-operator/test' },
      ...['/knest-production', 'documents-bucket', 'db'].map((id) => ({ StackResourceDetail: { PhysicalResourceId: id } })),
      { logGroups: [{ logGroupName: '/knest-production', retentionInDays: 1827 }] },
      { Status: 'Enabled' }, { TransitionDefaultMinimumObjectSize: 'varies_by_storage_class', Rules: [archive()] }, { DBInstances: [{ BackupRetentionPeriod: 7 }] },
    ]
    const report = collectRetention({ profile: 'test', stack: 'knest-production-app' }, () => JSON.stringify(replies.shift()))
    expect(report.observation.bucket.transitionDefaultMinimumObjectSize).toBe('varies_by_storage_class')
    expect(report.assessment.gaps.join(' ')).not.toContain('128 KB')
  })

  it('still flags a rule that deletes current versions, even beside a valid archive rule', () => {
    const report = withRules([archive(), { ID: 'delete-old', Status: 'Enabled', Expiration: { Days: 3650 } }])
    expect(report.archiveTransition).toBe('five-year-archive-transition')
    expect(report.gaps.join(' ')).toContain('Documents lifecycle rule delete-old expires records/versions')
  })

  it('reads the documents bucket of the app stack, not the media bucket', () => {
    const asked: string[] = []
    const replies = [
      { Arn: 'arn:aws:sts::166917387892:assumed-role/knest-production-operator/test' },
      ...['/knest-production', 'documents-bucket', 'db'].map((id) => ({ StackResourceDetail: { PhysicalResourceId: id } })),
      { logGroups: [{ logGroupName: '/knest-production', retentionInDays: 1827 }] },
      { Status: 'Enabled' }, { Rules: [archive()] }, { DBInstances: [{ BackupRetentionPeriod: 7 }] },
    ]
    collectRetention({ profile: 'test', stack: 'knest-production-app' }, (_c, args) => { asked.push(args.join(' ')); return JSON.stringify(replies.shift()) })
    expect(asked.filter((a) => a.startsWith('cloudformation describe-stack-resource')).map((a) => a.split('--logical-resource-id ')[1]!.split(' ')[0])).toEqual(['LogGroup', 'DocumentsBucket', 'Database'])
    expect(asked.some((a) => a.includes('--bucket documents-bucket'))).toBe(true)
  })
})
