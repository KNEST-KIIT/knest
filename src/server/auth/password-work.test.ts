import { describe, expect, it } from 'vitest'
import { gateState, MAX_WAITING, PasswordBusyError, passwordGateFull, withPasswordSlot } from './password-work'

const gate = () => {
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  return { held, release }
}

describe('password work gate', () => {
  it('never runs more than one task at a time and finishes them all in order', async () => {
    let active = 0
    let peak = 0
    const order: number[] = []
    const task = (n: number) => async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push(n)
      active--
      return n
    }
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => withPasswordSlot(task(n))))
    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(order).toEqual([1, 2, 3, 4, 5])
    expect(peak).toBe(1)
    expect(gateState()).toEqual({ running: 0, waiting: 0 })
  })

  it('refuses at once, rather than queueing without limit, when the line is full', async () => {
    const first = gate()
    const running = withPasswordSlot(() => first.held)
    const line = Array.from({ length: MAX_WAITING }, () => withPasswordSlot(async () => 'ok'))
    expect(passwordGateFull()).toBe(true)
    await expect(withPasswordSlot(async () => 'one too many')).rejects.toBeInstanceOf(PasswordBusyError)

    first.release()
    await running
    expect(await Promise.all(line)).toHaveLength(MAX_WAITING)
    expect(gateState()).toEqual({ running: 0, waiting: 0 })
    expect(passwordGateFull()).toBe(false)
  })

  it('frees the slot when a task throws', async () => {
    await expect(withPasswordSlot(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(await withPasswordSlot(async () => 'next')).toBe('next')
    expect(gateState()).toEqual({ running: 0, waiting: 0 })
  })
})
