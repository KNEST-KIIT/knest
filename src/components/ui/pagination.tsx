import Link from 'next/link'
import type { PageInfo } from '@/lib/pagination'

/**
 * Previous / next links for a server-rendered list. `hrefFor` builds the URL for a page number and
 * keeps the filters, so paging never drops a search. Renders nothing for a single page.
 */
export function Pagination({ info, hrefFor }: { info: PageInfo; hrefFor: (page: number) => string }) {
  if (info.pages <= 1) {
    return info.total > 0 ? (
      <p className="mt-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{info.total} in total</p>
    ) : null
  }
  const link = 'rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-4 py-2 text-[length:var(--text-small)] font-medium'
  const off = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] px-4 py-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]'
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4">
      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        Showing {info.from}–{info.to} of {info.total}
      </p>
      <div className="flex gap-2">
        {info.page > 1 ? (
          <Link href={hrefFor(info.page - 1)} rel="prev" className={link}>
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={off}>
            Previous
          </span>
        )}
        {info.page < info.pages ? (
          <Link href={hrefFor(info.page + 1)} rel="next" className={link}>
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={off}>
            Next
          </span>
        )}
      </div>
    </nav>
  )
}
