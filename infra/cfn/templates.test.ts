import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { render } from '../../scripts/render-cfn.mjs'

/**
 * The CloudFormation templates cannot be deployed or validated by CloudFormation from
 * here (no AWS access yet), so these tests check what can be checked: that each template
 * parses, that every reference points at something that exists, and that the security
 * properties the design depends on are present in the text. A passing run is not proof
 * that CloudFormation will accept a template; the first real deployment (S-1) is.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

// CloudFormation's short-form functions (!Ref, !Sub, ...) become ordinary objects.
const FUNCTIONS = ['Ref', 'GetAtt', 'Sub', 'If', 'Equals', 'Not', 'And', 'Or', 'Join', 'Select', 'Cidr', 'Split', 'Base64', 'FindInMap', 'ImportValue', 'GetAZs', 'Condition']
const customTags = FUNCTIONS.flatMap((fn) => [
  { tag: '!' + fn, resolve: (str: string) => ({ [fn]: str }) },
  { tag: '!' + fn, collection: 'seq' as const, resolve: (seq: { toJSON: () => unknown }) => ({ [fn]: seq.toJSON() }) },
])

type Template = {
  Parameters?: Record<string, { Type: string; Default?: unknown }>
  Conditions?: Record<string, unknown>
  Resources: Record<string, { Type: string; Condition?: string; DeletionPolicy?: string; Properties?: Record<string, unknown> }>
  Outputs?: Record<string, unknown>
}
const load = (name: string, variant?: 's1' | 'production'): Template => {
  const text = read(`./${name}.yaml`)
  return parse(variant ? render(text, variant) : text, { customTags }) as Template
}

const PSEUDO = /^AWS::/

/** Every {Ref: X} and {GetAtt: 'X.Attr'} and Sub placeholder must name a parameter, resource or pseudo parameter. */
function danglingReferences(template: Template): string[] {
  const known = new Set([...Object.keys(template.Parameters ?? {}), ...Object.keys(template.Resources)])
  const conditions = new Set(Object.keys(template.Conditions ?? {}))
  const problems: string[] = []
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, path + '[' + i + ']'))
    if (node === null || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'Ref' && typeof value === 'string' && !PSEUDO.test(value) && !known.has(value)) problems.push(path + ': Ref ' + value)
      if (key === 'GetAtt') {
        const target = typeof value === 'string' ? value.split('.')[0]! : Array.isArray(value) ? String(value[0]) : ''
        if (target && !known.has(target)) problems.push(path + ': GetAtt ' + target)
      }
      if (key === 'Sub') {
        const text = typeof value === 'string' ? value : Array.isArray(value) ? String(value[0]) : ''
        for (const m of text.matchAll(/\$\{([^}!][^}]*)\}/g)) {
          const name = m[1]!.split('.')[0]!
          if (!PSEUDO.test(name) && !known.has(name)) problems.push(path + ': Sub ${' + m[1] + '}')
        }
      }
      if (key === 'If' && Array.isArray(value) && typeof value[0] === 'string' && !conditions.has(value[0])) problems.push(path + ': If ' + value[0])
      if (key === 'Condition' && typeof value === 'string' && !conditions.has(value) && path.includes('Resources')) problems.push(path + ': Condition ' + value)
      walk(value, path + '.' + key)
    }
  }
  walk(template.Resources, 'Resources')
  walk(template.Outputs, 'Outputs')
  return problems
}

describe.each(['app', 'edge', 'waf', 'dns', 'ci', 'cert'])('%s.yaml', (name) => {
  const template = load(name)
  it('parses, and has resources that each declare a type', () => {
    expect(Object.keys(template.Resources).length).toBeGreaterThan(0)
    for (const [id, resource] of Object.entries(template.Resources)) expect(resource.Type, id).toMatch(/^AWS::[A-Za-z0-9]+::[A-Za-z0-9]+$/)
  })
  it('has no reference to anything that does not exist', () => {
    expect(danglingReferences(template)).toEqual([])
  })
  it('declares no secret value in the template text', () => {
    // A literal password or key would be quoted text; the words "Password" in property names are not secrets.
    expect(read(`./${name}.yaml`)).not.toMatch(/AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|[^A-Za-z]password:\s*['"][^'"{]{4,}['"]/i)
  })
})

describe('app.yaml: the properties the design depends on', () => {
  const t = load('app')
  const text = read('./app.yaml')

  it('keeps the database private, encrypted, backed up and reachable only from the app host', () => {
    const db = t.Resources.Database!.Properties!
    expect(db.PubliclyAccessible).toBe(false)
    expect(db.StorageEncrypted).toBe(true)
    expect(db.ManageMasterUserPassword).toBe(true)
    expect(db.BackupRetentionPeriod).toBeGreaterThanOrEqual(7)
    const dbSg = JSON.stringify(t.Resources.DatabaseSecurityGroup!.Properties)
    expect(dbSg).toContain('SourceSecurityGroupId')
    expect(dbSg).not.toContain('CidrIp":"0.0.0.0/0","Description":"PostgreSQL')
    expect(JSON.stringify(t.Resources.DatabaseSecurityGroup!.Properties!.SecurityGroupIngress)).not.toMatch(/CidrIp/)
    // the database subnet group uses only the two private subnets
    expect(JSON.stringify(t.Resources.DbSubnetGroup!.Properties)).not.toContain('PublicSubnet')
  })

  it('admits traffic to the app host only from CloudFront, with no SSH and no open port', () => {
    const ingress = JSON.stringify(t.Resources.AppSecurityGroup!.Properties!.SecurityGroupIngress)
    expect(ingress).toContain('SourcePrefixListId')
    expect(ingress).not.toMatch(/CidrIp|"FromPort":22\b/)
  })

  it('requires IMDSv2, encrypts the volume, and gives the host a role, not keys', () => {
    const instance = t.Resources.AppInstance!.Properties!
    expect(JSON.stringify(instance.MetadataOptions)).toContain('"HttpTokens":"required"')
    expect(JSON.stringify(instance.BlockDeviceMappings)).toContain('"Encrypted":true')
    expect(instance.IamInstanceProfile).toBeDefined()
    expect(text).not.toMatch(/AccessKeyId|SecretAccessKey/)
  })

  it('blocks all public access to the bucket and refuses non-TLS requests', () => {
    const bucket = JSON.stringify(t.Resources.Bucket!.Properties)
    for (const k of ['BlockPublicAcls', 'BlockPublicPolicy', 'IgnorePublicAcls', 'RestrictPublicBuckets']) expect(bucket).toContain(`"${k}":true`)
    expect(JSON.stringify(t.Resources.BucketPolicy!.Properties)).toContain('aws:SecureTransport')
  })

  it('lets the host read only its own secrets and send mail only from the configured address', () => {
    // The inline policies only (the managed SSM policy's ARN legitimately contains "iam").
    const policy = JSON.stringify(t.Resources.InstanceRole!.Properties!.Policies)
    expect(policy).toContain('ses:FromAddress')
    expect(policy).not.toMatch(/"Resource":"\*"[^}]*"Action":\["?secretsmanager/)
    expect(policy).not.toContain('"iam:')
    expect(policy).not.toContain('"Action":"*"')
    expect(policy).not.toContain('"s3:*"')
  })

  it('refuses a deploy by tag: only an immutable digest is accepted', () => {
    expect(text).toContain('@sha256:[a-f0-9]{64}$')
  })

  it('S-1 variant deletes everything; production variant keeps the data', () => {
    const s1 = load('app', 's1')
    const prod = load('app', 'production')
    expect(s1.Resources.Database!.DeletionPolicy).toBe('Delete')
    expect(s1.Resources.Bucket!.DeletionPolicy).toBe('Delete')
    expect(prod.Resources.Database!.DeletionPolicy).toBe('Snapshot')
    expect(prod.Resources.Bucket!.DeletionPolicy).toBe('Retain')
    // and nothing else differs between the two
    const strip = (s: string) => s.replace(/(DeletionPolicy|UpdateReplacePolicy): \w+/g, '$1: X')
    expect(strip(render(read('./app.yaml'), 's1'))).toBe(strip(read('./app.yaml')))
  })
})

describe('edge.yaml: never cache what is private; keep the origin closed', () => {
  const t = load('edge')
  const dist = JSON.stringify(t.Resources.Distribution!.Properties)

  it('serves dynamic content with the managed CachingDisabled policy', () => {
    const config = (t.Resources.Distribution!.Properties as { DistributionConfig: { DefaultCacheBehavior: Record<string, unknown> } }).DistributionConfig
    expect(config.DefaultCacheBehavior.CachePolicyId).toBe('4135ea2d-6df8-44a3-9df3-4b5a84be39ad')
  })

  it('caches only the fingerprinted build assets, with no cookies or headers in the key', () => {
    const behaviours = (t.Resources.Distribution!.Properties as { DistributionConfig: { CacheBehaviors: { PathPattern: string }[] } }).DistributionConfig.CacheBehaviors
    expect(behaviours.map((b) => b.PathPattern)).toEqual(['/_next/static/*'])
    const key = JSON.stringify(t.Resources.StaticAssetsCachePolicy!.Properties)
    expect(key).toContain('"CookieBehavior":"none"')
    expect(key).toContain('"HeaderBehavior":"none"')
    expect(key).toContain('"QueryStringBehavior":"none"')
  })

  it('redirects to https, sends the origin-verification header from a secret, and sits behind a web ACL', () => {
    expect(dist).toContain('redirect-to-https')
    expect(dist).toContain('X-Origin-Verify')
    expect(dist).toContain('resolve:secretsmanager')
    expect(dist).toContain('WebACLId')
  })

  it('the inline function is the tested function, byte for byte, apart from the access hash', () => {
    const inline = (t.Resources.ViewerRequestFunction!.Properties as { FunctionCode: { Sub: string } }).FunctionCode.Sub
    const file = read('../edge/viewer-request.js')
    const norm = (s: string) => s.replace(/\r\n/g, '\n').replace(/\s+$/g, '').replace(/'\$\{AccessHash\}'|'__ACCESS_HASH__'/, "'HASH'")
    expect(norm(inline)).toBe(norm(file))
  })
})

describe('waf.yaml: three managed groups, two rate rules, nothing paid beyond that', () => {
  const t = load('waf')
  const acl = JSON.stringify(t.Resources.WebAcl!.Properties)
  it('has exactly the five costed rules and no CAPTCHA, Bot Control or fraud-control group', () => {
    const rules = (t.Resources.WebAcl!.Properties as { Rules: unknown[] }).Rules
    expect(rules).toHaveLength(5)
    expect(acl).not.toMatch(/BotControl|CAPTCHA|Challenge|ATP|ACFP/)
    expect(acl).toContain('CLOUDFRONT')
  })
  it('lets large multipart uploads through the body-size rule (the app limits and inspects them itself)', () => {
    expect(acl).toContain('SizeRestrictions_BODY')
  })
})

describe('ci.yaml: short-lived credentials, tied to this repository and an environment', () => {
  const t = load('ci')
  it('trusts only the GitHub OIDC provider, for one repository and one GitHub Environment', () => {
    for (const id of ['PushRole', 'DeployRole']) {
      const trust = JSON.stringify(t.Resources[id]!.Properties!.AssumeRolePolicyDocument)
      expect(trust).toContain('sts:AssumeRoleWithWebIdentity')
      expect(trust).toContain('token.actions.githubusercontent.com:sub')
      expect(trust).toContain('environment:')
      expect(trust).toContain('sts.amazonaws.com')
      expect(trust).not.toContain('"*"')
    }
  })
  it('keeps tags immutable and scans on push', () => {
    const repo = JSON.stringify(t.Resources.Repository!.Properties)
    expect(repo).toContain('"ImageTagMutability":"IMMUTABLE"')
    expect(repo).toContain('"ScanOnPush":true')
  })
  it('lets the push role push to one repository and the deploy role run one document', () => {
    expect(JSON.stringify(t.Resources.PushRole!.Properties)).not.toMatch(/ssm:|iam:|s3:|ec2:/)
    expect(JSON.stringify(t.Resources.DeployRole!.Properties)).not.toMatch(/ecr:Put|ecr:Upload|iam:|s3:|ec2:Run/)
  })
})

describe('dns.yaml: reproduces the inventoried records exactly', () => {
  const t = load('dns')
  const snapshot = read('../../docs/delivery/EVIDENCE/dns-snapshot-kiitnest.com-2026-10-09.md')

  const records = (id: string) => (t.Resources[id]!.Properties as { ResourceRecords: string[]; Name: string; Type: string; TTL: string })

  it('keeps the Google mail records unchanged', () => {
    expect(records('MailExchange').ResourceRecords).toEqual(['1 smtp.google.com.'])
    expect(records('ApexText').ResourceRecords).toEqual([
      '"google-site-verification=NOi-FDQrbPNRT_bpSyd4YYUg1tP0vjeu1m7jFJdqfQE"',
      '"v=spf1 include:dc-bdaca08905._spfm.kiitnest.com ~all"',
    ])
    expect(records('SpfInclude').ResourceRecords).toEqual(['"v=spf1 include:_spf.google.com ~all"'])
    expect(records('Dmarc').ResourceRecords).toEqual(['"v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;"'])
  })

  it('the DKIM key, joined from its two DNS strings, equals the key in the saved snapshot', () => {
    const joined = records('GoogleDkim').ResourceRecords[0]!.split('" "').join('').replace(/^"|"$/g, '')
    const fromSnapshot = /```\n(v=DKIM1[^\n]*)\n```/.exec(snapshot)![1]
    expect(joined).toBe(fromSnapshot)
    for (const part of records('GoogleDkim').ResourceRecords[0]!.split('" "')) expect(part.replace(/"/g, '').length).toBeLessThanOrEqual(255)
  })

  it('does not point either domain at CloudFront until the cutover parameter is supplied', () => {
    const web = ['ComApexA', 'ComApexAaaa', 'ComWwwA', 'ComWwwAaaa', 'InApexA', 'InApexAaaa', 'InWwwA', 'InWwwAaaa']
    for (const id of web) expect(t.Resources[id]!.Condition, id).toBe('HasCloudFront')
    expect(t.Parameters!.CloudFrontDomainName!.Default).toBe('')
  })

  it('creates no record that would replace or shadow a mail record', () => {
    for (const id of ['ComApexA', 'ComApexAaaa', 'InApexA']) expect(['A', 'AAAA']).toContain((t.Resources[id]!.Properties as { Type: string }).Type)
  })
})
