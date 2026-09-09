import type { Metadata } from 'next'
import { Card, EmptyState, Heading, Section, StatusBadge } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { LEVEL_REQUEST_STATUS } from '@/lib/status-config'
import { requireOnboardedUser } from '@/server/auth/guards'
import {
  FOUNDER_LEVELS,
  capabilityLabel,
  levelDefinition,
  nextLevel,
} from '@/server/founders/levels'
import { getOpenLevelRequest, listLevelRequestsForUser } from '@/server/founders/actions'
import { RequestForm } from './request-form'

export const metadata: Metadata = { title: 'Your level' }

/**
 * The ladder, and the only place a founder can ask to move up it.
 *
 * The screen's job is to make the distinction the whole system rests on legible
 * in one glance: `journeyStage` is what you told us and you can change it
 * whenever you like; `founderLevel` is what KNEST has checked and only staff
 * can move. Showing them next to each other, labelled, is more honest than
 * quietly having two notions of "stage" and only surfacing one.
 *
 * Every capability listed is one the platform can actually deliver today.
 * Nothing here promises a micro-grant or a travel budget KNEST has no way to
 * give — a ladder made of things that do not exist is the "plausible fiction"
 * the product refuses everywhere else (spec §46).
 */
export default async function LevelPage() {
  const user = await requireOnboardedUser('/dashboard/level')

  const [open, history] = await Promise.all([
    getOpenLevelRequest(user.id),
    listLevelRequestsForUser(user.id),
  ])

  const current = levelDefinition(user.founderLevel)
  const next = nextLevel(user.founderLevel)

  return (
    <Section>
      <Heading as="h1" size="display">
        Your level
      </Heading>
      <p className="mt-3 max-w-[62ch] text-[var(--color-ink-soft)]">
        You told us you’re at the <strong>{user.journeyStage ?? 'not said'}</strong> stage — that’s
        yours to change any time. Your level is the part KNEST has checked, and it’s what unlocks
        access to labs and space across KIIT.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <ol className="flex flex-col gap-3">
            {FOUNDER_LEVELS.map((entry) => {
              const reached = entry.level <= user.founderLevel
              const isCurrent = entry.level === user.founderLevel
              return (
                <li
                  key={entry.level}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`rounded-[var(--radius-md)] border p-5 ${
                    isCurrent
                      ? 'border-[var(--color-signal)] bg-[var(--color-paper)]'
                      : 'border-[var(--color-line)]'
                  } ${reached ? '' : 'opacity-70'}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      <span className="text-[var(--color-ink-muted)]">{entry.level}.</span>{' '}
                      {entry.label}
                    </p>
                    {isCurrent && (
                      <span className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-signal)]">
                        You are here
                      </span>
                    )}
                    {reached && !isCurrent && (
                      <span className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                        Reached
                      </span>
                    )}
                  </div>
                  <p className="mt-2 max-w-[62ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {entry.summary}
                  </p>
                  {entry.grants.length > 0 && (
                    <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      Unlocks: {entry.grants.map(capabilityLabel).join(' · ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <Heading as="h2" size="heading">
              {open ? 'Your open request' : next ? 'Ask to move up' : 'You’re at the top'}
            </Heading>
            <div className="mt-4">
              {open ? (
                <>
                  <p className="text-[var(--color-ink-soft)]">
                    You’ve asked for level {open.requestedLevel} ({levelDefinition(open.requestedLevel).label}).
                    Someone will read it and come back to you.
                  </p>
                  <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    Asked {formatDate(open.createdAt)}
                  </p>
                </>
              ) : next ? (
                <RequestForm
                  currentLevel={user.founderLevel}
                  nextLevel={next.level}
                  nextLabel={next.label}
                  nextSummary={next.summary}
                />
              ) : (
                <p className="text-[var(--color-ink-soft)]">
                  Level {current.level} is the last rung. {current.summary}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <Heading as="h2" size="heading">
              What you’ve asked before
            </Heading>
            <div className="mt-4">
              {history.length === 0 ? (
                <EmptyState
                  heading="Nothing yet"
                  body="When you ask to move up, the decision and the reason behind it will show here."
                  size="compact"
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {history.map((entry) => (
                    <li key={entry.id} className="border-b border-[var(--color-line)] pb-4 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[length:var(--text-small)]">
                          Level {entry.requestedLevel} · {formatDate(entry.createdAt)}
                        </span>
                        <StatusBadge status={entry.status} config={LEVEL_REQUEST_STATUS} />
                      </div>
                      {/* Shown to the founder on purpose. A refusal with no
                          reason attached is what makes a ladder feel arbitrary. */}
                      {entry.decisionNote && (
                        <p className="mt-2 whitespace-pre-wrap text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                          {entry.decisionNote}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </Section>
  )
}
