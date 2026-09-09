import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, Heading } from '@/components/ui'
import { getStaffOverview } from '@/server/members/overview'

export const metadata: Metadata = { title: 'Overview — Admin' }

/**
 * The staff dashboard specified in UX_WIREFRAMES.md §10 and never built.
 *
 * It lives at /admin/overview rather than /admin because `/admin` belongs to
 * Payload's optional catch-all route. The staff screens only resolve at all
 * because static segments shadow that catch-all — putting a page at `/admin`
 * itself would collide with the CMS.
 */
export default async function OverviewPage() {
  const { counters, attention } = await getStaffOverview()
  const waiting = attention.filter((item) => item.count > 0)

  return (
    <div>
      <Heading as="h1" size="title">
        Overview
      </Heading>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {counters.map((counter) => (
          <Card key={counter.label}>
            <p className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              {counter.label}
            </p>
            {/* Real counts only. Zero is information (§21). */}
            <p className="mt-2 font-[family-name:var(--font-display)] text-[length:var(--text-title)] tabular-nums">
              {counter.value}
            </p>
            <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              {counter.hint}
            </p>
          </Card>
        ))}
      </div>

      <section className="mt-12">
        <Heading as="h2" size="heading">
          Needs your attention
        </Heading>

        {waiting.length === 0 ? (
          <p className="mt-4 text-[var(--color-ink-soft)]">
            Nothing waiting. {/* honest, not padded */}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {waiting.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white px-5 py-3 transition-colors hover:border-[var(--color-ink)]"
                >
                  <span>{item.label}</span>
                  <span className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] tabular-nums text-[var(--color-signal)]">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
