import { formatDate } from '@/lib/dates'

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
  if (program.applicationDeadline && new Date(program.applicationDeadline) < now) {
    return `Applications for this program closed on ${formatDate(program.applicationDeadline)}.`
  }
  return null
}
