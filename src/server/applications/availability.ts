import { formatDate } from '@/lib/dates'

const IST_OFFSET_MS = 330 * 60_000
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:00|12):00:00(?:\.000)?Z)?$/

/**
 * The instant applications stop. A date chosen in the CMS carries no time of day of its own: it arrives as
 * a bare date, as midnight UTC, or as the 12:00 UTC a day-only picker stores. Read literally, a deadline of
 * "30 November" would close at 05:30 or 17:30 India time that day. People read it as "until the end of
 * 30 November", so a date-only value runs to 23:59:59.999 India time. A deadline given with a real time of
 * day (17:00 IST, say) is honoured exactly.
 */
export function deadlineInstant(raw: string): Date {
  const dayOnly = DAY_ONLY.exec(raw)
  if (!dayOnly) return new Date(raw)
  const [, y, m, d] = dayOnly
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999) - IST_OFFSET_MS)
}

/**
 * The one place that decides whether a program is taking applications. Starting,
 * saving an answer, attaching a document, submitting and the /apply page all
 * ask here, so a person is told about a closed program when they open their
 * draft, not after they have written every answer (KN-31).
 *
 * Returns the sentence to show, or null when applications are open.
 */
export function closedReason(
  program: { applicationStatus: string; applicationDeadline?: string | null },
  now: Date = new Date(),
): string | null {
  if (program.applicationStatus !== 'open') {
    return 'Applications for this program aren’t open right now.'
  }
  if (program.applicationDeadline && deadlineInstant(program.applicationDeadline) < now) {
    return `Applications for this program closed on ${formatDate(program.applicationDeadline)}.`
  }
  return null
}
