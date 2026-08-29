import { StatusDot, Tag } from './tag'
import type { StatusTone } from './tag'

/**
 * A generic {label, tone, sub?} lookup renderer, in the two visual shapes
 * that already existed independently as ProgramStatusBadge (a compact pill —
 * right for a dense card) and ApplicationStatusBadge (dot + label + sub-line
 * — right where the status is the focus of the row). Both were hand-written
 * Record<string, {label, tone}> lookup tables with the same shape; this is
 * the third status-bearing entity's worth of reason (events, next) to share
 * the lookup-and-render logic while keeping both visual treatments available
 * by name rather than collapsing them into one wrong-for-somewhere shape.
 */
export function StatusBadge<Status extends string>({
  status,
  config,
  variant = 'dot',
}: {
  status: Status
  config: Record<Status, { label: string; tone: StatusTone; sub?: string }>
  variant?: 'dot' | 'pill'
}) {
  const info = config[status]

  if (variant === 'pill') {
    return <Tag tone={info.tone}>{info.label}</Tag>
  }

  return (
    <div>
      <StatusDot tone={info.tone} label={info.label} />
      {info.sub && <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{info.sub}</p>}
    </div>
  )
}
