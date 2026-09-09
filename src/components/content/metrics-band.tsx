import { Heading } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import type { Metric } from '@/payload/payload-types'

/**
 * Verified ecosystem numbers.
 *
 * The Metrics collection's own doc comment says these are "shown on the
 * homepage" — no page had ever queried it, so they were shown nowhere. They
 * render here, on the page about how KNEST works.
 *
 * Each figure carries its own `asOf` date, because the collection requires
 * one and a number without a date is the thing spec §46 exists to prevent.
 * `source` is required too but stays internal: the collection describes it as
 * an internal note, so it is not rendered.
 *
 * Renders nothing when there are no metrics — which is the correct state
 * today, and much better than a row of zeroes implying we measured and found
 * nothing.
 */
export function MetricsBand({ metrics, heading }: { metrics: Metric[]; heading: string }) {
  if (metrics.length === 0) return null

  return (
    <section>
      <Heading as="h2" size="title">
        {heading}
      </Heading>
      <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
          >
            <dt className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-semibold leading-tight">
              {metric.value}
            </dt>
            <dd className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              {metric.label}
              <span className="mt-1 block text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                As of {formatDate(metric.asOf)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
