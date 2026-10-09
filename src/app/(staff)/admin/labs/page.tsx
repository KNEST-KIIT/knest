import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { labs } from '@/db/schema'
import { EmptyState, Heading } from '@/components/ui'
import { CreateLab } from './create-lab'

export const metadata: Metadata = { title: 'Labs — Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminLabsPage() {
  const rows = await db.select().from(labs).orderBy(asc(labs.department), asc(labs.name))
  return (
    <div className="space-y-10">
      <div>
        <Heading as="h1" size="title">
          Labs
        </Heading>
        <p className="mt-2 max-w-[65ch] text-[var(--color-ink-soft)]">
          Create a lab, then open its console to appoint a head, set its opening hours and rules. A new lab starts closed (no hours) with recommended rules that are not an approved policy.
        </p>
      </div>

      <section aria-labelledby="new" className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
        <Heading as="h2" size="heading">
          <span id="new">Create a lab</span>
        </Heading>
        <div className="mt-4">
          <CreateLab />
        </div>
      </section>

      <section aria-labelledby="all">
        <div className="flex items-baseline justify-between">
          <Heading as="h2" size="heading">
            <span id="all">All labs</span>
          </Heading>
          <Link href="/admin/labs/report" className="text-[length:var(--text-small)] font-semibold text-[var(--color-signal)] underline underline-offset-4">
            Utilisation report
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState heading="No labs yet" body="Create the first lab above." size="compact" />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
            {rows.map((lab) => (
              <li key={lab.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <strong>{lab.name}</strong> <span className="text-[var(--color-ink-muted)]">{lab.department}</span>
                  {!lab.isActive && <span className="ml-2 rounded bg-[var(--color-ink)] px-2 py-0.5 text-xs font-bold uppercase text-white">Closed</span>}
                </span>
                <Link href={`/dashboard/lab-staff/${lab.slug}`} className="text-[length:var(--text-small)] font-semibold text-[var(--color-signal)] underline underline-offset-4">
                  Open console
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
