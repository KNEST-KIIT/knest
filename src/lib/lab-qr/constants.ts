/**
 * Constants of the lab attendance QR protocol (modules 30 and 31).
 *
 * Every value here is a PROPOSED default from docs/delivery/LAB-ATTENDANCE-THREAT-MODEL.md. None is
 * an approved policy; they are exported so a test can pin them and a reviewer can read them in one
 * place. The assurance level is RECORD ATTENDANCE: nothing in this protocol opens a door.
 */

/** Token version prefix. A change of wire format changes this and old tokens stop verifying. */
export const TOKEN_PREFIX = 'K1'

/** One pass or challenge is valid for one time step (threat model T1). */
export const STEP_SECONDS = 30
export const STEP_MS = STEP_SECONDS * 1000

/**
 * A verifier compares the token's step with the step of its own clock and accepts a difference of at
 * most this many steps either way. One step each way tolerates about a minute of drift between the
 * two phones at the cost of a window of up to 90 s in which a photo of a code still works.
 */
export const STEP_TOLERANCE = 1

/** A client clock more than this far from the server at sync sends the event to head review (T5). */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

/** An event that reaches the server later than this after it was scanned goes to head review (T5). */
export const MAX_SYNC_DELAY_MS = 24 * 60 * 60 * 1000

/** An event this far in the future, after skew correction, goes to head review. */
export const MAX_FUTURE_MS = 60 * 1000

/** A scan counts only inside the booking slot, widened by these grace periods. */
export const EARLY_GRACE_MS = 15 * 60 * 1000
export const LATE_GRACE_MS = 15 * 60 * 1000

/** The two directions of one exchange must happen within this window to count as one check. */
export const PAIR_WINDOW_MS = 2 * 60 * 1000

/** Roster cache on an assistant device: only the next day, wiped on logout (T10). */
export const ROSTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Unsynced items older than this raise a warning on the scanning device (T6). */
export const UNSYNCED_WARN_MS = 60 * 60 * 1000

/** Largest token or batch the server will parse. */
export const MAX_TOKEN_LENGTH = 2048
export const MAX_BATCH_EVENTS = 50

export type Action = 'in' | 'out'
export type Side = 'staff' | 'student'
