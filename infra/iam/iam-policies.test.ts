import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The IAM documents in infra/iam are drafts for the account owner to apply; nothing here creates them. These tests keep
 * them well-formed and keep the document-screening guarantees from being undone by an edit: operators can see the
 * pipeline's health but cannot read documents, tag objects, or use the key.
 */

const dir = new URL('./', import.meta.url)
const load = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- policy documents are open-ended
const actionsOf = (statement: Record<string, any>): string[] => [statement.Action].flat() // eslint-disable-line @typescript-eslint/no-explicit-any
/** IAM action matching: `*` and `?` wildcards, case-insensitive, so `logs:Describe*` grants `logs:DescribeLogGroups`. */
const matches = (patterns: string[], action: string): boolean =>
  patterns.some((pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i').test(action))

describe('every IAM draft is valid JSON', () => {
  it.each(readdirSync(dir).filter((f) => f.endsWith('.json')))('%s parses', (name) => {
    expect(() => load(name)).not.toThrow()
  })
})

describe('operator policy and document screening', () => {
  const policy = load('operator-policy.json')
  const allowed = policy.Statement.filter((s: Record<string, any>) => s.Effect === 'Allow').flatMap(actionsOf) as string[] // eslint-disable-line @typescript-eslint/no-explicit-any
  const denied = policy.Statement.filter((s: Record<string, any>) => s.Effect === 'Deny').flatMap(actionsOf) as string[] // eslint-disable-line @typescript-eslint/no-explicit-any

  it('lets the operator observe the pipeline: queue depth, plan status, key, rules, bucket settings and scan tags', () => {
    for (const action of [
      'sqs:GetQueueAttributes', 'guardduty:GetMalwareProtectionPlan', 'kms:DescribeKey', 'kms:GetKeyPolicy', 'events:DescribeRule',
      's3:GetBucketPolicy', 's3:GetLifecycleConfiguration', 's3:GetEncryptionConfiguration', 's3:GetBucketNotification', 's3:GetObjectVersionTagging',
    ]) expect(allowed, action).toContain(action)
  })

  it('does not let the operator read documents, change tags, or use the key for data', () => {
    // Wildcard-aware: an `s3:Get*` grant would give this away without ever naming the action.
    for (const action of ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObjectTagging', 's3:PutObjectVersionTagging', 'kms:Decrypt', 'kms:GenerateDataKey', 'sqs:ReceiveMessage', 'sqs:DeleteMessage']) {
      expect(matches(allowed, action), `${action} must not be granted`).toBe(false)
    }
    for (const action of ['kms:Decrypt', 'kms:ScheduleKeyDeletion', 's3:DeleteObject', 's3:DeleteObjectVersion', 's3:DeleteBucket']) expect(denied, action).toContain(action)
  })

  it('lets the retention evidence script make every call it makes', () => {
    // One IAM action per AWS CLI call in scripts/ops/retention-evidence.mjs. sts:GetCallerIdentity needs no permission.
    // The singular DescribeStackResource is what `cloudformation describe-stack-resource` requires; the plural is a different action.
    for (const action of ['cloudformation:DescribeStackResource', 'logs:DescribeLogGroups', 's3:GetBucketVersioning', 's3:GetLifecycleConfiguration', 'rds:DescribeDBInstances']) {
      expect(matches(allowed, action), `${action} is allowed`).toBe(true)
      expect(matches(denied, action), `${action} is not denied`).toBe(false)
    }
    const script = readFileSync(new URL('../../scripts/ops/retention-evidence.mjs', import.meta.url), 'utf8')
    for (const call of ["'describe-stack-resource'", "'describe-log-groups'", "'get-bucket-versioning'", "'get-bucket-lifecycle-configuration'", "'describe-db-instances'"]) {
      expect(script, `${call} is still what the script runs`).toContain(call)
    }
  })
})

describe('CloudFormation service role: what the screening resources need', () => {
  const delta = load('cfn-service-role-screening-delta.json')
  const all = delta.Statement.flatMap(actionsOf) as string[]
  const text = readFileSync(new URL('../cfn/app.yaml', import.meta.url), 'utf8')

  it('covers every resource type the template adds for screening', () => {
    const needs: [string, string][] = [
      ['AWS::KMS::Key', 'kms:CreateKey'], ['AWS::KMS::Alias', 'kms:CreateAlias'], ['AWS::S3::Bucket', 's3:CreateBucket'],
      ['AWS::S3::BucketPolicy', 's3:PutBucketPolicy'], ['AWS::SQS::Queue', 'sqs:CreateQueue'], ['AWS::Events::Rule', 'events:PutRule'],
      ['AWS::SNS::TopicPolicy', 'sns:SetTopicAttributes'], ['AWS::IAM::Role', 'iam:CreateRole'], ['AWS::IAM::Policy', 'iam:PutRolePolicy'],
      ['AWS::GuardDuty::MalwareProtectionPlan', 'guardduty:CreateMalwareProtectionPlan'], ['AWS::CloudWatch::Alarm', 'cloudwatch:PutMetricAlarm'],
      ['AWS::Logs::MetricFilter', 'logs:PutMetricFilter'],
    ]
    for (const [type, action] of needs) {
      expect(text, type).toContain(`Type: ${type}`)
      expect(all, `${type} needs ${action}`).toContain(action)
    }
  })

  it('hands the scan role only to GuardDuty, and is scoped by name and region rather than a wildcard account', () => {
    const pass = delta.Statement.find((s: Record<string, any>) => s.Sid === 'HandTheScanRoleToGuardDutyOnly') // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(pass.Condition).toEqual({ StringEquals: { 'iam:PassedToService': 'malware-protection-plan.guardduty.amazonaws.com' } })
    const flat = JSON.stringify(delta.Statement)
    expect(flat).not.toMatch(/"(s3|sqs|events|iam|kms|guardduty):\*"/)
    expect(flat).not.toContain('"Resource":"arn:aws:iam::*')
  })
})
