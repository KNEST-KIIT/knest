#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DOMAINS = ['kiitnest.com', 'kiitnest.in']
const clean = (value) => value.toLowerCase().replace(/\.$/, '')
const comparator = fileURLToPath(new URL('../dns-compare.mjs', import.meta.url))

/**
 * Read-only metadata and DNS checks. The injected runners allow offline regression tests.
 * @param {{profile: string | undefined, aws?: (file: string, args: string[], options: import('node:child_process').ExecFileSyncOptionsWithStringEncoding) => string, compare?: (args: string[]) => boolean}} options
 */
export function verifyDnsCutover({ profile, aws = execFileSync, compare = (args) => {
  const result = spawnSync(process.execPath, [comparator, ...args], { stdio: 'inherit', timeout: 180_000 })
  return result.status === 0
} }) {
  if (!profile || profile === 'claude-deploy' || !/^[A-Za-z0-9_+=,.@-]+$/.test(profile)) throw new Error('An explicit scoped profile is required; the documented root profile is prohibited.')
  const read = (service, action, region, ...args) => JSON.parse(aws('aws', [service, action, ...args, '--region', region, '--profile', profile, '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }))
  const identity = read('sts', 'get-caller-identity', 'ap-south-1')
  if (!/^arn:aws:sts::166917387892:assumed-role\//.test(identity.Arn ?? '')) throw new Error('Expected an assumed role in the KNEST account.')
  const outputs = (stack, region) => {
    const rows = read('cloudformation', 'describe-stacks', region, '--stack-name', stack, '--query', 'Stacks[0].Outputs')
    if (!Array.isArray(rows)) throw new Error('Missing stack outputs.')
    return Object.fromEntries(rows.map((r) => [r.OutputKey, r.OutputValue]))
  }
  const origin = outputs('knest-production-origin', 'ap-south-1')
  const publicTls = outputs('knest-production-cert', 'us-east-1')
  if (typeof origin.LoadBalancerDnsName !== 'string' || !/^[a-z0-9-]+\.ap-south-1\.elb\.amazonaws\.com\.?$/.test(origin.LoadBalancerDnsName)) throw new Error('Missing Mumbai origin target.')
  const expected = { 'kiitnest.com': { 'origin.kiitnest.com|CNAME': [clean(origin.LoadBalancerDnsName)] }, 'kiitnest.in': {} }
  const addCertificate = (arn, region, hosts) => {
    if (typeof arn !== 'string' || !arn.startsWith(`arn:aws:acm:${region}:166917387892:certificate/`)) throw new Error('Missing certificate reference.')
    const cert = read('acm', 'describe-certificate', region, '--certificate-arn', arn).Certificate
    if (cert?.Status !== 'ISSUED') throw new Error('Certificate is not issued.')
    for (const host of hosts) {
      const record = cert.DomainValidationOptions?.find((v) => v.DomainName === host)?.ResourceRecord
      if (record?.Type !== 'CNAME' || typeof record.Name !== 'string' || typeof record.Value !== 'string') throw new Error('Missing certificate validation record.')
      const domain = DOMAINS.find((d) => clean(record.Name).endsWith('.' + d))
      if (!domain || !/\.acm-validations\.aws\.?$/.test(record.Value)) throw new Error('Unexpected certificate validation record.')
      expected[domain][clean(record.Name) + '|CNAME'] = [clean(record.Value)]
    }
  }
  addCertificate(origin.CertificateArn, 'ap-south-1', ['origin.kiitnest.com'])
  addCertificate(publicTls.CertificateArn, 'us-east-1', ['kiitnest.com', 'www.kiitnest.com', 'kiitnest.in', 'www.kiitnest.in'])
  const dkim = read('sesv2', 'get-email-identity', 'ap-south-1', '--email-identity', 'kiitnest.com').DkimAttributes
  if (dkim?.SigningEnabled !== true || !Array.isArray(dkim.Tokens) || dkim.Tokens.length !== 3 || new Set(dkim.Tokens).size !== 3 || dkim.Tokens.some((t) => typeof t !== 'string' || !/^[a-z0-9]{20,40}$/.test(t))) throw new Error('Missing SES signing records.')
  for (const token of dkim.Tokens) expected['kiitnest.com'][`${token}._domainkey.kiitnest.com|CNAME`] = [`${token}.dkim.amazonses.com`]

  const results = []
  for (const domain of DOMAINS) {
    const zones = read('route53', 'list-hosted-zones-by-name', 'us-east-1', '--dns-name', domain).HostedZones
    const exact = zones?.filter((z) => z.Name === domain + '.' && z.Config?.PrivateZone !== true)
    if (exact?.length !== 1) throw new Error('Expected one exact public hosted zone per domain.')
    const nameservers = read('route53', 'get-hosted-zone', 'us-east-1', '--id', exact[0].Id, '--query', 'DelegationSet.NameServers')
    if (!Array.isArray(nameservers) || nameservers.length !== 4 || new Set(nameservers).size !== 4 || nameservers.some((n) => typeof n !== 'string')) throw new Error('Expected four distinct authoritative nameservers.')
    const required = [`_domainconnect.${domain}|CNAME`, `_dmarc.${domain}|TXT`, ...Object.keys(expected[domain])]
    if (domain === 'kiitnest.com') required.push(`${domain}|MX`, `${domain}|TXT`, `google._domainkey.${domain}|TXT`, `dc-bdaca08905._spfm.${domain}|TXT`)
    const ignore = [`${domain}|A`, `${domain}|AAAA`, `www.${domain}|A`, `www.${domain}|AAAA`, `www.${domain}|CNAME`, 'NS']
    for (const nameserver of nameservers) {
      const passed = compare([domain, domain === 'kiitnest.com' ? 'ns43.domaincontrol.com' : 'ns23.domaincontrol.com', nameserver, '--ignore', ignore.join(','), '--require', required.join(','), '--expected', JSON.stringify(expected[domain])])
      results.push({ domain, nameserver, passed })
    }
  }
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = verifyDnsCutover({ profile: process.env.AWS_PROFILE })
    console.log(JSON.stringify({ checks: results, passed: results.every((r) => r.passed) }, null, 2))
    process.exitCode = results.every((r) => r.passed) ? 0 : 1
  } catch {
    console.error('DNS cutover verification failed: check scoped role, issued certificates, SES signing metadata and exact public zones. No changes were made.')
    process.exitCode = 2
  }
}
