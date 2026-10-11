import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { labs } from '@/db/schema'
import { EmptyState, Heading } from '@/components/ui'
import { rangeLabel } from '@/lib/lab-format'
import { listDepartments } from '@/server/labs/department-admin'
import { orderTree } from '@/server/labs/departments'
import { listEscalations } from '@/server/labs/service'
import { CreateLab } from './create-lab'
import { DepartmentManager } from './departments'

export const metadata: Metadata = { title: 'Labs — Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminLabsPage() {
  const [rows, escalations, departments] = await Promise.all([
    db.select().from(labs).orderBy(asc(labs.department), asc(labs.name)),
    listEscalations(),
    listDepartments(),
  ])
  const tree = orderTree(departments)
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

      <section aria-labelledby="attention" className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
        <Heading as="h2" size="heading">
          <span id="attention">Needs an administrator ({escalations.length})</span>
        </Heading>
        <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Requests whose lab has no head, or that have waited longer than the lab&rsquo;s own escalation time. Open the lab&rsquo;s console to decide; you will be asked for a reason, which is kept in the decision history.
        </p>
        {escalations.length === 0 ? (
          <p className="mt-3 text-[var(--color-ink-muted)]">Nothing is waiting on an administrator.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)]">
            {escalations.map((e) => (
              <li key={e.bookingId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[length:var(--text-small)]">
                <span>
                  <strong>{e.labName}</strong>, {e.memberName ? `${e.memberName} (${e.memberEmail})` : e.memberEmail},{rangeLabel(e.startsAt, e.endsAt)}
                  <span className="ml-2 text-[var(--color-ink-muted)]">{e.reason === 'no_head' ? 'This lab has no head.' : `Waiting ${e.waitedHours} hours.`}</span>
                </span>
                <Link href={`/dashboard/lab-staff/${e.labSlug}`} className="font-semibold text-[var(--color-signal)] underline underline-offset-4">
                  Open console
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="departments" className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
        <Heading as="h2" size="heading">
          <span id="departments">Departments</span>
        </Heading>
        <p className="mt-1 max-w-[65ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          The department structure is data. The utilisation report adds each lab&rsquo;s figures to its department and to every department above it.
        </p>
        <div className="mt-4">
          <DepartmentManager departments={tree.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, depth: d.depth }))} />
        </div>
      </section>

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
