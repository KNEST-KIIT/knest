import { describe, expect, it } from 'vitest'
import { resourceDestination } from './resource-url'

describe('resourceDestination', () => {
  it('uses neutral truthful CTA when format is missing for file-only resource', () => {
    const res = resourceDestination({
      title: 'Audit File Only Resource',
      slug: 'audit-file-only-resource',
      file: { id: 1, url: '/media/test.pdf' },
    })

    expect(res.href).toBe('/resources/audit-file-only-resource')
    expect(res.label).toBe('View Audit File Only Resource')
    expect(res.ctaText).toBe('View resource →')
  })

  it('uses neutral truthful CTA when format is missing for hosted body resource', () => {
    const res = resourceDestination({
      title: 'Generic Guide',
      slug: 'generic-guide',
      body: { root: {} },
    })

    expect(res.href).toBe('/resources/generic-guide')
    expect(res.label).toBe('View Generic Guide')
    expect(res.ctaText).toBe('View resource →')
  })

  it('uses proven format when metadata explicitly specifies template', () => {
    const res = resourceDestination({
      title: 'Cap Table Model',
      slug: 'cap-table-model',
      format: 'template',
      file: { id: 2 },
    })

    expect(res.label).toBe('Download Cap Table Model')
    expect(res.ctaText).toBe('Download template →')
  })

  it('uses proven format when metadata explicitly specifies guide', () => {
    const res = resourceDestination({
      title: 'Founder Equity 101',
      slug: 'founder-equity-101',
      format: 'guide',
      body: { root: {} },
    })

    expect(res.label).toBe('Read Founder Equity 101')
    expect(res.ctaText).toBe('Read guide →')
  })

  it('uses neutral truthful copy for external URLs without guessing', () => {
    const res = resourceDestination({
      title: 'External Resource',
      slug: 'external-resource',
      externalUrl: 'https://example.com/tool',
    })

    expect(res.href).toBe('https://example.com/tool')
    expect(res.label).toBe('Visit External Resource')
    expect(res.ctaText).toBe('Open resource →')
    expect(res.isExternal).toBe(true)
  })

  it('trims whitespace on valid HTTP/HTTPS URLs', () => {
    const res = resourceDestination({
      title: 'Padded URL Resource',
      slug: 'padded-url-resource',
      externalUrl: '   https://example.com/padded   ',
    })

    expect(res.href).toBe('https://example.com/padded')
    expect(res.isExternal).toBe(true)
  })

  it('rejects javascript: and falls back to safe internal resource URL', () => {
    const res = resourceDestination({
      title: 'XSS Attempt',
      slug: 'xss-attempt',
      externalUrl: 'javascript:alert(1)',
    })

    expect(res.href).toBe('/resources/xss-attempt')
    expect(res.isExternal).toBe(false)
    expect(res.isHosted).toBe(true)
  })

  it('rejects non-http/https protocols such as ftp: and falls back to safe internal URL', () => {
    const res = resourceDestination({
      title: 'FTP File',
      slug: 'ftp-file',
      externalUrl: 'ftp://files.example.com/data.zip',
    })

    expect(res.href).toBe('/resources/ftp-file')
    expect(res.isExternal).toBe(false)
  })

  it('rejects malformed URLs and falls back to safe internal URL', () => {
    const res = resourceDestination({
      title: 'Malformed',
      slug: 'malformed-url',
      externalUrl: 'ht!tp://not a valid url',
    })

    expect(res.href).toBe('/resources/malformed-url')
    expect(res.isExternal).toBe(false)
  })
})
