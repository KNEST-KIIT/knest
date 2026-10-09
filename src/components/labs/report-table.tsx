import type { LabReport } from '@/server/labs/reports'

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]'
const td = 'px-3 py-2 text-[length:var(--text-small)]'

/** The utilisation figures as a table. Every number comes from the booking and attendance tables. */
export function ReportTable({ report }: { report: LabReport }) {
  const head = ['Requests', 'Approved', 'Rejected', 'Cancelled', 'Attended', 'No-shows', 'Hours booked', 'Hours attended', 'Manual entries']
  const cells = (r: { requests: number; approved: number; rejected: number; cancelled: number; attended: number; noShows: number; hoursBooked: number; hoursAttended: number; manualEntries: number }) => [
    r.requests, r.approved, r.rejected, r.cancelled, r.attended, r.noShows, r.hoursBooked, r.hoursAttended, r.manualEntries,
  ]
  return (
    <div className="flex flex-col gap-8">
      <div role="region" tabIndex={0} aria-label="Utilisation by lab, scrolls sideways" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[56rem]">
          <caption className="sr-only">Utilisation by lab, {report.from} to {report.to}</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Lab</th>
              <th scope="col" className={th}>Department</th>
              {head.map((h) => (
                <th key={h} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.labs.length === 0 && (
              <tr>
                <td className={td} colSpan={head.length + 2}>No labs in scope.</td>
              </tr>
            )}
            {report.labs.map((r) => (
              <tr key={r.labId} className="border-t border-[var(--color-line)]">
                <th scope="row" className={`${td} font-semibold`}>{r.lab}</th>
                <td className={td}>{r.department || '—'}</td>
                {cells(r).map((c, i) => (
                  <td key={i} className={td}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-line-strong)] font-semibold">
              <th scope="row" className={td}>All labs</th>
              <td className={td} />
              {cells(report.totals).map((c, i) => (
                <td key={i} className={td}>{c}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {report.departments.length > 1 && (
        <div role="region" tabIndex={0} aria-label="Utilisation by department, scrolls sideways" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
          <table className="w-full min-w-[48rem]">
            <caption className="sr-only">Utilisation by department</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Department</th>
                {head.map((h) => (
                  <th key={h} scope="col" className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.departments.map((d) => (
                <tr key={d.department} className="border-t border-[var(--color-line)]">
                  <th scope="row" className={`${td} font-semibold`}>{d.department || '(no department)'}</th>
                  {cells(d).map((c, i) => (
                    <td key={i} className={td}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[var(--color-ink-muted)]">
        Counted by the booking&rsquo;s start date, in India time. &ldquo;Approved&rdquo; includes bookings later marked attended or no-show. Attendance is recorded by hand; &ldquo;Manual entries&rdquo; is how many of the attendance records that is.
      </p>
    </div>
  )
}
