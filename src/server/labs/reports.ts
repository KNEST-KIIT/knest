import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { isLabAdmin, labsRunBy } from './access'
import { istInstant, isValidDateString } from './rules'

export type LabReportRow = {
  labId: string
  lab: string
  department: string
  requests: number
  approved: number
  rejected: number
  cancelled: number
  attended: number
  noShows: number
  hoursBooked: number
  hoursAttended: number
  manualEntries: number
}

export type LabReport = {
  from: string
  to: string
  labs: LabReportRow[]
  departments: Omit<LabReportRow, 'labId' | 'lab'>[]
  totals: Omit<LabReportRow, 'labId' | 'lab' | 'department'>
}

const NUMBERS = ['requests', 'approved', 'rejected', 'cancelled', 'attended', 'noShows', 'hoursBooked', 'hoursAttended', 'manualEntries'] as const

/**
 * Utilisation per lab and per department over an IST date range, counted from the booking and
 * attendance tables. A booking is counted in the range its start time falls in. "Approved" is
 * every booking that was approved and is not since cancelled or rejected (approved, attended,
 * no-show). Hours come from the booking's own start and end. Every figure can be reproduced by a
 * query; nothing is estimated. Manual entries are counted separately because they are the only
 * attendance source until automated check-in exists.
 *
 * Who may ask: lab administrators for every lab, a head for the labs they head.
 */
export async function labReport(input: { from: string; to: string; labId?: string }): Promise<LabReport> {
  const user = await requireUserOrThrow()
  const admin = isLabAdmin((user.staffRole ?? null) as StaffRole | null)
  const headOf = (await labsRunBy(user.id)).filter((l) => l.role === 'head').map((l) => l.labId)
  if (!admin && headOf.length === 0) throw new UnauthorizedError(403)
  if (input.labId && !admin && !headOf.includes(input.labId)) throw new UnauthorizedError(403)
  if (!isValidDateString(input.from) || !isValidDateString(input.to) || input.to < input.from) throw new RangeError('Give a valid date range.')

  const start = istInstant(input.from)
  const end = istInstant(input.to, 24 * 60) // the whole last day
  const scope = input.labId ? [input.labId] : admin ? null : headOf

  const labFilter = scope ? sql`and l.id in (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})` : sql``
  const result = await db.execute<Record<string, string | number | null>>(sql`
    select
      l.id as lab_id, l.name as lab, l.department as department,
      count(b.id)::int as requests,
      count(b.id) filter (where b.status in ('approved','completed','no_show'))::int as approved,
      count(b.id) filter (where b.status = 'rejected')::int as rejected,
      count(b.id) filter (where b.status = 'cancelled')::int as cancelled,
      count(b.id) filter (where b.status = 'completed')::int as attended,
      count(b.id) filter (where b.status = 'no_show')::int as no_shows,
      coalesce(sum(extract(epoch from (b.ends_at - b.starts_at)) / 3600) filter (where b.status in ('approved','completed','no_show')), 0)::float as hours_booked,
      coalesce(sum(extract(epoch from (b.ends_at - b.starts_at)) / 3600) filter (where b.status = 'completed'), 0)::float as hours_attended,
      count(a.id) filter (where a.method = 'manual')::int as manual_entries
    from app.labs l
    left join app.lab_bookings b on b.lab_id = l.id and b.starts_at >= ${start} and b.starts_at < ${end}
    left join app.lab_attendance a on a.booking_id = b.id
    where true ${labFilter}
    group by l.id, l.name, l.department
    order by l.department, l.name
  `)

  const labs: LabReportRow[] = result.rows.map((r) => ({
    labId: String(r.lab_id),
    lab: String(r.lab),
    department: String(r.department ?? ''),
    requests: Number(r.requests),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    cancelled: Number(r.cancelled),
    attended: Number(r.attended),
    noShows: Number(r.no_shows),
    hoursBooked: Math.round(Number(r.hours_booked) * 100) / 100,
    hoursAttended: Math.round(Number(r.hours_attended) * 100) / 100,
    manualEntries: Number(r.manual_entries),
  }))

  const empty = () => Object.fromEntries(NUMBERS.map((k) => [k, 0])) as Record<(typeof NUMBERS)[number], number>
  const byDepartment = new Map<string, Record<(typeof NUMBERS)[number], number>>()
  const totals = empty()
  for (const row of labs) {
    const dept = byDepartment.get(row.department) ?? empty()
    for (const k of NUMBERS) {
      dept[k] += row[k]
      totals[k] += row[k]
    }
    byDepartment.set(row.department, dept)
  }
  const round = (n: number) => Math.round(n * 100) / 100
  totals.hoursBooked = round(totals.hoursBooked)
  totals.hoursAttended = round(totals.hoursAttended)

  return {
    from: input.from,
    to: input.to,
    labs,
    departments: [...byDepartment.entries()].map(([department, v]) => ({ department, ...v, hoursBooked: round(v.hoursBooked), hoursAttended: round(v.hoursAttended) })),
    totals,
  }
}

const csvCell = (value: string | number) => {
  const text = String(value)
  // A cell that starts with = + - @ is treated as a formula by spreadsheets; neutralise it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function reportToCsv(report: LabReport): string {
  const header = ['Department', 'Lab', 'Requests', 'Approved', 'Rejected', 'Cancelled', 'Attended', 'No-shows', 'Hours booked', 'Hours attended', 'Manual attendance entries']
  const lines = [header, ...report.labs.map((r) => [r.department, r.lab, r.requests, r.approved, r.rejected, r.cancelled, r.attended, r.noShows, r.hoursBooked, r.hoursAttended, r.manualEntries])]
  return lines.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
