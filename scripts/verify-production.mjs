#!/usr/bin/env node
// Verifies a deployed KNEST (the CloudFront address during private verification, or
// the real domain later) against the design. Exit code 1 if any check fails.
//
//   node scripts/verify-production.mjs --url https://d1234.cloudfront.net --gate --waf \
//        --origin http://ec2-1-2-3-4.ap-south-1.compute.amazonaws.com:3000 \
//        --alt www.kiitnest.com,kiitnest.in,www.kiitnest.in --evidence out.md
//
//   --gate        expect the private-first access gate (401 without credentials)
//   --waf         expect the WAF to block a script-injection probe
//   --origin URL  the origin's own address: a direct request must be refused
//   --alt a,b     alternate hostnames that must redirect to the canonical site (needs --connect-to
//                 until DNS points at the distribution)
//   --connect-to  IP address to connect to while keeping the URL's host name (SNI and Host)
//   --evidence F  also write the results as a markdown table to F
//
// Credentials for the gate come from the environment, never the command line:
//   KNEST_VERIFY_BASIC="user:password"
// Nothing is written to the application: only GET requests and one refused cross-origin POST.
import { writeFileSync } from 'node:fs'
import { runChecks, summarise } from './lib/verify-core.mjs'

const args = process.argv.slice(2)
const value = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const has = (name) => args.includes(name)

const baseUrl = value('--url')
if (!baseUrl) {
  console.error('usage: node scripts/verify-production.mjs --url <https://host> [--gate] [--waf] [--origin URL] [--alt a,b] [--connect-to IP] [--evidence file]')
  process.exit(2)
}

const results = await runChecks({
  baseUrl,
  basic: process.env.KNEST_VERIFY_BASIC || undefined,
  expectGate: has('--gate'),
  expectWaf: has('--waf'),
  originUrl: value('--origin'),
  altHosts: (value('--alt') ?? '').split(',').filter(Boolean),
  connectTo: value('--connect-to'),
})

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + '  [' + r.detail + ']')
const { passed, failed } = summarise(results)
console.log('\n' + passed + ' passed, ' + failed + ' failed')

const evidence = value('--evidence')
if (evidence) {
  const lines = [
    '# Verification run',
    '',
    'Target: `' + baseUrl + '`  Date: ' + new Date().toISOString(),
    'Options: gate=' + has('--gate') + ', waf=' + has('--waf') + ', origin=' + (value('--origin') ? 'yes' : 'no') + ', alt hosts=' + (value('--alt') ?? 'none'),
    '',
    '| Result | Check | Detail |',
    '|---|---|---|',
    ...results.map((r) => '| ' + (r.ok ? 'PASS' : '**FAIL**') + ' | ' + r.name + ' | ' + String(r.detail).replace(/\|/g, '/') + ' |'),
    '',
    passed + ' passed, ' + failed + ' failed.',
    '',
  ]
  writeFileSync(evidence, lines.join('\n'))
  console.log('Evidence written to ' + evidence)
}
process.exit(failed ? 1 : 0)
