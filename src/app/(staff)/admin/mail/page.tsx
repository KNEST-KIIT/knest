import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading } from '@/components/ui'
import { Pagination } from '@/components/ui/pagination'
import { formatEventTime } from '@/lib/dates'
import { pageInfo, parsePage } from '@/lib/pagination'
import { listOutbox, type MailFilter } from '@/server/email/admin'
import { ResendButton } from './resend-button'

export const metadata: Metadata = { title: 'Mail — Admin' }
export const dynamic = 'force-dynamic'

const FILTERS: { value: MailFilter; label: string }[] = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'pending', label: 'Waiting to send' },
  { value: 'sent', label: 'Sent' },
  { value: 'all', label: 'All' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting to send',
  sent: 'Sent',
  dead: 'Failed after every attempt',
  expired: 'Expired before it could be sent',
}

export default async function MailPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const params = await searchParams
  const filter = FILTERS.find((f) => f.value === params.filter)?.value ?? 'attention'
  const result = await listOutbox({ filter, page: parsePage(params.page) })
  const info = pageInfo(result.total, result.page, result.pageSize)
  const hrefFor = (page: number) => {
    const next = new URLSearchParams()
    if (filter !== 'attention') next.set('filter', filter)
    if (page > 1) next.set('page', String(page))
    return `/admin/mail${next.toString() ? `?${next}` : ''}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Mail
      </Heading>
      <p className="mt-2 max-w-[65ch] text-[var(--color-ink-soft)]">
        Verification, reset and notification emails. A message that fails is retried automatically; one that runs out of
        attempts is listed here to resend once the cause is fixed. Message content is shown nowhere.
      </p>
      <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        {result.byStatus.pending ?? 0} waiting, {result.byStatus.sent ?? 0} sent, {result.byStatus.dead ?? 0} failed,{' '}
        {result.byStatus.expired ?? 0} expired.
      </p>

      <nav aria-label="Filter" className="mt-4 flex flex-wrap gap-4 text-[length:var(--text-small)]">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'attention' ? '/admin/mail' : `/admin/mail?filter=${f.value}`}
            aria-current={filter === f.value ? 'page' : undefined}
            className={filter === f.value ? 'font-bold underline' : ''}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {result.rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            heading={filter === 'attention' ? 'Nothing needs attention' : 'No messages here'}
            body={filter === 'attention' ? 'Every message has been sent or is still being retried.' : 'Messages appear here as the site sends them.'}
            size="compact"
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {result.rows.map((m) => (
              <li key={m.id} className="min-w-0 [overflow-wrap:anywhere] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{m.subject}</p>
                    <p className="text-[length:var(--text-small)] text-[var(--color-ink-soft)]">To {m.toAddress}</p>
                  </div>
                  <p className="text-[length:var(--text-small)] font-medium">{STATUS_LABEL[m.status] ?? m.status}</p>
                </div>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  Queued {formatEventTime(m.createdAt)}
                  {m.sentAt ? `, sent ${formatEventTime(m.sentAt)}` : ''}. {m.attempts} failed {m.attempts === 1 ? 'attempt' : 'attempts'}.
                </p>
                {m.lastError && (
                  <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Last error: {m.lastError}</p>
                )}
                {(m.status === 'dead' || m.status === 'expired') && (
                  <div className="mt-3">
                    {m.resendable ? (
                      <ResendButton id={m.id} />
                    ) : (
                      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                        Content removed, so this cannot be resent. Ask the person to request a new link.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination info={info} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
