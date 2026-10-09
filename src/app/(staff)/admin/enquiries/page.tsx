import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading } from '@/components/ui'
import { Pagination } from '@/components/ui/pagination'
import { formatEventTime } from '@/lib/dates'
import { pageInfo, parsePage } from '@/lib/pagination'
import { requireAdminArea } from '@/server/auth/guards'
import { listEnquiries } from '@/server/enquiries/actions'
import { ENQUIRY_TOPICS } from '@/server/enquiries/validation'
import { MarkHandled } from './mark-handled'

export const metadata: Metadata = { title: 'Enquiries — Admin' }
export const dynamic = 'force-dynamic'

const TOPIC_LABELS = Object.fromEntries(ENQUIRY_TOPICS.map((t) => [t.value, t.label]))

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminArea('enquiries')
  const params = await searchParams
  const status = params.status === 'new' || params.status === 'handled' ? params.status : undefined
  const result = await listEnquiries({ status, page: parsePage(params.page) })
  const info = pageInfo(result.total, result.page, result.pageSize)
  const hrefFor = (page: number) => {
    const next = new URLSearchParams()
    if (status) next.set('status', status)
    if (page > 1) next.set('page', String(page))
    return `/admin/enquiries${next.toString() ? `?${next}` : ''}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Enquiries
      </Heading>
      <nav aria-label="Filter" className="mt-4 flex gap-4 text-[length:var(--text-small)]">
        <Link href="/admin/enquiries" aria-current={!status ? 'page' : undefined} className={!status ? 'font-bold underline' : ''}>
          All
        </Link>
        <Link href="/admin/enquiries?status=new" aria-current={status === 'new' ? 'page' : undefined} className={status === 'new' ? 'font-bold underline' : ''}>
          New
        </Link>
        <Link href="/admin/enquiries?status=handled" aria-current={status === 'handled' ? 'page' : undefined} className={status === 'handled' ? 'font-bold underline' : ''}>
          Handled
        </Link>
      </nav>

      {result.rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState heading="No enquiries here" body="Messages sent through the contact form appear here." size="compact" />
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {result.rows.map((e) => (
              <li key={e.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-[length:var(--text-small)]">
                      <a href={`mailto:${e.email}`} className="text-[var(--color-signal)] underline">
                        {e.email}
                      </a>{' '}
                      · {TOPIC_LABELS[e.topic] ?? e.topic} · {formatEventTime(e.createdAt)}
                      {e.userId ? ' · signed-in member' : ''}
                    </p>
                  </div>
                  {e.status === 'new' ? (
                    <MarkHandled id={e.id} />
                  ) : (
                    <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Handled{e.handledAt ? ` ${formatEventTime(e.handledAt)}` : ''}</span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[var(--color-ink-soft)]">{e.message}</p>
              </li>
            ))}
          </ul>
          <Pagination info={info} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
