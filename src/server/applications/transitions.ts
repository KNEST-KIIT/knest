import type { applicationStatus } from '@/db/schema'

export type Status = (typeof applicationStatus.enumValues)[number]

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
/**
 * The set of application statuses that staff can transition an application into.
 * Draft and submitted are intentionally excluded: draft is applicant work-in-progress,
 * and submitted is strictly applicant-triggered upon completing all required answers.
 */
export const STAFF_PERMITTED_STATUSES = [
  'under_review',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
  'waitlisted',
] as const

export type StaffStatus = (typeof STAFF_PERMITTED_STATUSES)[number]

export function isStaffStatus(status: unknown): status is StaffStatus {
  return typeof status === 'string' && (STAFF_PERMITTED_STATUSES as readonly string[]).includes(status)
}

export function isLegalTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Validates staff-triggered status changes.
 *
 * Staff cannot act on a draft application, move an application backwards into draft,
 * or trigger draft -> submitted (which is applicant-exclusive).
 */
export function isLegalStaffTransition(from: Status, to: Status): boolean {
  if (from === 'draft' || to === 'draft' || to === 'submitted') {
    return false
  }
  return isLegalTransition(from, to)
}

export function nextStatuses(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from] ?? []
}

