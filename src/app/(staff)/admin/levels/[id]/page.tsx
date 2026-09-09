import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, Heading, StatusBadge } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { LEVEL_REQUEST_STATUS } from '@/lib/status-config'
import { levelDefinition } from '@/server/founders/levels'
import { getLevelRequestForReview } from '@/server/founders/review'
import { staffDecisions } from '@/server/founders/transitions'
import { DecisionForm } from './decision-form'

export const metadata: Metadata = { title: 'Level request — Admin' }

export default async function LevelRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const request = await getLevelRequestForReview(id)
  if (!request) notFound()

  const current = levelDefinition(request.user?.founderLevel ?? 1)
  const asked = levelDefinition(request.requestedLevel)
  const open = staffDecisions(request.status).length > 0

  return (
    <div>
      <Link href="/admin/levels" className="inline-flex h-11 items-center text-[length:var(--text-small)] underline underline-offset-4">
        ← All level requests
      </Link>

      <Heading as="h1" size="title" className="mt-4">
        {request.user?.name ?? request.user?.email ?? 'Unknown founder'}
      </Heading>
      {/* `level_requests` stores what was asked for, not what they were at when
          they asked. So an arrow is only truthful while the request is open —
          once decided, `current` has moved and "level 3 → level 3" is what you
          get. After a decision, state the two facts separately instead. */}
      <p className="mt-2 text-[var(--color-ink-soft)]">
        {open ? (
          <>
            Level {current.level} ({current.label}) → level {asked.level} ({asked.label})
          </>
        ) : (
          <>
            Asked for level {asked.level} ({asked.label}) · now at level {current.level} ({current.label})
          </>
        )}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Heading as="h2" size="heading">
            Their case
          </Heading>
          {/* The founder's own words, kept after the decision — the next
              reviewer's first question is always what the last one was shown. */}
          <p className="mt-4 max-w-[68ch] whitespace-pre-wrap text-[var(--color-ink-soft)]">
            {request.evidence}
          </p>

          <dl className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                Says they are
              </dt>
              <dd className="mt-1">{request.user?.journeyStage ?? 'Not said'}</dd>
            </div>
            <div>
              <dt className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                Asked
              </dt>
              <dd className="mt-1">{formatDate(request.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <aside>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <Heading as="h2" size="heading">
                Decision
              </Heading>
              <StatusBadge status={request.status} config={LEVEL_REQUEST_STATUS} />
            </div>

            <div className="mt-4">
              {open ? (
                <DecisionForm requestId={request.id} />
              ) : (
                <>
                  <p className="text-[var(--color-ink-soft)]">This request has been decided.</p>
                  {request.decisionNote && (
                    <p className="mt-3 whitespace-pre-wrap text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                      {request.decisionNote}
                    </p>
                  )}
                  {request.decidedAt && (
                    <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      {formatDate(request.decidedAt)}
                    </p>
                  )}
                </>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
