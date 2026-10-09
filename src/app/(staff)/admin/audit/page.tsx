import type { Metadata } from 'next'
import { EmptyState, Heading } from '@/components/ui'
import { Pagination } from '@/components/ui/pagination'
import { formatEventTime } from '@/lib/dates'
import { pageInfo, parsePage } from '@/lib/pagination'
import { AUDIT_PAGE_SIZE, listAuditFacets, listAuditLogs } from '@/server/audit/queries'
import { summariseSnapshot } from '@/server/audit/snapshot'

export const metadata: Metadata = { title: 'Audit trail — Admin' }
export const dynamic = 'force-dynamic'

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; page?: string }> }) {
  const params = await searchParams
  const facets = await listAuditFacets()
  // A filter value must be one on record, so the filter cannot be used to probe for anything else.
  const action = params.action && facets.actions.includes(params.action) ? params.action : undefined
  const entityType = params.entity && facets.entityTypes.includes(params.entity) ? params.entity : undefined
  const result = await listAuditLogs({ action, entityType, page: parsePage(params.page) })
  const info = pageInfo(result.total, result.page, AUDIT_PAGE_SIZE)

  const hrefFor = (page: number) => {
    const next = new URLSearchParams()
    if (action) next.set('action', action)
    if (entityType) next.set('entity', entityType)
    if (page > 1) next.set('page', String(page))
    return `/admin/audit${next.toString() ? `?${next}` : ''}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Audit trail
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">Every privileged action, who did it, and what changed. Entries cannot be edited here.</p>

      <form method="get" role="search" aria-label="Filter the audit trail" className="mt-6 flex flex-wrap gap-4">
        <label className="sr-only" htmlFor="action">
          Action
        </label>
        <select id="action" name="action" defaultValue={action ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3">
          <option value="">All actions</option>
          {facets.actions.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="entity">
          Record type
        </label>
        <select id="entity" name="entity" defaultValue={entityType ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3">
          <option value="">All record types</option>
          {facets.entityTypes.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white">
          Filter
        </button>
      </form>

      {result.rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState heading="Nothing recorded" body="Staff actions are listed here as they happen." size="compact" />
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {result.rows.map((row) => (
              <li key={row.id} className="min-w-0 [overflow-wrap:anywhere] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-[length:var(--text-small)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <strong>{row.action.replace(/_/g, ' ')}</strong> on {row.entityType} <code className="text-[var(--color-ink-muted)]">{row.entityId.slice(0, 8)}</code>
                  </p>
                  <p className="text-[var(--color-ink-muted)]">{formatEventTime(row.createdAt)}</p>
                </div>
                <p className="mt-1 text-[var(--color-ink-muted)]">By {row.actorName ? `${row.actorName} (${row.actorEmail})` : row.actorEmail}</p>
                <dl className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <dt className="text-[var(--color-ink-muted)]">Before</dt>
                  <dd>{summariseSnapshot(row.before)}</dd>
                  <dt className="text-[var(--color-ink-muted)]">After</dt>
                  <dd>{summariseSnapshot(row.after)}</dd>
                </dl>
              </li>
            ))}
          </ul>
          <Pagination info={info} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
