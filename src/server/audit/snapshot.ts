/** A short, readable summary of a before/after snapshot: "status: submitted, note: ...". Long values are cut. */
export function summariseSnapshot(value: unknown, maxLength = 120): string {
  if (value === null || value === undefined) return '—'
  if (typeof value !== 'object') return String(value).slice(0, maxLength)
  const text = Object.entries(value as Record<string, unknown>)
    .map(([key, v]) => `${key}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(', ')
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text || '—'
}
