import type { applicationStatus } from '@/db/schema'

type Status = (typeof applicationStatus.enumValues)[number]

/**
 * The only legal moves in the application lifecycle (spec §18/19). draft ->
 * submitted is applicant-triggered (src/server/applications/actions.ts,
 * submitApplication); every other edge is staff-triggered
 * (changeApplicationStatus). An application cannot jump from submitted
 * straight to accepted, or move backwards from a terminal state — checked
 * here rather than trusted to whoever calls the status-change function.
 */
const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'rejected'],
  under_review: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['accepted', 'rejected', 'waitlisted'],
  waitlisted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
}

export function isLegalTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from]
}
