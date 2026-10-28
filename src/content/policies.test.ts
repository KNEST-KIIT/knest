import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { POLICIES } from './policies'

/**
 * Pins the published legal text. `terms` is 02_Terms_and_Conditions.docx (sha256
 * 1a3ab6b961f06bc6ae9510216f4a412131dd9d1543e1cd318076a5f1a8ce5406), reproduced with the four
 * adjustments listed in docs/delivery/STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md (A1-A4).
 * The hashes cover each section's paragraphs joined by a newline, so a changed word, a dropped
 * paragraph or a reordered section fails here; changing legal text is meant to be a deliberate act
 * that updates this table together with the source file's hash in that document.
 */
const TERMS_SECTIONS: readonly [number, string, number, string][] = [
  [1, 'Acceptance and scope', 2, 'd2be2b94bb21ff8a9bbe572b2afa0b7914f84bfa194f576d016083a44cc95ca4'],
  [2, 'Platform operator and contact', 1, '9746aa88644a1069bc8a6fc20d9c4f81c139dcd35214b61dd40b0c0085311f66'],
  [3, 'Accounts and eligibility', 4, '4d93679542bf63202660c2f1a72efe0125ae18a5ec4bcf289fc25d7f77de3ab3'],
  [4, 'Acceptable use', 2, 'be9b979746878c65d078e108536f392f2662a482ac35cf42a5d11573a19572cc'],
  [5, 'Applications and submissions', 2, 'a867a07cf4cc35b53c7e61c505ff1b0a3dcbef4c9fa1ded6b10faafce5cf6635'],
  [6, 'Incubation, mentoring and funding', 3, 'a28e622bbceaf7e47dde4deabbcb752a909a50980800cb25fa88cf4aaafe8fb4'],
  [7, 'Bookings, attendance and facilities', 3, 'daecd4fcaf336723373ff87040c8d2e398879af81ba1cbb8a755454243ef5142'],
  [8, 'User content and permissions', 4, '027ae5d52fa8c7de8b2da395de1e0d3123b8b8ed11f2ab90193fa2fd1bcb5f61'],
  [9, 'Intellectual property', 3, '1c823c35a9a2d2ea82c7451123b813e64e7e6f66af2c368df8a3fb9d48db296c'],
  [10, 'Third-party links and services', 1, 'bc20a67c7beea6ddef25f3da5e7bcf340f8be338a25c24ee696ed3dcc6ecae5b'],
  [11, 'Suspension and termination', 2, '0141ae991c47de48cb109f495803121ebf195f3a120bf6187c3d144550eff917'],
  [12, 'Availability and disclaimers', 1, '62fa1ad2fb4bc097829944840e8561ca4fe6b880710c101a7939585107db8ea6'],
  [13, 'Liability and indemnity', 4, '1aa4661e53922839b07ecf6d2de36eb4169b025fafb14d8cedd3800c3cf473b7'],
  [14, 'Changes, governing law and disputes', 1, 'da2001741b79470ef2b8557f3c23e0096d70fe15695d432d4e3065cca37cf598'],
  [15, 'Contact', 1, 'c7294f87d43261137df95d9134b3cf70adbb9da29a2270b98b95081c5285f839'],
]

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const allText = () => Object.values(POLICIES).flatMap((policy) => policy.sections.flatMap((section) => [section.heading, ...section.paragraphs]))

describe('published policy documents', () => {
  it('publishes four documents at four distinct routes, each with a version date', () => {
    expect(Object.keys(POLICIES)).toEqual(['privacy', 'terms', 'facilityTerms', 'disclaimer'])
    expect(Object.values(POLICIES).map((policy) => policy.href)).toEqual(['/privacy', '/terms', '/terms/facilities', '/disclaimer'])
    for (const policy of Object.values(POLICIES)) expect(policy.version).toMatch(/^\d{1,2} [A-Z][a-z]+ 20\d{2}$/)
  })

  it('names the general terms exactly as the stakeholder file does and keeps the earlier service terms separate', () => {
    expect(POLICIES.terms.title).toBe('KIITNEST Terms and Conditions')
    expect(POLICIES.facilityTerms.title).toBe('Mentorship and facility terms')
    expect(POLICIES.facilityTerms.sections).toHaveLength(5)
    expect(POLICIES.facilityTerms.sections.reduce((n, s) => n + s.paragraphs.length, 0)).toBe(14)
  })
})

describe('Terms and Conditions (02_Terms_and_Conditions.docx)', () => {
  const sections = POLICIES.terms.sections

  it('has the fifteen numbered sections of the source, in the source order', () => {
    expect(sections.map((s) => s.heading)).toEqual(TERMS_SECTIONS.map((row) => row[1]))
    expect(sections.map((s) => s.paragraphs.length)).toEqual(TERMS_SECTIONS.map((row) => row[2]))
  })

  it.each(TERMS_SECTIONS)('section %i "%s" is reproduced word for word', (number, heading, count, hash) => {
    const section = sections[number - 1]!
    expect(section.heading).toBe(heading)
    expect(section.paragraphs).toHaveLength(count)
    expect(sha256(section.paragraphs.join('\n'))).toBe(hash)
  })

  it('carries the support address and the registered office in the sections that name them', () => {
    expect(sections[14]!.paragraphs[0]).toContain('Support: contact@kiitnest.com')
    expect(sections[14]!.paragraphs[0]).toContain('Plot-386, Sub Plot-1, Sai Anandam, KIIT, Khorda, Bhubaneswar')
    expect(sections[1]!.paragraphs[0]).toContain('KIITNEST INCUBATION FORUM')
    expect(sections[2]!.paragraphs[2]).toContain('emailing contact@kiitnest.com.')
  })

  it('records the one engineering-supplied heading and the one completed sentence, and nothing else invented', () => {
    // A1: the source has no heading 3; its second group of paragraphs about accounts is published under this one.
    expect(sections[2]!.heading).toBe('Accounts and eligibility')
    // A2: the source sentence stops after "KIITNEST"; only a full stop is added.
    expect(sections[2]!.paragraphs[3]).toBe('Service-specific eligibility criteria and approval procedures will be published on KIITNEST.')
    // A4: no hidden no-break spaces survive into the published terms (the earlier privacy text is left as accepted).
    expect(sections.flatMap((s) => s.paragraphs).some((text) => text.includes(' '))).toBe(false)
    // The governing-law clause is not supplied in the source: no jurisdiction or venue is invented.
    expect(sections[13]!.paragraphs).toHaveLength(1)
    expect(sections[13]!.paragraphs[0]).not.toMatch(/jurisdiction|courts? (of|at|in)|arbitrat|governed by the laws/i)
  })
})

describe('retention wording after the five-years-then-backup decision', () => {
  it('states five years followed by transfer to an approved backup and archive', () => {
    const retention = POLICIES.privacy.sections.find((section) => section.heading === 'Retention and deletion')!
    const text = retention.paragraphs.join(' ')
    expect(text).toMatch(/period of 5 years/)
    expect(text).toMatch(/transferred to an approved backup and archive/)
    expect(text).toMatch(/After the 5-year retention period/)
  })

  it('dates the privacy policy from the day its retention text changed, not from the superseded text', () => {
    // `version` is the date the text was put on the site. The retention section changed from ten years to five years then
    // approved backup and archive on 27 October 2026, so the policy must not keep presenting itself as the 17 October text.
    expect(POLICIES.privacy.version).toBe('27 October 2026')
    // The documents whose text did not change keep the date they were put on the site.
    expect(POLICIES.disclaimer.version).toBe('17 October 2026')
    expect(POLICIES.facilityTerms.version).toBe('17 October 2026')
  })

  it('no longer contains any ten-year retention language in any published document', () => {
    const offenders = allText().filter((text) => /ten[- ]year|10[- ]year|\bten years\b|\b10 years\b|decade/i.test(text))
    expect(offenders).toEqual([])
  })
})

describe('publication hygiene', () => {
  it('shows no draft, placeholder or review marker on any published document', () => {
    const offenders = allText().filter((text) => /draft for institutional review|being finalised|lorem ipsum|\bTBD\b|\bTODO\b|\[[^\]]*\bto be\b[^\]]*\]/i.test(text))
    expect(offenders).toEqual([])
  })

  it('has no empty heading or paragraph and no duplicate heading inside one document', () => {
    for (const policy of Object.values(POLICIES)) {
      const headings = policy.sections.map((section) => section.heading)
      expect(new Set(headings).size, policy.title).toBe(headings.length)
      for (const section of policy.sections) {
        expect(section.heading.trim()).not.toBe('')
        for (const paragraph of section.paragraphs) expect(paragraph.trim()).not.toBe('')
      }
    }
  })
})
