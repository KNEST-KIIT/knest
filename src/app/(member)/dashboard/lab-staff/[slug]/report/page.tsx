import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heading } from '@/components/ui'
import { ReportTable } from '@/components/labs/report-table'
import { daysAgo } from '@/lib/clock'
import { todayIst } from '@/lib/lab-format'
import { requireOnboardedUser } from '@/server/auth/guards'
import { actorFor, canManage } from '@/server/labs/access'
import { isValidDateString } from '@/server/labs/rules'
import { labReport } from '@/server/labs/reports'
import { getLabBySlug } from '@/server/labs/service'

export const metadata = { title: 'Lab utilisation' }
export const dynamic = 'force-dynamic'

export default async function LabReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { slug } = await params
  await requireOnboardedUser(`/dashboard/lab-staff/${slug}/report`)
  const found = await getLabBySlug(slug)
  if (!found) notFound()
  const actor = await actorFor(found.lab.id)
  if (!canManage(actor)) notFound()

  const q = await searchParams
  const to = q.to && isValidDateString(q.to) ? q.to : todayIst()
  const from = q.from && isValidDateString(q.from) ? q.from : todayIst(daysAgo(30))
  const report = await labReport({ from, to: to < from ? from : to, labId: found.lab.id })

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Link href={`/dashboard/lab-staff/${found.lab.slug}`} className="text-sm font-semibold text-[var(--color-signal)] underline underline-offset-4">
        ← {found.lab.name}
      </Link>
      <Heading as="h1" size="title">
        Utilisation: {found.lab.name}
      </Heading>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Choose dates">
        <label className="flex flex-col text-[length:var(--text-small)]">
          From
          <input name="from" type="date" defaultValue={from} className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2" />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          To
          <input name="to" type="date" defaultValue={to} className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2" />
        </label>
        <button type="submit" className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white">
          Show
        </button>
        <a href={`/api/labs/report.csv?from=${from}&to=${report.to}&lab=${found.lab.id}`} className="h-10 content-center text-[length:var(--text-small)] font-semibold text-[var(--color-signal)] underline underline-offset-4">
          Download as a spreadsheet
        </a>
      </form>
      <ReportTable report={report} />
    </div>
  )
}
