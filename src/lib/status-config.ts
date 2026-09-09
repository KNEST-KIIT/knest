import type { StatusTone } from '@/components/ui'

/**
 * Status vocabularies, in one place.
 *
 * The application statuses were already written out three times — the enum,
 * `STATUS_LABELS` on the admin list, and `LABELS` in the status form — which is
 * how "Not this time" and "rejected" ended up on screen in the same session.
 * Levels and lab bookings would have made it five and seven. `FilterBar` was
 * extracted for exactly this reason after being hand-copied across four pages
 * (PHASE-7-9-RETROSPECTIVE.md §2); this is the same move for status copy.
 *
 * Shaped for `StatusBadge`'s `config` prop so a screen can pass one of these
 * straight through.
 */
type Config<K extends string> = Record<K, { label: string; tone: StatusTone; sub?: string }>

export const APPLICATION_STATUS: Config<
  | 'draft' | 'submitted' | 'under_review' | 'shortlisted'
  | 'interview' | 'accepted' | 'rejected' | 'waitlisted'
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'signal' },
  under_review: { label: 'Under review', tone: 'signal' },
  shortlisted: { label: 'Shortlisted', tone: 'signal' },
  interview: { label: 'Interview', tone: 'signal' },
  accepted: { label: 'Accepted', tone: 'positive' },
  // Never "Rejected" to the applicant — CONTENT_SPEC.md §7's wording.
  rejected: { label: 'Not this time', tone: 'critical' },
  waitlisted: { label: 'Waitlisted', tone: 'caution' },
}

export const LEVEL_REQUEST_STATUS: Config<'pending' | 'approved' | 'rejected' | 'withdrawn'> = {
  pending: { label: 'Waiting on us', tone: 'signal' },
  approved: { label: 'Approved', tone: 'positive' },
  rejected: { label: 'Not yet', tone: 'caution' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
}

export const LAB_BOOKING_STATUS: Config<'requested' | 'approved' | 'rejected' | 'cancelled'> = {
  requested: { label: 'Waiting on the lab', tone: 'signal' },
  approved: { label: 'Confirmed', tone: 'positive' },
  rejected: { label: 'Declined', tone: 'caution' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}
