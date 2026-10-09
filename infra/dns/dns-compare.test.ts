import { describe, expect, it } from 'vitest'
import { compareResults, defaultNames, normalise } from '../../scripts/lib/dns-compare-core.mjs'

describe('normalise', () => {
  it('joins the 255-character strings of a TXT record, so a split DKIM key equals an unsplit one', () => {
    const whole = 'v=DKIM1;k=rsa;p=' + 'A'.repeat(392)
    expect(normalise('TXT', [[whole]])).toEqual(normalise('TXT', [[whole.slice(0, 255), whole.slice(255)]]))
  })

  it('is insensitive to order, case and the trailing dot', () => {
    expect(normalise('MX', [{ priority: 1, exchange: 'SMTP.google.com.' }])).toEqual(['1 smtp.google.com'])
    expect(normalise('NS', ['B.example.', 'a.example'])).toEqual(['a.example', 'b.example'])
    expect(normalise('A', ['9.9.9.9', '1.1.1.1'])).toEqual(['1.1.1.1', '9.9.9.9'])
  })
})

describe('compareResults', () => {
  const mail = { 'kiitnest.com|MX': ['1 smtp.google.com'], 'kiitnest.com|TXT': ['v=spf1 x ~all', 'google-site-verification=abc'] }

  it('passes when everything matches', () => {
    expect(compareResults(mail, { ...mail }).same).toBe(true)
  })

  it('catches a lost mail record or a missing TXT value', () => {
    const missingMx = compareResults(mail, { ...mail, 'kiitnest.com|MX': [] })
    expect(missingMx.same).toBe(false)
    expect(missingMx.differences[0]?.key).toBe('kiitnest.com|MX')
    expect(compareResults(mail, { ...mail, 'kiitnest.com|TXT': ['v=spf1 x ~all'] }).same).toBe(false)
  })

  it('treats a record present on one side only as a difference', () => {
    expect(compareResults(mail, { ...mail, '_dmarc.kiitnest.com|TXT': ['v=DMARC1; p=none'] }).same).toBe(false)
  })

  it('lets the cutover change what it is meant to change, and nothing else', () => {
    const before = { ...mail, 'kiitnest.com|A': ['15.197.148.33'], 'kiitnest.com|NS': ['ns43.domaincontrol.com'] }
    const after = { ...mail, 'kiitnest.com|A': ['13.35.0.1'], 'kiitnest.com|NS': ['ns-1.awsdns-1.org'] }
    expect(compareResults(before, after).same).toBe(false)
    expect(compareResults(before, after, ['kiitnest.com|A', 'NS']).same).toBe(true)
    expect(compareResults(before, { ...after, 'kiitnest.com|MX': [] }, ['kiitnest.com|A', 'NS']).same).toBe(false)
  })
})

describe('defaultNames', () => {
  it('covers the mail and verification names of the inventory', () => {
    const names: string[] = defaultNames('kiitnest.com', ['extra.kiitnest.com'])
    for (const n of ['kiitnest.com', 'www.kiitnest.com', '_dmarc.kiitnest.com', 'google._domainkey.kiitnest.com', 'dc-bdaca08905._spfm.kiitnest.com', 'extra.kiitnest.com']) {
      expect(names).toContain(n)
    }
  })
})
