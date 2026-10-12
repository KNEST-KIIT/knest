/**
 * Reconciles recorded events against the tables that own the same outcome (KN-32, module 35).
 *
 * Events are best-effort: a blocked request or a script that never ran loses one, and events
 * that predate tracking were never written. The tables are the truth. The two are compared
 * here so a gap is stated in words rather than left for a reader to notice.
 */

export type ReconciliationRow = {
  event: string
  /** Rows in analytics_events. */
  recorded: number
  /** Rows in the table that owns the outcome. */
  records: number
  /** recorded minus records. */
  difference: number
  state: 'match' | 'events-missing' | 'records-removed'
  /** One sentence for the dashboard. */
  note: string
}

export function reconcileFunnel(
  recorded: Record<string, number>,
  records: Record<string, number>,
): ReconciliationRow[] {
  return Object.keys(records)
    .sort()
    .map((event) => {
      const r = recorded[event] ?? 0
      const t = records[event] ?? 0
      const difference = r - t
      if (difference === 0) {
        return { event, recorded: r, records: t, difference, state: 'match', note: 'Events and records agree.' }
      }
      if (difference < 0) {
        return {
          event,
          recorded: r,
          records: t,
          difference,
          state: 'events-missing',
          note: `${-difference} fewer events than records. Some happened before tracking began or an event was not delivered; trust the records.`,
        }
      }
      return {
        event,
        recorded: r,
        records: t,
        difference,
        state: 'records-removed',
        note: `${difference} more events than records. Something was removed after it was counted, such as an event registration that was cancelled.`,
      }
    })
}
