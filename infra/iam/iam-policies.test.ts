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

describe('S-1 service role: the one secret the edge stack reads, and no other', () => {
  const ACCOUNT = '166917387892'
  const policy = load('cfn-service-role-s1-screening.json')
  const statements = policy.Statement as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  const resourcesOf = (statement: Record<string, any>): string[] => [statement.Resource].flat() // eslint-disable-line @typescript-eslint/no-explicit-any
  const globMatch = (pattern: string, value: string): boolean =>
    new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(value)
  const secretStatements = statements.filter((s) => actionsOf(s).some((a) => a.startsWith('secretsmanager:')))
  const secretPattern = resourcesOf(secretStatements[0] as Record<string, any>)[0] as string // eslint-disable-line @typescript-eslint/no-explicit-any
  /** A Secrets Manager ARN carries a six-character random suffix after the name. */
  const arnOf = (name: string) => `arn:aws:secretsmanager:ap-south-1:${ACCOUNT}:secret:${name}-AbC123`
  const readable = (name: string) =>
    secretStatements.some((s) => s.Effect === 'Allow' && matches(actionsOf(s), 'secretsmanager:GetSecretValue') && resourcesOf(s).some((r) => globMatch(r, arnOf(name))))

  it('allows GetSecretValue on exactly the S-1 origin-verify secret, unconditionally and nowhere else', () => {
    expect(secretStatements.length).toBe(1)
    const statement = secretStatements[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(statement.Sid).toBe('ReadTheS1OriginVerifySecretForTheEdgeStack')
    expect(statement.Effect).toBe('Allow')
    expect(actionsOf(statement)).toEqual(['secretsmanager:GetSecretValue'])
    expect(resourcesOf(statement)).toEqual([`arn:aws:secretsmanager:ap-south-1:${ACCOUNT}:secret:knest-s1/origin-verify-*`])
    expect(statement.Condition).toBeUndefined()
  })

  it('matches the secret app.yaml creates for S-1 and the one edge.yaml resolves, and no other secret of the environment', () => {
    const app = readFileSync(new URL('../cfn/app.yaml', import.meta.url), 'utf8')
    const edge = readFileSync(new URL('../cfn/edge.yaml', import.meta.url), 'utf8')
    const created = /OriginVerifySecret:[\s\S]*?Name: !Sub '([^']+)'/.exec(app)?.[1]?.replaceAll('${Environment}', 's1')
    expect(created).toBe('knest-s1/origin-verify')
    expect(edge).toContain('{{resolve:secretsmanager:${OriginVerifySecretId}:SecretString}}')
    expect(readable(created as string)).toBe(true)
    // The other secrets of the S-1 stack stay unreadable by the service role, as does the database-managed one.
    for (const other of ['knest-s1/auth-secret', 'knest-s1/payload-secret', 'knest-s1/db-runtime', 'knest-s1/turnstile-secret', 'rds!db-1234abcd']) expect(readable(other), other).toBe(false)
  })

  it('gives no access to any production secret, by name, region, account or wildcard', () => {
    for (const name of ['knest-production/origin-verify', 'knest-production/auth-secret', 'knest-production/payload-secret', 'knest-production/db-runtime', 'knest-production/turnstile-secret', 'knest-origin-verify']) {
      expect(readable(name), name).toBe(false)
    }
    expect(globMatch(secretPattern, `arn:aws:secretsmanager:us-east-1:${ACCOUNT}:secret:knest-s1/origin-verify-AbC123`)).toBe(false)
    expect(globMatch(secretPattern, 'arn:aws:secretsmanager:ap-south-1:111111111111:secret:knest-s1/origin-verify-AbC123')).toBe(false)
    expect(JSON.stringify(policy)).not.toMatch(/secretsmanager:\*|secretsmanager:Get\*/)
    expect(JSON.stringify(policy)).not.toMatch(/production/i)
  })
})

describe('S-1 operator policy: AMI parameter and tagged GuardDuty plan reads, within the size limit, with every deny kept', () => {
  const ACCOUNT = '166917387892'
  const policy = JSON.parse(readFileSync(new URL('../s1/operator-policy.json', import.meta.url), 'utf8')) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const statements = policy.Statement as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  const resourcesOf = (statement: Record<string, any>): string[] => [statement.Resource].flat() // eslint-disable-line @typescript-eslint/no-explicit-any
  const byId = (sid: string) => statements.find((s) => s.Sid === sid) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const app = readFileSync(new URL('../cfn/app.yaml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const allowedActions = statements.filter((s) => s.Effect === 'Allow').flatMap(actionsOf)

  it('stays a managed policy IAM accepts: unique Sids, only Version and Statement, under 6,144 characters without whitespace', () => {
    expect(Object.keys(policy).sort()).toEqual(['Statement', 'Version'])
    const sids = statements.map((s) => s.Sid as string)
    expect(new Set(sids).size).toBe(sids.length)
    expect(JSON.stringify(policy).replace(/\s/g, '').length).toBeLessThan(6144)
  })

  it('resolves the public Amazon Linux parameter the app template defaults to, and only that parameter', () => {
    const statement = byId('ResolveThePublicAmiParameter')
    expect(statement.Effect).toBe('Allow')
    expect(actionsOf(statement).sort()).toEqual(['ssm:GetParameter', 'ssm:GetParameters'])
    const name = /LatestAmiId:\n    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>\n    Default: (\S+)/.exec(app)?.[1]
    expect(name).toBe('/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64')
    // Public parameters belong to AWS, so the ARN has no account id.
    expect(resourcesOf(statement)).toEqual([`arn:aws:ssm:ap-south-1::parameter${name}`])
    expect(statement.Condition).toBeUndefined()
    // No other grant reads parameters: the operator still cannot read the S-1 stack's own configuration.
    expect(allowedActions.filter((a) => /^ssm:Get/i.test(a))).toEqual(['ssm:GetParameter', 'ssm:GetParameters'])
  })

  it('reads a malware protection plan only when it is tagged as the S-1 plan the template creates', () => {
    const tag = /MalwareProtectionPlan:[\s\S]*?Tags: \[\{ Key: Name, Value: !Sub '([^']+)' \}\]/.exec(app)?.[1]?.replaceAll('${Environment}', 's1')
    expect(tag).toBe('knest-s1-quarantine')
    const statement = byId('ReadOnlyAPlanTaggedAsS1')
    expect(statement.Effect).toBe('Allow')
    expect(actionsOf(statement).sort()).toEqual(['guardduty:GetMalwareProtectionPlan', 'guardduty:ListTagsForResource'])
    expect(resourcesOf(statement)).toEqual([`arn:aws:guardduty:ap-south-1:${ACCOUNT}:malware-protection-plan/*`])
    expect(statement.Condition).toEqual({ StringEquals: { 'aws:ResourceTag/Name': tag } })
    // Read, not manage: nothing that creates, changes or deletes a plan, and no unscoped GuardDuty grant, anywhere in the policy.
    for (const action of ['guardduty:CreateMalwareProtectionPlan', 'guardduty:UpdateMalwareProtectionPlan', 'guardduty:DeleteMalwareProtectionPlan', 'guardduty:TagResource', 'guardduty:ListDetectors', 'guardduty:GetFindings']) {
      expect(matches(allowedActions, action), `${action} must not be granted`).toBe(false)
    }
    expect(JSON.stringify(policy)).not.toContain('guardduty:*')
  })

  it('keeps every explicit deny: other regions, long-lived credentials, secret values, S-1 parameters, compute outside Mumbai', () => {
    const denies = statements.filter((s) => s.Effect === 'Deny').map((s) => s.Sid as string)
    expect(denies).toEqual(['StayInMumbaiAndVirginia', 'NeverCreateLongLivedCredentialsOrUsers', 'NoComputeOrDatabaseOutsideMumbai', 'TheOperatorNeverReadsSecretValues', 'TheOperatorNeverReadsS1Parameters'])
    expect(byId('TheOperatorNeverReadsSecretValues')).toMatchObject({ Action: 'secretsmanager:GetSecretValue', Resource: '*' })
    expect(byId('TheOperatorNeverReadsS1Parameters').Resource).toBe('arn:aws:ssm:ap-south-1:*:parameter/knest-s1/*')
    // The allowed AMI parameter is outside the denied S-1 parameter path, so the deny is not weakened and does not hide it.
    expect(resourcesOf(byId('ResolveThePublicAmiParameter'))[0]).not.toContain('/knest-s1/')
    expect(matches(allowedActions, 'secretsmanager:GetSecretValue')).toBe(false)
  })
})

describe('S-1 teardown: four schedules in both regions, exact stacks, scoped trust, pass condition', () => {
  const ACCOUNT = '166917387892'
  const operator = load('../s1/operator-policy.json')
  const roles = load('../s1/teardown-roles.json') as { roles: Record<string, any>[]; teardownBehaviourToKnow: string[] } // eslint-disable-line @typescript-eslint/no-explicit-any
  const scheduler = roles.roles.find((r) => r.name === 'knest-s1-scheduler') as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const resourcesOf = (statement: Record<string, any>): string[] => [statement.Resource].flat() // eslint-disable-line @typescript-eslint/no-explicit-any
  const sid = (policy: Record<string, any>, id: string) => policy.Statement.find((s: Record<string, any>) => s.Sid === id) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it('lets the operator manage knest-s1 schedules and the knest-s1 group in Mumbai and Virginia, and nothing else', () => {
    const statement = sid(operator, 'S1BudgetsAndTeardownSchedule')
    expect(statement.Effect).toBe('Allow')
    expect(resourcesOf(statement).filter((r) => r.startsWith('arn:aws:scheduler:')).sort()).toEqual([
      'arn:aws:scheduler:ap-south-1:*:schedule-group/knest-s1*',
      'arn:aws:scheduler:ap-south-1:*:schedule/*/knest-s1*',
      'arn:aws:scheduler:us-east-1:*:schedule-group/knest-s1*',
      'arn:aws:scheduler:us-east-1:*:schedule/*/knest-s1*',
    ])
    expect(actionsOf(statement).filter((a) => a.startsWith('scheduler:'))).toEqual(['scheduler:*'])
    // Every other scheduler grant is read-only, and the region fence still allows exactly these two regions.
    const others = (operator.Statement as Record<string, any>[]).filter((s) => s.Sid !== 'S1BudgetsAndTeardownSchedule' && s.Effect === 'Allow' && actionsOf(s).some((a) => a.startsWith('scheduler:'))) // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(others.length).toBeGreaterThan(0)
    for (const other of others) expect(actionsOf(other).filter((a) => a.startsWith('scheduler:')).sort()).toEqual(['scheduler:Get*', 'scheduler:List*'])
    expect(sid(operator, 'StayInMumbaiAndVirginia').Condition.StringNotEquals['aws:RequestedRegion']).toEqual(['ap-south-1', 'us-east-1'])
    // Only a knest-s1 role can be passed, and only to the services the teardown uses.
    const passRole = sid(operator, 'PassOnlyS1Roles')
    expect(passRole.Resource).toBe('arn:aws:iam::*:role/knest-s1-*')
    expect(passRole.Condition.StringEquals['iam:PassedToService']).toContain('scheduler.amazonaws.com')
  })

  it('keeps the operator policy within the managed-policy size limit', () => {
    expect(JSON.stringify(operator).replace(/\s/g, '').length).toBeLessThan(6144)
  })

  it('trusts only the scheduler service, in this account, for the knest-s1 schedule group in any region', () => {
    const trustStatements = scheduler.trustPolicy.Statement as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(trustStatements.length).toBe(1)
    const trust = trustStatements[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(trust).toMatchObject({ Effect: 'Allow', Principal: { Service: 'scheduler.amazonaws.com' }, Action: 'sts:AssumeRole' })
    expect(trust.Condition.StringEquals).toEqual({ 'aws:SourceAccount': '<ACCOUNT_ID>' })
    // The region is a wildcard so one role serves both regions; the account and the group are fixed.
    expect(trust.Condition.ArnLike).toEqual({ 'aws:SourceArn': 'arn:aws:scheduler:*:<ACCOUNT_ID>:schedule-group/knest-s1' })
    const source = (trust.Condition.ArnLike['aws:SourceArn'] as string).replace('<ACCOUNT_ID>', ACCOUNT)
    const arn = (region: string, account: string, group: string) => `arn:aws:scheduler:${region}:${account}:schedule-group/${group}`
    const covered = (value: string) => new RegExp(`^${source.replace(/[.+^$()|[\]\\{}]/g, '\\$&').replace(/\*/g, '.*')}$`).test(value)
    expect(covered(arn('ap-south-1', ACCOUNT, 'knest-s1'))).toBe(true)
    expect(covered(arn('us-east-1', ACCOUNT, 'knest-s1'))).toBe(true)
    expect(covered(arn('us-east-1', '111111111111', 'knest-s1'))).toBe(false)
    expect(covered(arn('us-east-1', ACCOUNT, 'default'))).toBe(false)
    expect(covered(arn('us-east-1', ACCOUNT, 'knest-s1-other'))).toBe(false)
  })

  it('lets the scheduler role delete exactly the four S-1 stacks and pass exactly the CloudFormation service role to CloudFormation', () => {
    const statements = scheduler.permissionsPolicy.Statement as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(statements.map((s) => s.Sid)).toEqual(['DeleteOnlyTheS1Stacks', 'HandTheDeleteToTheServiceRoleOnly'])
    const del = sid(scheduler.permissionsPolicy, 'DeleteOnlyTheS1Stacks')
    expect(del.Effect).toBe('Allow')
    expect(del.Action).toBe('cloudformation:DeleteStack')
    expect(del.Condition).toBeUndefined()
    expect(resourcesOf(del).sort()).toEqual([
      'arn:aws:cloudformation:ap-south-1:<ACCOUNT_ID>:stack/knest-s1-ci/*',
      'arn:aws:cloudformation:ap-south-1:<ACCOUNT_ID>:stack/knest-s1-edge/*',
      'arn:aws:cloudformation:ap-south-1:<ACCOUNT_ID>:stack/knest-s1/*',
      'arn:aws:cloudformation:us-east-1:<ACCOUNT_ID>:stack/knest-s1-waf/*',
    ])
    expect(sid(scheduler.permissionsPolicy, 'HandTheDeleteToTheServiceRoleOnly')).toEqual({
      Sid: 'HandTheDeleteToTheServiceRoleOnly',
      Effect: 'Allow',
      Action: 'iam:PassRole',
      Resource: 'arn:aws:iam::<ACCOUNT_ID>:role/knest-s1-cfn-service',
      Condition: { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } },
    })
  })

  it('describes four schedules in the staged 00:00, 02:00 and 04:00 UTC order, not the two-schedule design', () => {
    const prose = roles.teardownBehaviourToKnow.join('\n')
    expect(prose).toContain('four one-time schedules')
    for (const name of ['knest-s1-expire-edge', 'knest-s1-expire-waf', 'knest-s1-expire-app', 'knest-s1-expire-ci']) expect(prose, name).toContain(name)
    expect(prose).toContain('00:00 UTC')
    expect(prose).toContain('02:00 UTC')
    expect(prose).toContain('04:00 UTC')
    expect(prose).not.toMatch(/two schedules|knest-s1-expire deletes/)
  })
})
