import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render } from '../../scripts/render-cfn.mjs'

/**
 * The IAM documents in infra/iam are drafts for the account owner to apply; nothing here creates them. These tests keep
 * them well-formed and keep the document-screening guarantees from being undone by an edit: operators can see the
 * pipeline's health but cannot read documents, tag objects, or use the key.
 */

const dir = new URL('./', import.meta.url)
const load = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- policy documents are open-ended
const actionsOf = (statement: Record<string, any>): string[] => [statement.Action].flat() // eslint-disable-line @typescript-eslint/no-explicit-any
const TEMPLATE_BUCKET = ['arn:aws:s3:::knest-templates-166917387892', 'arn:aws:s3:::knest-templates-166917387892/*']
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
    for (const action of ['s3:GetObjectVersion', 's3:PutObjectTagging', 's3:PutObjectVersionTagging', 'kms:Decrypt', 'kms:GenerateDataKey', 'sqs:ReceiveMessage', 'sqs:DeleteMessage']) {
      expect(matches(allowed, action), `${action} must not be granted`).toBe(false)
    }
    // The one object read the operator has is of CloudFormation templates, in the template bucket and nowhere else.
    const readers = policy.Statement.filter((s: Record<string, any>) => s.Effect === 'Allow' && matches(actionsOf(s), 's3:GetObject')) // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(readers.length).toBeGreaterThan(0)
    for (const statement of readers) expect([statement.Resource].flat(), statement.Sid).toEqual(TEMPLATE_BUCKET)
    for (const action of ['kms:Decrypt', 'kms:ScheduleKeyDeletion', 's3:DeleteObject', 's3:DeleteObjectVersion', 's3:DeleteBucket']) expect(denied, action).toContain(action)
  })

  it('lets the operator upload and read templates in the template bucket, and still not delete them', () => {
    // The app template is over CloudFormation's 51,200-byte inline limit (infra/cfn/release-gates.test.ts), so it is
    // uploaded to S3 and passed by URL; CloudFormation reads it with the caller's permissions.
    const statement = policy.Statement.find((s: Record<string, any>) => s.Sid === 'TemplateBucket') // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(statement.Effect).toBe('Allow')
    expect(actionsOf(statement).sort()).toEqual(['s3:GetBucketLocation', 's3:GetObject', 's3:ListBucket', 's3:PutObject'])
    expect(statement.Resource).toEqual(TEMPLATE_BUCKET)
    for (const action of ['s3:DeleteObject', 's3:DeleteObjectVersion', 's3:DeleteBucket']) expect(matches(denied, action), action).toBe(true)
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

describe('S-1 CloudFormation service role (knest-s1-cfn-service): screening permissions, and no way to production', () => {
  // cfn-service-role-s1-screening.json is the document the account owner attaches to knest-s1-cfn-service as it stands (IAM
  // rejects unknown top-level keys, so it carries no notes; this block is its documentation). The shared delta above names
  // production and S-1 together and is for the production role only.
  const ACCOUNT = '166917387892'
  const policy = load('cfn-service-role-s1-screening.json')
  const statements = policy.Statement as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  const text = readFileSync(new URL('../cfn/app.yaml', import.meta.url), 'utf8')
  const resourcesOf = (statement: Record<string, any>): string[] => [statement.Resource].flat() // eslint-disable-line @typescript-eslint/no-explicit-any
  const allowActions = statements.filter((s) => s.Effect === 'Allow').flatMap(actionsOf)
  /** IAM resource matching: `*` and `?` wildcards, case-sensitive (unlike actions). */
  const globMatch = (pattern: string, value: string): boolean =>
    new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(value)
  /** Whether a statement that names its resources allows the action on the ARN. Statements with `Resource: "*"` are judged separately below. */
  const allowedByName = (action: string, arn: string): boolean =>
    statements.some((s) => s.Effect === 'Allow' && !resourcesOf(s).includes('*') && matches(actionsOf(s), action) && resourcesOf(s).some((r) => globMatch(r, arn)))

  /** Every named screening resource of the template, rendered for one environment, as the ARN and the actions CloudFormation needs on it. */
  const needsFor = (env: 's1' | 'production'): [string, string][] => {
    const rendered = render(text, env)
    const fill = (name: string) => name.replaceAll('${Environment}', env).replaceAll('${AWS::AccountId}', ACCOUNT)
    const names = (key: string, only = /./) =>
      [...rendered.matchAll(new RegExp(`^\\s+${key}: !Sub '([^']+)'`, 'gm'))].map((m) => fill(m[1] ?? '')).filter((name) => only.test(name))
    const found: [string, string][] = []
    const add = (arns: string[], actions: string[]) => {
      expect(arns.length, `the template names at least one resource for ${actions[0]}`).toBeGreaterThan(0)
      for (const arn of arns) for (const action of actions) found.push([action, arn])
    }
    add(names('BucketName').map((n) => `arn:aws:s3:::${n}`), ['s3:CreateBucket', 's3:PutBucketPolicy', 's3:PutLifecycleConfiguration', 's3:PutBucketNotification', 's3:DeleteBucket'])
    add(names('QueueName').map((n) => `arn:aws:sqs:ap-south-1:${ACCOUNT}:${n}`), ['sqs:CreateQueue', 'sqs:SetQueueAttributes', 'sqs:DeleteQueue'])
    add(names('Name', /^knest-.*-scan-/).map((n) => `arn:aws:events:ap-south-1:${ACCOUNT}:rule/${n}`), ['events:PutRule', 'events:PutTargets', 'events:DeleteRule'])
    add(names('TopicName').map((n) => `arn:aws:sns:ap-south-1:${ACCOUNT}:${n}`), ['sns:SetTopicAttributes'])
    add(names('RoleName', /-guardduty-malware$/).map((n) => `arn:aws:iam::${ACCOUNT}:role/${n}`), ['iam:CreateRole', 'iam:DeleteRole', 'iam:PutRolePolicy', 'iam:DeleteRolePolicy', 'iam:PassRole'])
    add(names('RoleName', /-ec2$/).map((n) => `arn:aws:iam::${ACCOUNT}:role/${n}`), ['iam:PutRolePolicy', 'iam:DeleteRolePolicy'])
    add(names('AliasName').map((n) => `arn:aws:kms:ap-south-1:${ACCOUNT}:${n}`), ['kms:CreateAlias', 'kms:DeleteAlias'])
    add(names('LogGroupName', /^\//).map((n) => `arn:aws:logs:ap-south-1:${ACCOUNT}:log-group:${n}:*`), ['logs:PutMetricFilter', 'logs:DeleteMetricFilter'])
    // Alarms are not named in the template; CloudFormation names them <stack>-<LogicalId>-<suffix> and the stack is knest-<environment>.
    add([`arn:aws:cloudwatch:ap-south-1:${ACCOUNT}:alarm:knest-${env}-MalwareScanAttentionAlarm-ABC123`], ['cloudwatch:PutMetricAlarm', 'cloudwatch:DeleteAlarms'])
    return found
  }

  it('is a document IAM accepts as it stands: only Version and Statement, only the elements this policy needs, within the managed-policy size limit', () => {
    expect(Object.keys(policy).sort()).toEqual(['Statement', 'Version'])
    expect(policy.Version).toBe('2012-10-17')
    const sids = statements.map((s) => s.Sid as string)
    expect(new Set(sids).size, 'Sids are unique').toBe(sids.length)
    for (const statement of statements) {
      expect(statement.Sid, 'Sid is alphanumeric').toMatch(/^[A-Za-z0-9]+$/)
      expect(['Allow', 'Deny'], statement.Sid).toContain(statement.Effect)
      expect(Object.keys(statement).every((k) => ['Sid', 'Effect', 'Action', 'Resource', 'Condition'].includes(k)), `${statement.Sid} uses no Principal, NotAction or NotResource`).toBe(true)
      expect(actionsOf(statement).length, statement.Sid).toBeGreaterThan(0)
      expect(resourcesOf(statement).length, statement.Sid).toBeGreaterThan(0)
    }
    // IAM counts characters without whitespace; 6,144 is the managed-policy limit.
    expect(JSON.stringify(policy).replace(/\s/g, '').length).toBeLessThan(6144)
  })

  it('covers every screening resource of the S-1 rendering of the app template, for create, update and delete', () => {
    // The names are read from the rendered template, so a renamed resource or a new one fails here instead of in a change set.
    const s1 = needsFor('s1')
    expect(s1.length).toBeGreaterThan(30)
    for (const [action, arn] of s1) expect(allowedByName(action, arn), `${action} on ${arn}`).toBe(true)

    const rendered = render(text, 's1')
    for (const resource of ['DocumentsKey', 'QuarantineBucket', 'DocumentsBucket']) {
      expect(rendered, `${resource} is deleted with the S-1 stack`).toMatch(new RegExp(`  ${resource}:\\r?\\n    Type: [A-Za-z:0-9]+\\r?\\n    DeletionPolicy: Delete`))
    }
    // The key is the one resource whose name is an alias and whose id is generated; its lifecycle is covered through the alias guard below.
    for (const action of ['kms:CreateKey', 'kms:EnableKeyRotation', 'kms:PutKeyPolicy', 'kms:TagResource', 'kms:ScheduleKeyDeletion', 'kms:DescribeKey', 'kms:ListAliases']) {
      expect(matches(allowActions, action), action).toBe(true)
    }
    // The plan has a generated id too; it is found by the Name tag the template gives it.
    for (const action of ['guardduty:CreateMalwareProtectionPlan', 'guardduty:GetMalwareProtectionPlan', 'guardduty:UpdateMalwareProtectionPlan', 'guardduty:DeleteMalwareProtectionPlan']) {
      expect(matches(allowActions, action), action).toBe(true)
    }
    for (const action of ['cloudwatch:DescribeAlarms', 'logs:DescribeMetricFilters', 's3:GetBucketPolicy', 'sqs:GetQueueAttributes', 'events:DescribeRule', 'iam:GetRole', 'sns:GetTopicAttributes']) {
      expect(matches(allowActions, action), action).toBe(true)
    }
  })

  it('names no production resource, no production name, and no placeholder', () => {
    const flat = JSON.stringify(policy)
    expect(flat).not.toMatch(/production/i)
    expect(flat).not.toMatch(/<[A-Za-z_]+>/)
    expect(flat.match(/\b\d{12}\b/g)?.every((id) => id === ACCOUNT), 'the only account is the S-1 account').toBe(true)
    // Every named resource says knest-s1. The two with generated ids (keys, protection plans) are the only ones that cannot; they are guarded below.
    const generated = ['arn:aws:kms:ap-south-1:166917387892:key/*', 'arn:aws:guardduty:ap-south-1:166917387892:malware-protection-plan/*']
    for (const arn of statements.flatMap(resourcesOf).filter((r) => r !== '*' && !generated.includes(r))) {
      expect(arn, 'S-1 names only').toMatch(/knest-s1/)
      expect(arn, 'Mumbai or global').toMatch(/^arn:aws:(s3:::|iam::|[a-z0-9]+:ap-south-1:)/)
    }
  })

  it('cannot reach the production resources the same template creates', () => {
    const production = needsFor('production')
    expect(production.length).toBe(needsFor('s1').length)
    for (const [action, arn] of production) expect(allowedByName(action, arn), `${action} must not be allowed on ${arn}`).toBe(false)
    // Wider than the actions CloudFormation needs: no action in the policy, resource-scoped or not, may match a production ARN of its own service.
    for (const [, arn] of production) {
      const service = arn.split(':')[2] as string
      for (const action of allowActions.filter((a) => a.startsWith(`${service}:`))) expect(allowedByName(action, arn), `${action} on ${arn}`).toBe(false)
    }
    // The alarm prefix and rule prefix are the only wildcards in a name, and neither is a prefix of the production names.
    expect(globMatch('arn:aws:events:ap-south-1:166917387892:rule/knest-s1-scan-*', 'arn:aws:events:ap-south-1:166917387892:rule/knest-production-scan-results')).toBe(false)
  })

  it('leaves unscoped resources to the few calls that take no resource, and fences the two kinds of generated id', () => {
    const wildcard = statements.filter((s) => resourcesOf(s).includes('*'))
    const unnameable = ['kms:CreateKey', 'kms:ListAliases', 'guardduty:CreateMalwareProtectionPlan', 'guardduty:TagResource', 'guardduty:ListMalwareProtectionPlans', 'cloudwatch:DescribeAlarms']
    for (const statement of wildcard) {
      expect(statement.Effect, statement.Sid).toBe('Allow')
      expect(actionsOf(statement).every((a) => unnameable.includes(a)), `${statement.Sid} grants only calls that cannot name a resource`).toBe(true)
      expect(statement.Condition?.StringEquals?.['aws:RequestedRegion'], `${statement.Sid} is limited to Mumbai`).toBe('ap-south-1')
    }

    // Protection plans: create only with the S-1 Name tag the template gives the plan; manage only a plan that carries it.
    const planTag = /MalwareProtectionPlan:[\s\S]*?Tags: \[\{ Key: Name, Value: !Sub '([^']+)' \}\]/.exec(text)?.[1]?.replaceAll('${Environment}', 's1')
    expect(planTag).toBe('knest-s1-quarantine')
    const guardDuty = statements.filter((s) => actionsOf(s).some((a) => a.startsWith('guardduty:') && a !== 'guardduty:ListMalwareProtectionPlans'))
    expect(guardDuty.length).toBeGreaterThan(1)
    for (const statement of guardDuty) {
      const tagCondition = statement.Condition?.StringEquals?.['aws:RequestTag/Name'] ?? statement.Condition?.StringEquals?.['aws:ResourceTag/Name']
      expect(tagCondition, `${statement.Sid} only touches plans tagged for S-1`).toBe(planTag)
    }

    // Keys: every key-level call is denied on a key that carries any alias other than knest-s1-*, so the production key (alias
    // knest-production-documents) cannot be described, re-keyed, re-tagged, or scheduled for deletion. A key with no alias yet
    // (CloudFormation creates the key before its alias) is not denied, which is what lets the stack create it.
    const keyAllow = statements.find((s) => s.Sid === 'S1DocumentsKeyLifecycle') as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    const keyDeny = statements.find((s) => s.Effect === 'Deny') as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(statements.filter((s) => s.Effect === 'Deny').length).toBe(1)
    expect(resourcesOf(keyDeny)).toEqual(resourcesOf(keyAllow))
    const keyAliasAllow = statements.find((s) => s.Sid === 'AliasTheS1DocumentsKey') as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(resourcesOf(keyAliasAllow)).toEqual(resourcesOf(keyAllow))
    for (const action of [...actionsOf(keyAllow), ...actionsOf(keyAliasAllow)]) expect(actionsOf(keyDeny), `${action} is guarded`).toContain(action)
    expect(keyDeny.Condition).toEqual({ 'ForAnyValue:StringNotLike': { 'kms:ResourceAliases': 'alias/knest-s1-*' } })
    const aliasTemplate = /AliasName: !Sub '([^']+)'/.exec(text)?.[1] as string
    const denied = (aliases: string[]) => aliases.some((alias) => !globMatch(keyDeny.Condition['ForAnyValue:StringNotLike']['kms:ResourceAliases'], alias))
    expect(denied([aliasTemplate.replaceAll('${Environment}', 's1')]), 'the S-1 key is usable').toBe(false)
    expect(denied([aliasTemplate.replaceAll('${Environment}', 'production')]), 'the production key is fenced off').toBe(true)
    expect(denied(['alias/knest-s1-documents', 'alias/knest-production-documents']), 'a key that also carries a production alias is fenced off').toBe(true)
    // The alias itself can only be this one.
    const aliasAllow = statements.find((s) => s.Sid === 'AliasOfTheS1DocumentsKey') as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(resourcesOf(aliasAllow)).toEqual([`arn:aws:kms:ap-south-1:${ACCOUNT}:${aliasTemplate.replaceAll('${Environment}', 's1')}`])
  })

  it('authorizes alias changes on both the alias and the generated key, and only for the one S-1 alias', () => {
    // KMS needs kms:CreateAlias / UpdateAlias on the alias AND on the key it points at (AWS IAM simulation of this policy without the
    // key-side statement: alias allowed, key implicitDeny, overall implicitDeny). The key id is generated, so any key id stands in.
    const aliasArn = (env: string) => `arn:aws:kms:ap-south-1:${ACCOUNT}:alias/knest-${env}-documents`
    const keyArn = `arn:aws:kms:ap-south-1:${ACCOUNT}:key/1234abcd-12ab-34cd-56ef-1234567890ab`
    const authorized = (list: Record<string, any>[], action: string, aliasResource: string) => // eslint-disable-line @typescript-eslint/no-explicit-any
      [aliasResource, keyArn].every((arn) =>
        list.some((s) => s.Effect === 'Allow' && matches(actionsOf(s), action) && resourcesOf(s).some((r) => globMatch(r, arn))))

    for (const action of ['kms:CreateAlias', 'kms:UpdateAlias', 'kms:DeleteAlias']) {
      expect(authorized(statements, action, aliasArn('s1')), `${action} on the S-1 alias and its key`).toBe(true)
      expect(authorized(statements, action, aliasArn('production')), `${action} must not reach the production alias`).toBe(false)
      // The check has teeth: without the statements that name a key, the same request is denied on the key side only.
      const withoutKeySide = statements.filter((s) => !resourcesOf(s).some((r) => r.includes(':key/')))
      expect(authorized(withoutKeySide, action, aliasArn('s1')), `${action} fails when no statement allows it on a key`).toBe(false)
    }

    // The key-side allow is not a way to the production key: it carries the alias fence of the deny above and is not widened to other actions.
    const keyAliasAllow = statements.find((s) => s.Sid === 'AliasTheS1DocumentsKey') as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(actionsOf(keyAliasAllow).sort()).toEqual(['kms:CreateAlias', 'kms:DeleteAlias', 'kms:UpdateAlias'])
    expect(resourcesOf(keyAliasAllow)).toEqual([`arn:aws:kms:ap-south-1:${ACCOUNT}:key/*`])
    // Which alias may be attached is decided on the alias resource alone: exactly one alias is allowed, in any statement.
    const aliasResources = statements.filter((s) => s.Effect === 'Allow').flatMap(resourcesOf).filter((r) => r.includes(':alias/'))
    expect(aliasResources).toEqual([aliasArn('s1')])
    // kms:RequestAlias cannot be used here: AWS KMS documents it for cryptographic operations, DescribeKey and GetPublicKey only, and says
    // it cannot control CreateAlias/UpdateAlias/DeleteAlias, so a condition on it never matches and silently denies the call.
    expect(JSON.stringify(policy)).not.toContain('kms:RequestAlias')
  })

  it('hands the scan role to GuardDuty only, passes no other role, and cannot read or write documents, queue messages, or key material', () => {
    const passes = statements.filter((s) => matches(actionsOf(s), 'iam:PassRole'))
    expect(passes.length).toBe(1)
    expect(passes[0]?.Resource).toBe(`arn:aws:iam::${ACCOUNT}:role/knest-s1-guardduty-malware`)
    expect(passes[0]?.Condition).toEqual({ StringEquals: { 'iam:PassedToService': 'malware-protection-plan.guardduty.amazonaws.com' } })
    // IAM actions reach two roles and no other principal: no users, keys, providers, attachments of managed policies, or trust of anything new.
    const iamStatements = statements.filter((s) => actionsOf(s).some((a) => a.startsWith('iam:')))
    expect(new Set(iamStatements.flatMap(resourcesOf))).toEqual(new Set([`arn:aws:iam::${ACCOUNT}:role/knest-s1-guardduty-malware`, `arn:aws:iam::${ACCOUNT}:role/knest-s1-ec2`]))
    for (const action of ['iam:CreateUser', 'iam:CreateAccessKey', 'iam:AttachRolePolicy', 'iam:CreatePolicy', 'iam:CreateOpenIDConnectProvider', 'iam:PutUserPolicy', 'sts:AssumeRole']) {
      expect(matches(allowActions, action), `${action} must not be granted`).toBe(false)
    }
    // Same guarantee as the operator policy: infrastructure rights, no data rights.
    for (const action of ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:DeleteObject', 's3:DeleteObjectVersion', 's3:PutObjectTagging', 's3:PutObjectVersionTagging',
      'kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:CreateGrant', 'kms:CancelKeyDeletion', 'sqs:ReceiveMessage', 'sqs:SendMessage', 'sqs:DeleteMessage', 'sqs:PurgeQueue']) {
      expect(matches(allowActions, action), `${action} must not be granted`).toBe(false)
    }
    expect(JSON.stringify(policy)).not.toMatch(/"[a-z0-9]+:\*"/i)
    expect(allowActions.some((a) => a.includes('*')), 'no wildcard actions').toBe(false)
  })
})
