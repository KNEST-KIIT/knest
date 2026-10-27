import { describe, expect, it } from 'vitest'
import { get } from '../support/helpers'

/**
 * Requirement-to-route evidence for the two stakeholder files of 2026-10-27, run against the production build
 * (docs/delivery/STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md maps each line to a test below):
 *  - 02_Terms_and_Conditions.docx  ->  /terms (and the earlier service terms at /terms/facilities)
 *  - KNEST Website changes.docx    ->  /about (the SIEL section) and the retention wording on /privacy
 */

const TERMS_HEADINGS = [
  'Acceptance and scope',
  'Platform operator and contact',
  'Accounts and eligibility',
  'Acceptable use',
  'Applications and submissions',
  'Incubation, mentoring and funding',
  'Bookings, attendance and facilities',
  'User content and permissions',
  'Intellectual property',
  'Third-party links and services',
  'Suspension and termination',
  'Availability and disclaimers',
  'Liability and indemnity',
  'Changes, governing law and disputes',
  'Contact',
]

/** React separates adjacent text nodes with comment markers; the reader never sees them. */
const withoutMarkers = (html: string) => html.replace(/<!--.*?-->/g, '')
const page = async (path: string) => {
  const res = await get(path)
  expect(res.status, path).toBe(200)
  return withoutMarkers(await res.text())
}

describe('/terms publishes the Terms and Conditions', () => {
  it('shows the title, the version, all fifteen sections in order, and a contents list that links to each', async () => {
    const html = await page('/terms')
    expect(html).toContain('KIITNEST Terms and Conditions')
    expect(html).toContain('Policy version: 27 October 2026')
    let from = 0
    TERMS_HEADINGS.forEach((heading, index) => {
      const at = html.indexOf(`>${index + 1}. ${heading}</h2>`, from)
      expect(at, `section ${index + 1} "${heading}"`).toBeGreaterThan(-1)
      from = at
      expect(html).toContain(`id="section-${index + 1}"`)
      expect(html).toContain(`href="#section-${index + 1}"`)
    })
    expect(html).not.toContain('id="section-16"')
  })

  it('carries the clauses a reader relies on, as supplied', async () => {
    const html = await page('/terms')
    for (const phrase of [
      'These Terms govern access to and use of KIITNEST',
      'Registration on KIITNEST does not guarantee acceptance into an incubation programme',
      'upload malware',
      'KIITNEST does not promise incubation, mentorship, funding, investment',
      'Booking confirmation is not transferable unless expressly permitted',
      'limited, non-exclusive, royalty-free permission',
      'These Terms do not independently transfer ownership of such intellectual property',
      'Nothing in these Terms excludes or limits any liability, right or remedy that cannot lawfully be excluded or limited',
      'Plot-386, Sub Plot-1, Sai Anandam, KIIT, Khorda, Bhubaneswar',
    ]) expect(html, phrase).toContain(phrase)
  })

  it('links the support address and shows no draft or review marker', async () => {
    const html = await page('/terms')
    expect(html).toContain('href="mailto:contact@kiitnest.com"')
    expect(html).not.toMatch(/being finalised|Draft, not approved|Draft for institutional review/i)
  })

  it('keeps the earlier mentorship and facility terms reachable from the policy navigation', async () => {
    const terms = await page('/terms')
    expect(terms).toContain('href="/terms/facilities"')
    const facilities = await page('/terms/facilities')
    for (const heading of ['Mentorship and expert access', 'Lab and facility booking', 'QR attendance and access passes', 'Events and communications', 'Misuse and service restrictions']) {
      expect(facilities).toContain(heading)
    }
    expect(facilities).toContain('href="/terms"')
  })
})

describe('/privacy retention wording', () => {
  it('says five years, then transfer to an approved backup and archive, with no ten-year wording', async () => {
    const html = await page('/privacy')
    expect(html).toContain('for a period of 5 years')
    expect(html).toContain('transferred to an approved backup and archive')
    expect(html).not.toMatch(/ten[- ]year|10[- ]year|ten years|10 years/i)
  })
})

describe('/about shows SIEL, its address, and honest admissions facts', () => {
  it('names the school in full and links every reference to siel.kiit.ac.in over https', async () => {
    const html = await page('/about')
    expect(html).toContain('School of Innovation &amp; Entrepreneurial Leadership')
    const links = [...html.matchAll(/href="(https:\/\/siel\.kiit\.ac\.in[^"]*)"/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThanOrEqual(2)
    expect(new Set(links)).toEqual(new Set(['https://siel.kiit.ac.in/mba']))
    for (const anchor of html.match(/<a [^>]*href="https:\/\/siel\.kiit\.ac\.in[^>]*>/g) ?? []) {
      expect(anchor).toContain('rel="noopener noreferrer"')
    }
  })

  it('leaves no trace of the old address, the old school name, or the SLD abbreviation', async () => {
    const html = await page('/about')
    expect(html).not.toMatch(/sld\.kiit\.ac\.in/i)
    expect(html).not.toMatch(/School of Leadership/i)
    expect(html).not.toMatch(/\bSLD\b/)
  })

  it('states the cohort start of 13 July 2027 as a machine-readable date', async () => {
    const html = await page('/about')
    expect(html).toContain('Admissions at a glance')
    expect(html).toContain('Cohort start')
    expect(html).toMatch(/<time dateTime="2027-07-13">13 July 2027<\/time>|<time datetime="2027-07-13">13 July 2027<\/time>/)
  })

  it('does not publish the outdated 16 February 2027 deadline; it says the date is awaiting confirmation', async () => {
    const html = await page('/about')
    expect(html).toContain('Application deadline')
    expect(html).toContain('Awaiting confirmation')
    expect(html).not.toMatch(/16\s+Feb(ruary)?\s+2027|2027-02-16|Feb(ruary)?\s+16,?\s+2027/i)
  })

  it('offers exactly one brochure call to action at most, and says so honestly when there is no brochure', async () => {
    const html = await page('/about')
    expect(html).not.toMatch(/request (a|the) brochure|brochure by e-?mail/i)
    const downloads = html.match(/Download the brochure/g) ?? []
    expect(downloads.length).toBeLessThanOrEqual(1)
    if (downloads.length === 0) {
      // No brochure has been supplied: the page must say so rather than link to nothing.
      expect(html).toContain('The brochure is not available yet')
      expect(html).not.toMatch(/href="#"|href=""/)
    }
  })
})

describe('sitemap', () => {
  it('lists both terms documents', async () => {
    const res = await get('/sitemap.xml')
    const xml = await res.text()
    expect(xml).toMatch(/\/terms<\/loc>/)
    expect(xml).toContain('/terms/facilities')
  })
})
