#!/usr/bin/env node
// Compares what two nameservers answer for the same domain, record by record.
//
//   node scripts/dns-compare.mjs <domain> <nameserverA> <nameserverB> [--ignore key,key] [--names n1,n2]
//
// Nameservers are host names or IP addresses. Both are queried directly (not through a
// recursive resolver), so a Route 53 zone that is not yet delegated can be checked
// against GoDaddy before any nameserver change. Exit code 1 when anything differs.
//
// Example, before the cutover (the web records are expected to differ, the mail must not):
//   node scripts/dns-compare.mjs kiitnest.com ns43.domaincontrol.com ns-123.awsdns-45.com \
//     --ignore kiitnest.com|A,www.kiitnest.com|CNAME,www.kiitnest.com|A,NS
import dns from 'node:dns/promises'
import { compareResults, defaultNames, normalise, RECORD_TYPES } from './lib/dns-compare-core.mjs'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? '' : (args.splice(i, 2)[1] ?? '')
}
const ignore = flag('--ignore').split(',').filter(Boolean)
const extra = flag('--names').split(',').filter(Boolean)
const [domain, nsA, nsB] = args
if (!domain || !nsA || !nsB) {
  console.error('usage: node scripts/dns-compare.mjs <domain> <nameserverA> <nameserverB> [--ignore key,key] [--names n1,n2]')
  process.exit(2)
}

async function resolverFor(host) {
  const ip = /^[0-9.]+$/.test(host) || host.includes(':') ? host : (await dns.lookup(host)).address
  const resolver = new dns.Resolver({ timeout: 4000, tries: 2 })
  resolver.setServers([ip])
  return { resolver, ip }
}

async function collect(resolver, names) {
  const out = {}
  for (const name of names) {
    for (const type of RECORD_TYPES) {
      try {
        const answers = await resolver.resolve(name, type)
        out[name + '|' + type] = normalise(type, answers)
      } catch (error) {
        // "no data" and "no such name" are answers too: an empty list.
        if (['ENODATA', 'ENOTFOUND'].includes(error.code)) out[name + '|' + type] = []
        else throw new Error(name + ' ' + type + ': ' + (error.code ?? error.message))
      }
    }
  }
  return out
}

const names = defaultNames(domain, extra)
const [a, b] = await Promise.all([resolverFor(nsA), resolverFor(nsB)])
console.log('Comparing ' + domain + ': A = ' + nsA + ' (' + a.ip + '), B = ' + nsB + ' (' + b.ip + '); ' + names.length + ' names x ' + RECORD_TYPES.length + ' types')
const ra = await collect(a.resolver, names)
const rb = await collect(b.resolver, names)
const { same, differences } = compareResults(ra, rb, ignore)
for (const d of differences) console.log('DIFFERENT ' + d.key + '\n  A: ' + JSON.stringify(d.a) + '\n  B: ' + JSON.stringify(d.b))
console.log(same ? 'SAME: every compared record matches.' : differences.length + ' difference(s).')
process.exit(same ? 0 : 1)
