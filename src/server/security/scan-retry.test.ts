import { describe, expect, it } from 'vitest'
import {
  MAX_RETRY_DELAY_SECONDS,
  nextRetryDelaySeconds,
  PROMOTION_GRACE_MS,
  receivesWithin,
  RECEIVES_NEEDED,
  RETRY_HINT_SECONDS,
  TAG_GRACE_MS,
  UNKNOWN_OBJECT_GRACE_MS,
} from './scan-retry'

describe('retry delay', () => {
  it('uses the processor’s own delay on the first try and doubles it on every try after that', () => {
    expect([1, 2, 3, 4].map((n) => nextRetryDelaySeconds(30, n))).toEqual([30, 60, 120, 240])
    expect([1, 2, 3, 4].map((n) => nextRetryDelaySeconds(60, n))).toEqual([60, 120, 240, 480])
  })

  it('never makes a message wait longer than the cap, however many tries there have been', () => {
    expect(MAX_RETRY_DELAY_SECONDS).toBe(600)
    for (const hint of [30, 60, 300]) {
      for (const tries of [5, 10, 50, 1000]) expect(nextRetryDelaySeconds(hint, tries)).toBeLessThanOrEqual(MAX_RETRY_DELAY_SECONDS)
    }
    expect(nextRetryDelaySeconds(300, 2)).toBe(600)
  })

  it('treats a missing, zero or nonsensical receive count as a first try', () => {
    for (const count of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, 1.9]) expect(nextRetryDelaySeconds(45, count)).toBe(45)
  })

  it('never asks for less than the hint, and never for less than one second', () => {
    expect(nextRetryDelaySeconds(30, 1)).toBe(30)
    expect(nextRetryDelaySeconds(0, 4)).toBe(1)
    expect(nextRetryDelaySeconds(-5, 1)).toBe(1)
  })
})

describe('how many times a message is received while it waits', () => {
  it('counts the receive that makes the decision, which is the first one past the deadline', () => {
    // Tries at 0, 30, 90, 210 and 450 seconds; the fifth is the first past five minutes.
    expect(receivesWithin(300_000, 30)).toBe(5)
    expect(receivesWithin(0, 30)).toBe(1)
  })

  it('matches the worked examples for the three waits the processor grants', () => {
    expect(receivesWithin(UNKNOWN_OBJECT_GRACE_MS, RETRY_HINT_SECONDS.waiting)).toBe(5)
    expect(receivesWithin(TAG_GRACE_MS, RETRY_HINT_SECONDS.waiting)).toBe(7)
    expect(receivesWithin(PROMOTION_GRACE_MS, RETRY_HINT_SECONDS.storage)).toBe(10)
  })

  it('has one number the queue must allow for: the most receives any grace period can use', () => {
    expect(RECEIVES_NEEDED).toBe(
      Math.max(
        receivesWithin(UNKNOWN_OBJECT_GRACE_MS, RETRY_HINT_SECONDS.waiting),
        receivesWithin(TAG_GRACE_MS, RETRY_HINT_SECONDS.waiting),
        receivesWithin(PROMOTION_GRACE_MS, RETRY_HINT_SECONDS.storage),
      ),
    )
  })

  it('stretches a 30-second retry so that eight receives take over half an hour, where a flat retry would take under four minutes', () => {
    // The gaps between eight receives are seven waits: 30 + 60 + 120 + 240 + 480 + 600 + 600 seconds.
    let elapsed = 0
    for (let receive = 1; receive < 8; receive += 1) elapsed += nextRetryDelaySeconds(30, receive)
    expect(elapsed).toBe(2130)
    expect(elapsed).toBeGreaterThan(7 * 30 * 5) // five times what a flat 30-second retry would span
  })
})

describe('the waits themselves', () => {
  it('give a verdict whose row is not visible yet minutes, not a quarter of an hour', () => {
    // The upload writes the object and then commits its row within the same request, so the gap is seconds. A long wait
    // for an object the app no longer tracks (a replaced or removed upload) only keeps a stale message alive.
    expect(UNKNOWN_OBJECT_GRACE_MS).toBe(5 * 60_000)
  })

  it('keep their order: a missing row is given up on first, then a missing tag, then a copy that keeps failing', () => {
    expect(UNKNOWN_OBJECT_GRACE_MS).toBeLessThan(TAG_GRACE_MS)
    expect(TAG_GRACE_MS).toBeLessThan(PROMOTION_GRACE_MS)
  })

  it('all end before the dead-letter queue could take the message, by construction of the template (see infra/cfn/malware-protection.test.ts)', () => {
    expect(RECEIVES_NEEDED).toBeLessThanOrEqual(10)
  })
})
