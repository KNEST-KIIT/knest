/**
 * CONTENT_SPEC.md §11: dates render as "12 March 2026"; anything under 7 days
 * away also gets a relative form, and deadlines always carry both — an
 * applicant needs the absolute date to plan and the relative one to feel the
 * urgency.
 */

const ABSOLUTE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatDate(date: Date | string): string {
  return ABSOLUTE.format(new Date(date))
}

export function formatRelativeIfSoon(date: Date | string): string | null {
  const target = new Date(date).getTime()
  const diffMs = target - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < -1 || diffDays > 7) return null
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays === -1) return 'yesterday'
  if (diffDays > 1) return `in ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}

export function formatDeadline(date: Date | string): string {
  const relative = formatRelativeIfSoon(date)
  return relative ? `${formatDate(date)} — ${relative}` : formatDate(date)
}

const DATETIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatEventTime(date: Date | string): string {
  return DATETIME.format(new Date(date))
}
