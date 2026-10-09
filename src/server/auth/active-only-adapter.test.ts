import type { Adapter } from 'next-auth/adapters'
import { describe, expect, it, vi } from 'vitest'
import { activeOnly } from './active-only-adapter'

const session = { sessionToken: 't1', userId: 'u1', expires: new Date(Date.now() + 1e6) }
const user = { id: 'u1', email: 'a@b.test', emailVerified: null }

function fake() {
  const deleteSession = vi.fn(async () => {})
  const getSessionAndUser = vi.fn(async (token: string) => (token === 't1' ? { session, user } : null))
  return { adapter: { getSessionAndUser, deleteSession } as unknown as Adapter, deleteSession, getSessionAndUser }
}

describe('activeOnly (KN-10)', () => {
  it('passes an active user through unchanged', async () => {
    const { adapter, deleteSession } = fake()
    const wrapped = activeOnly(adapter, async () => true)
    expect(await wrapped.getSessionAndUser!('t1')).toEqual({ session, user })
    expect(deleteSession).not.toHaveBeenCalled()
  })

  it('treats a deactivated user as signed out and deletes the session row', async () => {
    const { adapter, deleteSession } = fake()
    const wrapped = activeOnly(adapter, async () => false)
    expect(await wrapped.getSessionAndUser!('t1')).toBeNull()
    expect(deleteSession).toHaveBeenCalledWith('t1')
  })

  it('does not consult the user table when there is no session', async () => {
    const { adapter } = fake()
    const isActive = vi.fn(async () => true)
    expect(await activeOnly(adapter, isActive).getSessionAndUser!('nope')).toBeNull()
    expect(isActive).not.toHaveBeenCalled()
  })

  it('keeps every other adapter method', async () => {
    const { adapter } = fake()
    expect(activeOnly(adapter, async () => true).deleteSession).toBe(adapter.deleteSession)
  })
})
