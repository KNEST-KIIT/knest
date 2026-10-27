import { describe, expect, it } from 'vitest'
import { formatDate } from '@/lib/dates'
import { applicationDeadlineState, brochureLink, SIEL } from './siel'

describe('SIEL facts from "KNEST Website changes.docx"', () => {
  it('points the school address at siel.kiit.ac.in, never at the old sld subdomain', () => {
    expect(new URL(SIEL.origin).hostname).toBe('siel.kiit.ac.in')
    expect(new URL(SIEL.programmeUrl).hostname).toBe('siel.kiit.ac.in')
    expect(new URL(SIEL.programmeUrl).protocol).toBe('https:')
    expect(`${SIEL.origin}${SIEL.programmeUrl}${SIEL.name}`).not.toMatch(/sld\.|School of Leadership/i)
  })

  it('uses the full school name, not the old abbreviation or name', () => {
    expect(SIEL.name).toBe('School of Innovation & Entrepreneurial Leadership')
    expect(SIEL.shortName).toBe('SIEL')
  })

  it('starts the cohort on 13 July 2027', () => {
    expect(SIEL.cohortStart).toBe('2027-07-13')
    expect(formatDate(SIEL.cohortStart)).toBe('13 July 2027')
  })
})

describe('application deadline', () => {
  it('is awaiting confirmation: the 16 February 2027 date is outdated and no newer authority exists', () => {
    expect(SIEL.applicationDeadline).toBeNull()
    expect(SIEL.applicationDeadline).not.toBe('2027-02-16')
    expect(applicationDeadlineState()).toEqual({ kind: 'awaiting-confirmation' })
  })

  it('shows a deadline only when a well-formed confirmed date is supplied', () => {
    expect(applicationDeadlineState('2027-06-30')).toEqual({ kind: 'confirmed', iso: '2027-06-30' })
    for (const bad of [null, '', '30 June 2027', '2027-6-30', '2027-06-30T00:00:00Z', 'TBD']) {
      expect(applicationDeadlineState(bad)).toEqual({ kind: 'awaiting-confirmation' })
    }
  })
})

describe('brochure link', () => {
  it('is unavailable until a real file or address is supplied', () => {
    expect(SIEL.brochureUrl).toBeNull()
    expect(brochureLink()).toBeNull()
  })

  it('accepts only an https address or a PDF served from this site', () => {
    expect(brochureLink('https://siel.kiit.ac.in/files/brochure.pdf')).toBe('https://siel.kiit.ac.in/files/brochure.pdf')
    expect(brochureLink('/brochures/siel-mba-iev.pdf')).toBe('/brochures/siel-mba-iev.pdf')
  })

  it.each([
    'http://siel.kiit.ac.in/brochure.pdf',
    '//evil.example/brochure.pdf',
    '/brochures/readme.txt',
    'javascript:alert(1)',
    'data:application/pdf;base64,AAAA',
    'mailto:contact@kiitnest.com',
    '#',
    'not a url',
    '',
  ])('refuses %j', (value) => {
    expect(brochureLink(value)).toBeNull()
  })
})
