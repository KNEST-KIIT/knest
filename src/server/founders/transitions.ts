import type { levelRequestStatus } from '@/db/schema'

type Status = (typeof levelRequestStatus.enumValues)[number]

/**
 * The only legal moves for a level request.
 *
 * `pending -> withdrawn` is the founder's own (src/server/founders/actions.ts,
 * withdrawLevelRequest); `pending -> approved | rejected` is staff's
 * (src/server/founders/review.ts, decideLevelRequest). As with applications,
 * who may trigger an edge is a function of which module you can reach, not a
 * column in this table — the table only says which moves exist at all.
 *
 * Every end state is terminal. A rejected request is not reopened and argued
 * over; the founder opens a new one with better evidence, which keeps the
 * queue depth honest and gives each decision a fixed thing it was made about.
 */
const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  pending: ['approved', 'rejected', 'withdrawn'],
  approved: [],
  rejected: [],
  withdrawn: [],
}

export function isLegalTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from]
}

/** The subset a staff reviewer may choose. `withdrawn` belongs to the founder alone. */
export function staffDecisions(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from].filter((status) => status !== 'withdrawn')
}
