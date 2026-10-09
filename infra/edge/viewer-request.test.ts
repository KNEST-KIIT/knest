import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * Runs the CloudFront Function source exactly as written, with Node's own crypto
 * and buffer standing in for CloudFront's modules of the same names.
 */
const nodeRequire = createRequire(import.meta.url)
const source = readFileSync(new URL('./viewer-request.js', import.meta.url), 'utf8')

type Headers = Record<string, { value: string }>
type Req = {
  uri: string
  querystring: Record<string, { value: string; multiValue?: { value: string }[] }>
  headers: Headers
}
type Redirect = { statusCode: number; headers: Headers }

function load(accessHash = ''): (event: { request: Req }) => Req | Redirect {
  const code = source.replace('__ACCESS_HASH__', accessHash)
  return new Function('require', `${code}\nreturn handler`)(nodeRequire)
}
const req = (host: string, uri = '/', querystring: Req['querystring'] = {}, extra: Headers = {}): { request: Req } => ({
  request: { uri, querystring, headers: { host: { value: host }, ...extra } },
})
const basic = (userPass: string): Headers => ({ authorization: { value: `Basic ${Buffer.from(userPass).toString('base64')}` } })

describe('canonical host redirects', () => {
  const handler = load()

  it.each(['www.kiitnest.com', 'kiitnest.in', 'www.kiitnest.in', 'KIITNEST.IN', 'www.kiitnest.com:443'])(
    '%s -> https://kiitnest.com, 301',
    (host) => {
      const r = handler(req(host, '/programs/incubate')) as Redirect
      expect(r.statusCode).toBe(301)
      expect(r.headers.location!.value).toBe('https://kiitnest.com/programs/incubate')
    },
  )

  it('keeps the path and the query string, including repeated and valueless keys', () => {
    const r = handler(
      req('kiitnest.in', '/apply/x', {
        a: { value: '1' },
        tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] },
        flag: { value: '' },
      }),
    ) as Redirect
    expect(r.headers.location!.value).toBe('https://kiitnest.com/apply/x?a=1&tag=a&tag=b&flag')
  })

  it('redirects the root without a double slash', () => {
    expect((handler(req('www.kiitnest.com', '/')) as Redirect).headers.location!.value).toBe('https://kiitnest.com/')
  })

  it('passes the canonical host and the distribution’s own hostname through untouched', () => {
    for (const host of ['kiitnest.com', 'd111111abcdef8.cloudfront.net']) {
      const event = req(host, '/x')
      expect(handler(event)).toBe(event.request)
    }
  })

  it('does not treat look-alike hosts as ours', () => {
    const event = req('www.kiitnest.com.evil.example', '/x')
    expect(handler(event)).toBe(event.request)
  })
})

describe('private-first access gate', () => {
  const hash = createHash('sha256').update('reviewer:correct horse battery').digest('hex')
  const handler = load(hash)

  it('refuses a request with no credentials, wrong credentials, or another scheme', () => {
    const attempts: Headers[] = [
      {},
      basic('reviewer:wrong'),
      basic('someone:correct horse battery'),
      { authorization: { value: 'Bearer abc' } },
    ]
    for (const headers of attempts) {
      const r = handler(req('kiitnest.com', '/', {}, headers)) as Redirect
      expect(r.statusCode).toBe(401)
      expect(r.headers['www-authenticate']!.value).toContain('Basic')
      expect(r.headers['cache-control']!.value).toBe('no-store')
    }
  })

  it('lets the right credentials through and removes the Authorization header', () => {
    const event = req('d111111abcdef8.cloudfront.net', '/dashboard', {}, basic('reviewer:correct horse battery'))
    const r = handler(event) as Req
    expect(r).toBe(event.request)
    expect(r.headers.authorization).toBeUndefined()
  })

  it('is off when the hash is empty (the public site)', () => {
    const event = req('kiitnest.com', '/')
    expect(load('')(event)).toBe(event.request)
  })

  it('contains no credential, only a digest placeholder', () => {
    expect(source).toContain("ACCESS_HASH = '__ACCESS_HASH__'")
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/password|secret/i)
  })
})
