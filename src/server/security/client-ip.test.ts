import { describe, expect, it } from 'vitest'
import { clientIpFromHeaders, clientIpSource } from './client-ip'

const headers = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null

describe('client address source (KN-22c)', () => {
  it('defaults to CloudFront in production and to X-Forwarded-For elsewhere', () => {
    expect(clientIpSource({ NODE_ENV: 'production' })).toBe('cloudfront')
    expect(clientIpSource({ NODE_ENV: 'development' })).toBe('x-forwarded-for')
    expect(clientIpSource({ NODE_ENV: 'production', CLIENT_IP_SOURCE: 'x-forwarded-for' })).toBe('x-forwarded-for')
  })

  it('in CloudFront mode a spoofed X-Forwarded-For changes nothing', () => {
    const env = { NODE_ENV: 'production' }
    const real = clientIpFromHeaders(headers({ 'cloudfront-viewer-address': '203.0.113.7:51234', 'x-forwarded-for': '1.1.1.1' }), env)
    const spoofed = clientIpFromHeaders(headers({ 'cloudfront-viewer-address': '203.0.113.7:51234', 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }), env)
    expect(real).toBe('203.0.113.7')
    expect(spoofed).toBe('203.0.113.7')
  })

  it('reads IPv6 viewer addresses with the trailing port, bracketed or not', () => {
    const env = { NODE_ENV: 'production' }
    expect(clientIpFromHeaders(headers({ 'cloudfront-viewer-address': '2001:db8::1:46532' }), env)).toBe('2001:db8::1')
    expect(clientIpFromHeaders(headers({ 'cloudfront-viewer-address': '[2001:db8::1]:46532' }), env)).toBe('2001:db8::1')
  })

  it('does not fall back to the spoofable header when CloudFront’s is missing', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '1.1.1.1' }), { NODE_ENV: 'production' })).toBe('unknown')
  })

  it('X-Forwarded-For mode takes the first hop (development and tests)', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1' }), { NODE_ENV: 'test' })).toBe('198.51.100.9')
    expect(clientIpFromHeaders(headers({}), { NODE_ENV: 'test' })).toBe('unknown')
  })
})
