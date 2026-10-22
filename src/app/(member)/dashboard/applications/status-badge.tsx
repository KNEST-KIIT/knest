import { StatusBadge } from '@/components/ui'
import type { StatusTone } from '@/components/ui'

/** CONTENT_SPEC.md §5 — every status carries its sub-line, since a bare label leaves the applicant guessing what it implies. */
const CONFIG: Record<string, { label: string; sub: string; tone: StatusTone }> = {
  draft: { label: 'Draft', sub: 'Not submitted yet — pick up where you left off.', tone: 'neutral' },
  submitted: { label: 'Submitted', sub: 'Your application is with the team. We will notify you when its status changes.', tone: 'signal' },
  under_review: { label: 'Under review', sub: 'Someone is reading your application now.', tone: 'signal' },
  shortlisted: { label: 'Shortlisted', sub: "You're through the first round.", tone: 'positive' },
  interview: { label: 'Interview', sub: 'The team would like to talk and will contact you to arrange the next step.', tone: 'caution' },
  accepted: { label: 'Accepted', sub: "You're in. Welcome to the program.", tone: 'positive' },
  waitlisted: { label: 'Waitlisted', sub: "Not a no. We'll be in touch if a place opens.", tone: 'caution' },
  // The person is not rejected; this application was — never labelled "Rejected".
  rejected: { label: 'Not this time', sub: 'Not this cohort — but not never. See what else fits.', tone: 'critical' },
}

export function ApplicationStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={CONFIG[status] ? status : 'draft'} config={CONFIG} />
}
