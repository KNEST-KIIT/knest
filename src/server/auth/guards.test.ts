import { afterEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.fn()
vi.mock('./index', () => ({ auth: (...args: unknown[]) => authMock(...args) }))

import { getSessionUser } from './guards'

afterEach(() => {
  vi.unstubAllEnvs()
  authMock.mockReset()
})

describe('getSessionUser (KN-09: no development bypass)', () => {
  for (const env of ['development', 'production', 'test']) {
    it(`returns null when auth() throws, NODE_ENV=${env}`, async () => {
      vi.stubEnv('NODE_ENV', env)
      authMock.mockRejectedValue(new Error('db down'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(await getSessionUser()).toBeNull()
      expect(spy).toHaveBeenCalled() // the failure is visible, not swallowed
      spy.mockRestore()
    })
  }

  it("lets Next's dynamic-render signal through instead of treating it as a signed-out user", async () => {
    const signal = Object.assign(new Error('Dynamic server usage'), { digest: 'DYNAMIC_SERVER_USAGE' })
    authMock.mockRejectedValue(signal)
    await expect(getSessionUser()).rejects.toBe(signal)
  })

  it('returns the session user when auth() succeeds', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    expect(await getSessionUser()).toEqual({ id: 'u1', email: 'a@b.c' })
  })

  it('returns null when there is no session', async () => {
    authMock.mockResolvedValue(null)
    expect(await getSessionUser()).toBeNull()
  })
})
