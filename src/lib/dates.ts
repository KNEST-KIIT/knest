/**
 * CONTENT_SPEC.md §11: dates render as "12 March 2026"; anything under 7 days
 * away also gets a relative form, and deadlines always carry both — an
 * applicant needs the absolute date to plan and the relative one to feel the
 * urgency.
 */

/**
 * Every date on the site is shown in India Standard Time. Pages render on the
 * server, whose clock zone is whatever the host uses (UTC on most hosts); an
 * unpinned formatter would show a 10 p.m. IST deadline as the previous day.
 */
export const SITE_TIME_ZONE = 'Asia/Kolkata'

const ABSOLUTE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: SITE_TIME_ZONE })
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: SITE_TIME_ZONE })
const MONTH_SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: SITE_TIME_ZONE })
const DAY_OF_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: SITE_TIME_ZONE })

/** "12 Mar 2026", for compact cards. */
export function formatDateShort(date: Date | string): string {
  return SHORT.format(new Date(date))
}

/** The month ("Mar") and day ("12") of a date in IST, for calendar tiles. */
export function monthAndDay(date: Date | string): { month: string; day: string } {
  const d = new Date(date)
  return { month: MONTH_SHORT.format(d), day: DAY_OF_MONTH.format(d) }
}

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

const DATETIME_PARTS = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: SITE_TIME_ZONE,
})

/**
 * "12 March, 14:30 IST". The zone is stated because visitors may be elsewhere.
 * Assembled from parts: the connector word between date and time ("at", ",")
 * differs between ICU versions, and the text should not depend on the host.
 */
export function formatEventTime(date: Date | string): string {
  const part = (type: string) => DATETIME_PARTS.formatToParts(new Date(date)).find((p) => p.type === type)?.value ?? ''
  return `${part('day')} ${part('month')}, ${part('hour')}:${part('minute')} IST`
}
