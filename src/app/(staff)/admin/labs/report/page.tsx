import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading } from '@/components/ui'
import { ReportTable } from '@/components/labs/report-table'
import { daysAgo } from '@/lib/clock'
import { todayIst } from '@/lib/lab-format'
import { isValidDateString } from '@/server/labs/rules'
import { labReport } from '@/server/labs/reports'

export const metadata: Metadata = { title: 'Lab utilisation — Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminLabReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const q = await searchParams
  const to = q.to && isValidDateString(q.to) ? q.to : todayIst()
  const from = q.from && isValidDateString(q.from) ? q.from : todayIst(daysAgo(30))
  const end = to < from ? from : to
  const report = await labReport({ from, to: end })

  return (
    <div className="space-y-6">
      <Link href="/admin/labs" className="text-sm font-semibold text-[var(--color-signal)] underline underline-offset-4">
        ← Labs
      </Link>
      <Heading as="h1" size="title">
        Lab utilisation
      </Heading>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Choose dates">
        <label className="flex flex-col text-[length:var(--text-small)]">
          From
          <input name="from" type="date" defaultValue={from} className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2" />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          To
          <input name="to" type="date" defaultValue={end} className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2" />
        </label>
        <button type="submit" className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white">
          Show
        </button>
        <a href={`/api/labs/report.csv?from=${from}&to=${end}`} className="text-[length:var(--text-small)] font-semibold text-[var(--color-signal)] underline underline-offset-4">
          Download as a spreadsheet
        </a>
      </form>
      <ReportTable report={report} />
    </div>
  )
}
