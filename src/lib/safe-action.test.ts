import { describe, expect, it } from 'vitest'
import { ACTION_FAILED, safely } from './safe-action'

describe('safely', () => {
  it('passes a result straight through, refusals included', async () => {
    expect(await safely(async () => ({ ok: true as const }))).toEqual({ ok: true })
    expect(await safely(async () => ({ ok: false as const, error: 'Registrations have closed.' }))).toEqual({ ok: false, error: 'Registrations have closed.' })
  })

  it('turns a thrown error into a failed result instead of leaving the form stuck', async () => {
    const result = await safely(async (): Promise<{ ok: boolean }> => {
      throw new Error('fetch failed')
    })
    expect(result).toEqual({ ok: false, error: ACTION_FAILED })
  })
})
