import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading } from '@/components/ui'
import { requireAdminArea } from '@/server/auth/guards'
import {
  PERIODS,
  getAnalyticsReport,
  isPeriod,
  type Breakdown,
  type FunnelStep,
} from '@/server/analytics/funnel'

export const metadata: Metadata = { title: 'Analytics — Admin' }

const percent = (value: number) => `${Math.round(value * 100)}%`

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  await requireAdminArea('analytics')

  const params = await searchParams
  const period = isPeriod(params.period) ? params.period : '30d'
  const report = await getAnalyticsReport(period)
  const periodLabel = PERIODS.find((entry) => entry.value === period)!.label.toLowerCase()

  return (
    <div>
      <Heading as="h1" size="title">
        Analytics
      </Heading>

      <nav aria-label="Period" className="mt-6 flex flex-wrap gap-2">
        {PERIODS.map((entry) => (
          <Link
            key={entry.value}
            href={`/admin/analytics?period=${entry.value}`}
            aria-current={entry.value === period ? 'page' : undefined}
            className={`flex h-11 items-center rounded-[var(--radius-sm)] border px-4 text-[length:var(--text-small)] ${
              entry.value === period
                ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                : 'border-[var(--color-line)]'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {report.totalEvents === 0 ? (
        <p className="mt-8 max-w-[60ch] text-[var(--color-ink-soft)]">
          Nothing tracked in the {periodLabel}. That is the real answer, not a loading state — try
          a longer period.
        </p>
      ) : (
        <>
          <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
            <p className="text-[length:var(--text-small)] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
              Activated builders
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[length:var(--text-display)]">
              {report.activatedBuilders}
            </p>
            <p className="mt-2 max-w-[56ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              Onboarded, with a journey stage set, and at least one of: started an application,
              registered for an event, or viewed a startup — in the {periodLabel}.
            </p>
          </div>

          <section className="mt-10">
            <Heading as="h2" size="heading" uppercase={false}>
              The path through
            </Heading>
            <p className="mt-2 max-w-[64ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              The one sequence in the product where each step genuinely follows the last, so a
              drop-off between two rows means what it looks like it means.
            </p>
            <ol className="mt-4 flex flex-col gap-2">
              {report.path.map((step) => (
                <Step key={step.label} step={step} />
              ))}
            </ol>
          </section>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <Panel
              title="Applications"
              caption="Every application created in this period, by where it got to."
              rows={report.applications}
            />
            <Panel
              title="Lab bookings"
              caption="Counted from the bookings themselves, not from events — the tables are the truth."
              rows={report.bookings}
            />
            <Panel
              title="Level requests"
              caption="What founders asked for, and what was decided."
              rows={report.levels.requests}
            />
            <Panel
              title="Members by level"
              caption="A standing fact about people rather than something that happened this period, so this one ignores the filter."
              rows={report.levels.membersByLevel}
            />
            <Panel
              title="What people search for"
              caption="Read back out of the event props, which until now were written and never looked at."
              rows={report.topSearches}
            />
            <Panel
              title="Most-viewed programmes"
              caption="Which programmes people actually open."
              rows={report.topPrograms}
            />
          </div>

          <section className="mt-10">
            <Heading as="h2" size="heading" uppercase={false}>
              Other activity
            </Heading>
            <p className="mt-2 max-w-[64ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              Real things people did that are not steps in a line. No conversion rate is shown,
              because there is no sequence here for one to be a rate of.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.activity.map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4"
                >
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {entry.label}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-[length:var(--text-heading)]">
                    {entry.count}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/** One rung of the funnel, with a bar drawn to its share of the top. */
function Step({ step }: { step: FunnelStep }) {
  const width = step.fromTop === null ? 0 : Math.max(step.fromTop * 100, step.count > 0 ? 1.5 : 0)

  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-medium">{step.label}</p>
        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          <span className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] text-[var(--color-ink)]">
            {step.count}
          </span>
          {step.fromPrevious !== null && (
            <>
              {' · '}
              {percent(step.fromPrevious)} of the step above
            </>
          )}
          {step.fromTop !== null && step.fromPrevious !== null && (
            <>
              {' · '}
              {percent(step.fromTop)} of the top
            </>
          )}
        </p>
      </div>
      {/* aria-hidden: the numbers beside it already say this, and a bar
          announced as "70 percent" twice is noise on a screen reader. */}
      <div aria-hidden className="mt-3 h-1.5 rounded-full bg-[var(--color-line)]">
        <div
          className="h-full rounded-full bg-[var(--color-signal)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  )
}

function Panel({
  title,
  caption,
  rows,
}: {
  title: string
  caption: string
  rows: Breakdown[]
}) {
  return (
    <section>
      <Heading as="h2" size="heading" uppercase={false}>
        {title}
      </Heading>
      <p className="mt-2 max-w-[52ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        {caption}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">None.</p>
      ) : (
        <dl className="mt-3 flex flex-col">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] py-2 last:border-0"
            >
              <dt className="text-[length:var(--text-small)]">{row.label}</dt>
              <dd className="font-[family-name:var(--font-display)]">{row.count}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
