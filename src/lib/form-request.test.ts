import { afterEach, describe, expect, it, vi } from 'vitest'
import { formRequest } from './form-request'

afterEach(() => vi.unstubAllGlobals())

describe('form network recovery', () => {
  it('returns a retryable error after disconnect without retrying the write', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const result = await formRequest('/api/applications/start', { method: 'POST' })
    expect(result.status).toBe(503)
    expect((await result.json()).error).toMatch(/couldn’t confirm/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserves authentication and validation responses', async () => {
    const response = Response.json({ error: 'Sign in again.' }, { status: 401 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    expect(await formRequest('/api/onboarding/step')).toBe(response)
  })

  it('also terminates a stalled request', async () => {
    vi.useFakeTimers()
    const abort = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(abort.signal)
    vi.stubGlobal('fetch', vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason))
    })))
    const request = formRequest('/api/applications/start', { method: 'POST' })
    abort.abort(new DOMException('Timed out', 'TimeoutError'))
    expect((await request).status).toBe(503)
    expect(timeout).toHaveBeenCalledWith(30_000)
    timeout.mockRestore()
    vi.useRealTimers()
  })
})
