import type { labBookingStatus } from '@/db/schema'

type Status = (typeof labBookingStatus.enumValues)[number]

/**
 * The only legal moves for a lab booking.
 *
 * Two things make this shape differ from the level-request machine next door.
 *
 * `approved -> cancelled` exists because a booking is a claim on a room in the
 * future, and plans change on both sides: a founder who no longer needs
 * Thursday should be able to give the slot back, and a manager whose lab is
 * shut for maintenance needs to be able to take it back. Without that edge the
 * only way to free an approved slot would be to delete the row, which loses the
 * record that it was ever held.
 *
 * There is no `approved -> rejected`. Reversing a decision and cancelling a
 * booking are different events to the person holding it, and collapsing them
 * would make "rejected" mean two things in the same column.
 *
 * Who may make a move is a function of which module you can reach, not of this
 * table: `requested -> approved | rejected` is the space's managers
 * (review.ts), and cancellation belongs to the founder or those same managers
 * (actions.ts).
 */
const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['cancelled'],
  rejected: [],
  cancelled: [],
}

export function isLegalTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from]
}

/** The subset a lab manager may choose as a decision. Cancelling is not a decision. */
export function managerDecisions(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from].filter((status) => status !== 'cancelled')
}

/** A booking in one of these states is holding the room. */
export function holdsTheRoom(status: Status): boolean {
  return status === 'approved'
}
