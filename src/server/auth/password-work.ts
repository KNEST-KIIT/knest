import { compare, hash } from 'bcryptjs'

/**
 * bcrypt at cost 12 is about half a second of CPU, and `bcryptjs` is plain JavaScript, so it runs on the same
 * thread that answers every request. Measured here: ten comparisons started together kept the event loop busy
 * for about seven seconds and gave it 6 turns where about 560 were due; sixty took the whole site offline for
 * longer than 30 seconds. A class of students signing in at the same time is enough.
 *
 * So password work goes through a gate: one at a time, a bounded line behind it, and anything past the line is
 * refused at once with PasswordBusyError (callers answer 503, "try again in a moment"). One at a time keeps the
 * thread free between the short slices bcryptjs works in, so pages and the health check stay responsive while
 * sign-ins queue.
 */

export class PasswordBusyError extends Error {
  constructor() {
    super('Too many sign-ins are being processed')
    this.name = 'PasswordBusyError'
  }
}

export const MAX_RUNNING = 1
/** About ten seconds of waiting at one comparison per half second. Past that a person is better told to retry than left staring at a spinner. */
export const MAX_WAITING = 20

let running = 0
const waiting: Array<() => void> = []

/** Runs `task` when a slot is free; refuses straight away when the line is already full. */
export async function withPasswordSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running < MAX_RUNNING) {
    running++
  } else {
    if (waiting.length >= MAX_WAITING) throw new PasswordBusyError()
    // The slot is handed over by whoever finishes, so `running` stays as it is.
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  try {
    return await task()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else running--
  }
}

/** True when a new password check would be refused. Routes ask this first so the refusal costs nothing: no human-check token is spent and nothing is counted against the person. */
export function passwordGateFull(): boolean {
  return running >= MAX_RUNNING && waiting.length >= MAX_WAITING
}

export function gateState() {
  return { running, waiting: waiting.length }
}

export const comparePassword = (password: string, hashed: string): Promise<boolean> => withPasswordSlot(() => compare(password, hashed))

export const hashPassword = (password: string, rounds = 12): Promise<string> => withPasswordSlot(() => hash(password, rounds))
