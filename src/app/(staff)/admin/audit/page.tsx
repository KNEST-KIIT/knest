import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading } from '@/components/ui'
import { listAuditActions, listAuditLog } from '@/server/members/audit'

export const metadata: Metadata = { title: 'Audit log — Admin' }

/** Turns a stored action key into something a person reads. */
function humanise(action: string): string {
  const words = action.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Where an entry's subject lives, when the console has a screen for it. */
function entityHref(entityType: string, entityId: string): string | null {
  if (entityType === 'user') return `/admin/members/${entityId}`
  if (entityType === 'application') return `/admin/applications/${entityId}`
  if (entityType === 'level_request') return `/admin/levels/${entityId}`
  return null
}

/**
 * The audit log, readable at last.
 *
 * `app.audit_logs` has been written on every staff decision since it was
 * added and read in exactly zero places; `audit_logs_entity_idx` was queried
 * by nothing. Every row here already existed. The only new thing is a screen.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; page?: string }>
}) {
  const params = await searchParams
  const [{ rows, page, hasMore }, actions] = await Promise.all([
    listAuditLog({
      action: params.action || undefined,
      entityType: params.entityType || undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    listAuditActions(),
  ])

  const pageHref = (next: number) => {
    const search = new URLSearchParams()
    if (params.action) search.set('action', params.action)
    if (params.entityType) search.set('entityType', params.entityType)
    search.set('page', String(next))
    return `/admin/audit?${search.toString()}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Audit log
      </Heading>
      <p className="mt-2 max-w-[64ch] text-[var(--color-ink-soft)]">
        Every staff decision of consequence, newest first: application outcomes, level grants,
        lab bookings, staff access, deactivations. Entries are never edited or removed.
      </p>

      <form method="get" className="mt-6 flex flex-wrap gap-4">
        <select
          name="action"
          aria-label="Filter by action"
          defaultValue={params.action ?? ''}
          className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
        >
          <option value="">Every action</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {humanise(action)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            heading="Nothing recorded"
            body="Staff decisions will appear here as they are made."
            size="compact"
          />
        </div>
      ) : (
        <ol className="mt-8 flex flex-col">
          {rows.map(({ entry, actor }) => {
            const href = entityHref(entry.entityType, entry.entityId)
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[var(--color-line)] py-4"
              >
                <div>
                  <p className="font-medium">
                    {humanise(entry.action)}
                    <span className="ml-2 font-normal text-[var(--color-ink-muted)]">
                      {entry.entityType.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    by {actor?.name ?? actor?.email ?? 'an account since removed'}
                    {/* before → after, the two snapshots the row stores. Shown
                        raw rather than prettified per action: a log that
                        paraphrases is a log you cannot trust. */}
                    {entry.before || entry.after ? (
                      <>
                        {' · '}
                        <code className="text-[length:var(--text-micro)]">
                          {JSON.stringify(entry.before)} → {JSON.stringify(entry.after)}
                        </code>
                      </>
                    ) : null}
                  </p>
                </div>
                <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {entry.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
                  {href && (
                    <>
                      {' · '}
                      <Link href={href} className="underline underline-offset-4">
                        Open
                      </Link>
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ol>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Pages" className="mt-8 flex items-center gap-4">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="flex h-11 items-center underline underline-offset-4">
              Newer
            </Link>
          )}
          <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Page {page}</span>
          {hasMore && (
            <Link href={pageHref(page + 1)} className="flex h-11 items-center underline underline-offset-4">
              Older
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
