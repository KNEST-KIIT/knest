
import { cn } from '@/lib/cn'

/**
 * A table that collapses to a card list under the sm breakpoint, per the
 * mobile rule UX_WIREFRAMES.md §8 already states ("mobile becomes cards, not
 * a horizontally scrolling table") — a rule the Phase 6 staff applications
 * queue didn't follow because no primitive existed to make following it the
 * easy path. `columns` renders the desktop table; `renderCard` renders the
 * same row as a card on mobile, so the two never drift out of sync with each
 * other the way two hand-written layouts could.
 */

export type Column<T> = {
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
}

export function Table<T>({
  rows,
  columns,
  renderCard,
  rowKey,
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  renderCard: (row: T) => React.ReactNode
  rowKey: (row: T) => string
  className?: string
}) {
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white sm:block">
        <table className="w-full text-left text-[length:var(--text-small)]">
          <thead className="border-b border-[var(--color-line)] text-[var(--color-ink-muted)]">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-3 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-[var(--color-line)] last:border-b-0">
                {columns.map((col) => (
                  <td key={col.header} className={cn('px-4 py-3', col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
            {renderCard(row)}
          </div>
        ))}
      </div>
    </div>
  )
}
