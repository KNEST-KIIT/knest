/**
 * How long the verdict worker keeps a message it cannot settle yet, and how that fits the queue's receive limit.
 *
 * The processor (scan-processor.ts) waits for three things that normally arrive within seconds: the document row that
 * a verdict refers to, the scan tag GuardDuty writes on the object, and a working copy into clean storage. Each wait has
 * a deadline measured from the moment the message was sent, after which the processor decides instead of waiting.
 *
 * Every wait is a retry, and every retry is another receive of the same SQS message. The queue moves a message to its
 * dead-letter queue, and raises an alarm, once it has been received more than `maxReceiveCount` times
 * (infra/cfn/app.yaml, ScanResultQueue). A flat 30-second retry would use up eight receives in about four minutes, so a
 * perfectly good verdict would be dead-lettered long before the processor's own twenty-minute deadline, and a routine
 * stale verdict (for an upload the applicant has since replaced) would page someone. The delay therefore doubles on each
 * try, capped at ten minutes, and the template's `maxReceiveCount` is checked against the number worked out here
 * (infra/cfn/malware-protection.test.ts), so the two cannot drift apart.
 *
 * Pure on purpose: no imports, so the worker, the processor and the infrastructure test can all use it.
 */

/** Minimum waits the processor asks for, by kind of problem. */
export const RETRY_HINT_SECONDS = {
  /** Something should appear shortly: the row, the scan tag. */
  waiting: 30,
  /** Storage is misbehaving. */
  storage: 60,
  /** The message itself is unusable (not JSON, wrong bucket). Nothing will fix it; let it reach the dead-letter queue and alarm. */
  unusable: 300,
} as const

/** A verdict for an object no row knows about is held this long, in case the row is still being committed. */
export const UNKNOWN_OBJECT_GRACE_MS = 5 * 60_000
/** A clean verdict whose scan tag has not appeared yet is held this long before it is treated as an error. */
export const TAG_GRACE_MS = 20 * 60_000
/** A clean verdict that cannot be promoted because S3 keeps failing is held this long before it is treated as an error. */
export const PROMOTION_GRACE_MS = 60 * 60_000

/** Longest wait between two tries of the same message. */
export const MAX_RETRY_DELAY_SECONDS = 600

/**
 * Seconds to hide a message before its next try. `hintSeconds` is what the processor asked for; the first try waits
 * exactly that, and each later try waits twice as long as the one before, up to MAX_RETRY_DELAY_SECONDS.
 * `receiveCount` is SQS's ApproximateReceiveCount for the receive being handled (1 on the first). Anything that is not
 * a finite number of at least one is treated as the first receive.
 */
export function nextRetryDelaySeconds(hintSeconds: number, receiveCount: number): number {
  const tries = Number.isFinite(receiveCount) && receiveCount >= 1 ? Math.trunc(receiveCount) : 1
  const delay = hintSeconds * 2 ** Math.min(tries - 1, 10)
  return Math.max(1, Math.min(MAX_RETRY_DELAY_SECONDS, delay))
}

/**
 * How many times a message is received before it has been held for `holdMs`, counting the receive that finally decides
 * (the first one at or past the deadline). The first receive is at time zero.
 */
export function receivesWithin(holdMs: number, hintSeconds: number): number {
  let elapsedMs = 0
  let receives = 1
  while (elapsedMs < holdMs) {
    elapsedMs += nextRetryDelaySeconds(hintSeconds, receives) * 1000
    receives += 1
  }
  return receives
}

/** The most receives any of the processor's waits can use. The queue's `maxReceiveCount` must exceed this with room to spare. */
export const RECEIVES_NEEDED = Math.max(
  receivesWithin(UNKNOWN_OBJECT_GRACE_MS, RETRY_HINT_SECONDS.waiting),
  receivesWithin(TAG_GRACE_MS, RETRY_HINT_SECONDS.waiting),
  receivesWithin(PROMOTION_GRACE_MS, RETRY_HINT_SECONDS.storage),
)
