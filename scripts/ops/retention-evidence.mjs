#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// CloudWatch's supported five-year value. This is a retention
// floor for collected logs, not an implementation of calendar-year archiving.
export const FIVE_YEAR_LOG_DAYS = 1827

export function assessRetention(input) {
  const gaps = []
  const log = input.logGroup
  let logPreservation = 'unknown'
  if (!log) gaps.push('Application log group was not found; collection/retention is unproved.')
  else if (log.retentionInDays === undefined) logPreservation = 'no-expiry'
  else if (Number.isInteger(log.retentionInDays) && log.retentionInDays >= FIVE_YEAR_LOG_DAYS) logPreservation = 'five-year-floor'
  else gaps.push('Application log expiry is shorter than the five-year floor or invalid.')

  // The bucket examined is the clean documents bucket: the only place applicant records are kept after screening.
  if (input.bucket?.versioning !== 'Enabled') gaps.push('Documents bucket versioning is not confirmed Enabled.')
  for (const rule of input.bucket?.rules ?? []) {
    if (rule.Status !== 'Enabled') continue
    if (rule.Expiration || rule.NoncurrentVersionExpiration) {
      gaps.push(`Documents lifecycle rule ${rule.ID ?? '(unnamed)'} expires records/versions without archive evidence.`)
    }
  }
  if (!input.bucket || !Array.isArray(input.bucket.rules)) gaps.push('Documents lifecycle configuration is unproved.')
  // Owner policy: five years, then transfer to an approved backup and archive. An enabled rule that moves documents to an
  // archive storage class at five years or later is the in-account implementation of that transfer. It is not deletion,
  // and it does not make the destination "approved": that remains the owner's decision (see the gap below).
  const archiveTransition = (input.bucket?.rules ?? []).some(
    (rule) =>
      rule.Status === 'Enabled' &&
      (rule.Transitions ?? []).some((transition) => /^(GLACIER|DEEP_ARCHIVE|GLACIER_IR)$/.test(transition.StorageClass ?? '') && Number.isInteger(transition.Days) && transition.Days >= FIVE_YEAR_LOG_DAYS),
  )
  if (Array.isArray(input.bucket?.rules) && !archiveTransition) gaps.push('No enabled rule moves documents to an archive storage class at five years or later.')
  // Inventory alone cannot certify an archive, legal holds, collection coverage,
  // record-level history, restoration or institutional access procedures.
  gaps.push('Approved archive destination, five-year transfer, legal holds, access and restore evidence are still required.')
  return {
    status: 'blocked',
    hostedCompliance: 'not-established',
    logPreservation,
    archiveTransition: archiveTransition ? 'five-year-archive-transition' : 'not-found',
    backupRetentionDays: input.database?.backupRetentionDays ?? null,
    backupNote: 'Rolling recovery backups do not establish five-year record retention or an archive.',
    gaps,
  }
}

/**
 * @param {{profile: string, stack: string}} options
 * @param {(file: string, args: string[], options: import('node:child_process').ExecFileSyncOptionsWithStringEncoding) => string} [run]
 */
export function collectRetention({ profile, stack }, run = execFileSync) {
  if (!profile || profile === 'claude-deploy' || !/^[A-Za-z0-9_+=,.@-]+$/.test(profile)) throw new Error('An explicit scoped AWS profile is required; the documented root profile is prohibited.')
  if (stack !== 'knest-production-app') throw new Error('Expected stack knest-production-app.')
  const read = (...args) => JSON.parse(run('aws', [...args, '--profile', profile, '--region', 'ap-south-1', '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }))
  const identity = read('sts', 'get-caller-identity')
  if (!/^arn:aws:sts::166917387892:assumed-role\//.test(identity.Arn ?? '')) throw new Error('Expected a scoped assumed role in the KNEST account; root and IAM-user sessions are refused.')
  const physical = (id) => {
    const result = read('cloudformation', 'describe-stack-resource', '--stack-name', stack, '--logical-resource-id', id)
    const value = result.StackResourceDetail?.PhysicalResourceId
    if (!value || typeof value !== 'string') throw new Error(`Missing physical resource: ${id}`)
    return value
  }
  const logName = physical('LogGroup')
  const bucketName = physical('DocumentsBucket')
  const dbName = physical('Database')
  const logs = read('logs', 'describe-log-groups', '--log-group-name-prefix', logName)
  const group = logs.logGroups?.find((g) => g.logGroupName === logName)
  const versioning = read('s3api', 'get-bucket-versioning', '--bucket', bucketName)
  // A missing lifecycle/AccessDenied is an observation failure, never an empty
  // successful configuration. No provider error text (or record content) is emitted.
  const lifecycle = read('s3api', 'get-bucket-lifecycle-configuration', '--bucket', bucketName)
  const database = read('rds', 'describe-db-instances', '--db-instance-identifier', dbName).DBInstances?.[0]
  if (!Array.isArray(logs.logGroups) || !Array.isArray(lifecycle.Rules) || !database) throw new Error('Incomplete provider observations.')
  const observation = {
    logGroup: group ? { name: logName, ...(group.retentionInDays === undefined ? {} : { retentionInDays: group.retentionInDays }) } : null,
    bucket: { name: bucketName, versioning: versioning.Status ?? 'unconfirmed', rules: lifecycle.Rules },
    database: { name: dbName, backupRetentionDays: database.BackupRetentionPeriod },
  }
  return { observedAt: new Date().toISOString(), stack, observation, assessment: assessRetention(observation) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--profile' || args[2] !== '--stack') {
    console.error('usage: node scripts/ops/retention-evidence.mjs --profile <scoped-role-profile> --stack knest-production-app')
    process.exitCode = 2
  } else {
    try {
      console.log(JSON.stringify(collectRetention({ profile: args[1], stack: args[3] }), null, 2))
      process.exitCode = 1 // Inventory is not institutional archive acceptance.
    } catch {
      console.error('Retention observation failed; no compliance result. Verify scoped role, read permissions and provider access. No AWS mutation was attempted.')
      process.exitCode = 2
    }
  }
}
