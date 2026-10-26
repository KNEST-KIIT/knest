import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock db and dependencies
vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}))

vi.mock('./session', () => ({
  createDatabaseSession: vi.fn(),
  destroyDatabaseSession: vi.fn(),
}))

vi.mock('./tokens', () => ({
  issueToken: vi.fn(),
  consumeToken: vi.fn(),
}))

vi.mock('@/server/email', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/server/telemetry/events', () => ({
  track: vi.fn(),
}))

import { ActivationError, confirmEmailVerification } from './actions'

describe('confirmEmailVerification (QA-004 unit tests)', () => {
  it('rejects invalid email formats early', async () => {
    const res = await confirmEmailVerification('not-an-email', 'valid-token-12345', 'ValidPassword123!')
    expect(res).toEqual({ ok: false, error: 'That link is invalid.' })
  })

  it('rejects empty tokens early', async () => {
    const res = await confirmEmailVerification('user@example.com', '', 'ValidPassword123!')
    expect(res).toEqual({ ok: false, error: 'That link is invalid.' })
  })

  it('rejects passwords under 12 characters early without touching DB', async () => {
    const res = await confirmEmailVerification('user@example.com', 'valid-token-12345', 'Short1!')
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('Use at least 12 characters.')
    }
  })

  it('ActivationError retains custom message and name', () => {
    const err = new ActivationError('Custom activation error')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ActivationError')
    expect(err.message).toBe('Custom activation error')
  })
})
