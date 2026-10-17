// Pure logic for scripts/dns-compare.mjs: normalise what a nameserver answered and
// diff two answers. No network here, so it is unit-tested (infra/dns/*.test.ts).

/** One answer to "name, type" reduced to a sorted list of comparable strings. */
export function normalise(type, answers) {
  const lower = (s) => s.toLowerCase().replace(/[.]$/, '')
  switch (type) {
    case 'A':
    case 'AAAA':
      return [...answers].map((a) => a.toLowerCase()).sort()
    case 'CNAME':
    case 'NS':
      return [...answers].map(lower).sort()
    case 'MX':
      return [...answers].map((m) => m.priority + ' ' + lower(m.exchange)).sort()
    case 'TXT':
      // resolveTxt returns each record as its 255-character strings; a record is their concatenation.
      return [...answers].map((chunks) => chunks.join('')).sort()
    default:
      return [...answers].map(String).sort()
  }
}

/**
 * Compares two result maps keyed "name|TYPE". `ignore` lists keys (or "TYPE" alone,
 * or "name|*") whose differences are expected, for example the apex A record that the
 * cutover is supposed to change. `required` keys need nonempty matching answers;
 * `expected` supplies normalized provider-derived answers. Neither can be waived
 * by `ignore`. Returns { same, differences[] }.
 */
export function compareResults(a, b, ignore = [], required = [], expected = {}) {
  const ignored = new Set(ignore.map((s) => s.toLowerCase()))
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  const differences = []
  for (const key of keys) {
    const [name, type] = key.split('|')
    if (ignored.has(key.toLowerCase()) || ignored.has(type.toLowerCase()) || ignored.has((name + '|*').toLowerCase())) continue
    const left = a[key] ?? []
    const right = b[key] ?? []
    if (JSON.stringify(left) !== JSON.stringify(right)) differences.push({ key, a: left, b: right })
  }
  // Two absent answers are equal, but cannot prove a required origin, mail or
  // certificate record survived the migration. Required records cannot be ignored.
  for (const key of new Set(required)) {
    const left = a[key] ?? []
    const right = b[key] ?? []
    if (left.length && right.length && JSON.stringify(left) === JSON.stringify(right)) continue
    if (!differences.some((d) => d.key === key)) differences.push({ key, a: left, b: right, missingRequired: !left.length || !right.length })
  }
  for (const [key, value] of Object.entries(expected)) {
    const left = a[key] ?? []
    const right = b[key] ?? []
    if (JSON.stringify(left) === JSON.stringify(value) && JSON.stringify(right) === JSON.stringify(value)) continue
    const existing = differences.find((d) => d.key === key)
    if (existing) existing.expected = value
    else differences.push({ key, a: left, b: right, expected: value })
  }
  return { same: differences.length === 0, differences }
}

/** The names that must resolve identically for mail, web and origin, plus any extras. */
export function defaultNames(domain, extra = []) {
  const base = [
    domain,
    'www.' + domain,
    'origin.' + domain,
    '_dmarc.' + domain,
    'google._domainkey.' + domain,
    'dc-bdaca08905._spfm.' + domain,
    '_domainconnect.' + domain,
  ]
  return [...new Set([...base, ...extra])]
}

export const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']
