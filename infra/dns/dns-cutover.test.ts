import { describe, expect, it } from 'vitest'
import { verifyDnsCutover } from '../../scripts/ops/dns-cutover-check.mjs'

const account = '166917387892'
const originArn = `arn:aws:acm:ap-south-1:${account}:certificate/origin`
const publicArn = `arn:aws:acm:us-east-1:${account}:certificate/public`
const validation = (host: string, index: number) => ({ DomainName: host, ResourceRecord: { Type: 'CNAME', Name: `_${String(index).padStart(32, '0')}.${host}.`, Value: `_${'a'.repeat(32)}.validation.acm-validations.aws.` } })
const tokens = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)]

function fixture(overrides: { identity?: string; status?: string; zone?: string; privateZone?: boolean; nsCount?: number; missingOriginValidation?: boolean } = {}) {
  const calls: string[][] = []
  const aws = (_file: string, args: string[]) => {
    calls.push(args)
    const value = (key: string) => args[args.indexOf(key) + 1]
    if (args[0] === 'sts') return JSON.stringify({ Arn: overrides.identity ?? `arn:aws:sts::${account}:assumed-role/knest-production-operator/test` })
    if (args[0] === 'cloudformation') return JSON.stringify(value('--stack-name') === 'knest-production-origin'
      ? [{ OutputKey: 'CertificateArn', OutputValue: originArn }, { OutputKey: 'LoadBalancerDnsName', OutputValue: 'knest-alb.ap-south-1.elb.amazonaws.com' }]
      : [{ OutputKey: 'CertificateArn', OutputValue: publicArn }])
    if (args[0] === 'acm') return JSON.stringify({ Certificate: { Status: overrides.status ?? 'ISSUED', DomainValidationOptions: value('--certificate-arn') === originArn
      ? (overrides.missingOriginValidation ? [] : [validation('origin.kiitnest.com', 1)])
      : ['kiitnest.com', 'www.kiitnest.com', 'kiitnest.in', 'www.kiitnest.in'].map((host, i) => validation(host, i + 2)) } })
    if (args[0] === 'sesv2') return JSON.stringify({ DkimAttributes: { SigningEnabled: true, Tokens: tokens } })
    if (args[1] === 'list-hosted-zones-by-name') return JSON.stringify({ HostedZones: [{ Id: value('--dns-name'), Name: overrides.zone ?? value('--dns-name') + '.', Config: { PrivateZone: overrides.privateZone ?? false } }] })
    if (args[1] === 'get-hosted-zone') return JSON.stringify(Array.from({ length: overrides.nsCount ?? 4 }, (_, i) => `ns-${i}.awsdns.example`))
    throw new Error('Unexpected AWS command')
  }
  return { aws, calls }
}

describe('DNS cutover verification', () => {
  it('checks all eight servers and requires the live origin, ACM, SES and mail records', () => {
    const f = fixture()
    const comparisons: string[][] = []
    const result = verifyDnsCutover({ profile: 'test', aws: f.aws, compare: (args) => { comparisons.push(args); return !(args[0] === 'kiitnest.in' && args[2] === 'ns-3.awsdns.example') } })
    expect(result).toHaveLength(8)
    expect(result.filter((r) => !r.passed)).toEqual([{ domain: 'kiitnest.in', nameserver: 'ns-3.awsdns.example', passed: false }])
    const option = (args: string[], key: string) => args[args.indexOf(key) + 1]!
    for (const args of comparisons) {
      expect(option(args, '--require')).toContain(`_dmarc.${args[0]}|TXT`)
      expect(option(args, '--ignore')).toContain(`${args[0]}|AAAA`)
      expect(args[1]).toBe(args[0] === 'kiitnest.com' ? 'ns43.domaincontrol.com' : 'ns23.domaincontrol.com')
    }
    const expected = JSON.parse(option(comparisons[0]!, '--expected'))
    expect(expected['origin.kiitnest.com|CNAME']).toEqual(['knest-alb.ap-south-1.elb.amazonaws.com'])
    expect(Object.keys(expected)).toHaveLength(7) // origin, regional ACM, two public ACM, three SES
    for (const token of tokens) expect(expected[`${token}._domainkey.kiitnest.com|CNAME`]).toEqual([`${token}.dkim.amazonses.com`])
    expect(Object.keys(JSON.parse(option(comparisons[4]!, '--expected')))).toHaveLength(2)
    expect(f.calls.every((args) => args.includes('--profile') && args.includes('test'))).toBe(true)
    expect(new Set(f.calls.map((args) => args.slice(0, 2).join(' ')))).toEqual(new Set(['sts get-caller-identity', 'cloudformation describe-stacks', 'acm describe-certificate', 'sesv2 get-email-identity', 'route53 list-hosted-zones-by-name', 'route53 get-hosted-zone']))
  })

  it('refuses the root profile before making any AWS call', () => {
    const f = fixture()
    expect(() => verifyDnsCutover({ profile: 'claude-deploy', aws: f.aws })).toThrow(/root profile/)
    expect(f.calls).toEqual([])
  })

  it.each([`arn:aws:iam::${account}:root`, 'arn:aws:sts::000000000000:assumed-role/operator/test'])("refuses an inappropriate identity: %s", (identity) => {
    const f = fixture({ identity })
    expect(() => verifyDnsCutover({ profile: 'test', aws: f.aws })).toThrow(/assumed role/)
    expect(f.calls).toHaveLength(1)
  })

  it.each([{ status: 'PENDING_VALIDATION' }, { missingOriginValidation: true }, { zone: 'kiitnest.com.other.' }, { privateZone: true }, { nsCount: 3 }])('fails closed on incomplete metadata: %j', (overrides) => {
    const f = fixture(overrides)
    const comparisons: string[][] = []
    expect(() => verifyDnsCutover({ profile: 'test', aws: f.aws, compare: (args) => { comparisons.push(args); return true } })).toThrow()
    expect(comparisons).toHaveLength(0)
  })
})
