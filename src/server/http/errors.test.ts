import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined }))

import { isTemporaryFailure, unexpectedError } from './errors'

describe('unexpectedError', () => {
  it('reports a database that cannot be reached as a retryable 503 with JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = unexpectedError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('5')
    expect(await res.json()).toMatchObject({ code: 'unavailable' })
  })

  it('reports anything else as a JSON 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = unexpectedError(new TypeError('boom'))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'server-error' })
  })

  it('recognises pool exhaustion, statement timeouts and wrapped driver errors', () => {
    expect(isTemporaryFailure(new Error('timeout exceeded when trying to connect'))).toBe(true)
    expect(isTemporaryFailure({ code: '57014' })).toBe(true)
    expect(isTemporaryFailure({ cause: { code: '53300' } })).toBe(true)
    expect(isTemporaryFailure(new Error('column does not exist'))).toBe(false)
    expect(isTemporaryFailure(null)).toBe(false)
  })
})
