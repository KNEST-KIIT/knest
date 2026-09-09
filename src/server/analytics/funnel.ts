import { and, count, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { analyticsEvents, applications, labBookings, levelRequests, users } from '@/db/schema'
import { getProgramTitlesByIds } from '@/server/applications/program-questions'

/**
 * What the analytics screen reports on.
 *
 * The screen was a grid of raw counts under five stage headings. It was
 * labelled a funnel and reported no conversion at all, which is the one thing
 * a funnel is for; it had no time dimension, so "how did last week go" was
 * unanswerable and `analytics_events.created_at` was never queried; and
 * `props` was written on every event and read back nowhere, so nobody could
 * see which programmes were being looked at or what people searched for.
 *
 * Three deliberate choices in the rewrite:
 *
 * 1. **Conversion is only shown along a path that really is sequential.** The
 *    old stage grouping put `event_register`, `resource_view`, `startup_view`
 *    and `search_query` in one stage; those are parallel activities, and a
 *    "conversion" between them would be a number that looks meaningful and
 *    is not. They are reported as activity, without a rate.
 *
 * 2. **Outcomes are counted from the tables that own them**, not from the
 *    event stream. How many bookings were approved is a question
 *    `app.lab_bookings` answers exactly; deriving it from
 *    `lab_booking_decided` events and their `props` would be a second,
 *    lossier copy that drifts the first time an event fails to fire.
 *
 * 3. **Zero is reported as zero.** Nothing here is smoothed, estimated or
 *    filled in. An empty period says so (spec §46).
 */

export type Period = '7d' | '30d' | '90d' | 'all'

export const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

export function periodStart(period: Period): Date | null {
  if (period === 'all') return null
  return new Date(Date.now() - DAYS[period] * 24 * 60 * 60 * 1000)
}

export function isPeriod(value: unknown): value is Period {
  return PERIODS.some((entry) => entry.value === value)
}

/**
 * The one path through the product that is genuinely sequential, so the one
 * place a drop-off rate means what it appears to mean.
 */
const PRIMARY_PATH = [
  { event: 'landing_view', label: 'Landed on the site' },
  { event: 'signup', label: 'Created an account' },
  { event: 'onboarding_completed', label: 'Finished onboarding' },
  { event: 'application_start', label: 'Started an application' },
  { event: 'application_submit', label: 'Submitted it' },
] as const

/** Real things people do that are not steps in a line, and get no rate attached. */
const ACTIVITY = [
  { event: 'program_view', label: 'Programme views' },
  { event: 'journey_selector_choice', label: 'Journey selector choices' },
  { event: 'event_register', label: 'Event registrations' },
  { event: 'resource_view', label: 'Resource views' },
  { event: 'startup_view', label: 'Startup views' },
  { event: 'search_query', label: 'Searches' },
] as const

const ACTIVATING_EVENTS = ['application_start', 'event_register', 'startup_view']

export type FunnelStep = {
  label: string
  count: number
  /** Share of the step above. Null on the first step, which has nothing to convert from. */
  fromPrevious: number | null
  /** Share of the very top of the funnel. */
  fromTop: number | null
}

export type Breakdown = { label: string; count: number }

export type AnalyticsReport = {
  period: Period
  totalEvents: number
  activatedBuilders: number
  path: FunnelStep[]
  activity: Breakdown[]
  applications: Breakdown[]
  levels: { requests: Breakdown[]; membersByLevel: Breakdown[] }
  bookings: Breakdown[]
  topSearches: Breakdown[]
  topPrograms: Breakdown[]
}

/** Counts per event name over the period, in one grouped query rather than one per event. */
async function eventCounts(since: Date | null): Promise<Map<string, number>> {
  const rows = await db
    .select({ event: analyticsEvents.event, value: count() })
    .from(analyticsEvents)
    .where(since ? gte(analyticsEvents.createdAt, since) : undefined)
    .groupBy(analyticsEvents.event)
  return new Map(rows.map((row) => [row.event, row.value]))
}

/**
 * The props read-back that never existed.
 *
 * `props` is jsonb, so this reaches into it with `->>`. Restricted to one
 * event name and one key, and capped, because the point is "what are the ten
 * things people search for", not a general-purpose query surface.
 */
async function topPropValues(
  event: string,
  key: string,
  since: Date | null,
  limit = 8,
): Promise<Breakdown[]> {
  // Written out rather than composed through the query builder, and grouped
  // by ordinal.
  //
  // Two separate problems land in the same place. Drizzle drops the table
  // qualifier from a `sql` fragment in the select list but keeps it in GROUP
  // BY, so one expression renders two ways; and even spelled identically,
  // `props ->> $1` and `props ->> $5` are distinct bound parameters that
  // Postgres will not prove equal. Both come back as 42803, "must appear in
  // the GROUP BY clause". `group by 1` refers to the select item itself and
  // is immune to both. `event` and `key` are module constants and still go
  // through as bound parameters.
  const result = await db.execute<{ label: string; value: string }>(sql`
    select props ->> ${key} as label, count(*)::int as value
    from app.analytics_events
    where event = ${event}
      and props ->> ${key} is not null
      ${since ? sql`and created_at >= ${since}` : sql``}
    group by 1
    order by 2 desc
    limit ${limit}
  `)

  const rows = Array.isArray(result) ? result : result.rows
  return rows.map((row) => ({ label: String(row.label), count: Number(row.value) }))
}

/**
 * North Star: onboarded, with a journey stage set, and at least one real act —
 * starting an application, registering for an event, or looking at a startup.
 *
 * Computed live from rows every time rather than kept as a counter: cheap at
 * this scale, and a stored counter is one more thing that can silently drift
 * from the truth.
 */
async function activatedBuilders(since: Date | null): Promise<number> {
  const activatedRows = await db
    .selectDistinct({ userId: analyticsEvents.userId })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.event, ACTIVATING_EVENTS),
        since ? gte(analyticsEvents.createdAt, since) : undefined,
      ),
    )

  const ids = activatedRows.map((row) => row.userId).filter((id): id is string => id !== null)
  if (ids.length === 0) return 0

  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(
      and(
        isNotNull(users.onboardingCompletedAt),
        isNotNull(users.journeyStage),
        inArray(users.id, ids),
      ),
    )
  return row?.value ?? 0
}

const APPLICATION_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Not this time',
  waitlisted: 'Waitlisted',
}

const LEVEL_REQUEST_LABELS: Record<string, string> = {
  pending: 'Waiting on us',
  approved: 'Approved',
  rejected: 'Not yet',
  withdrawn: 'Withdrawn',
}

const BOOKING_LABELS: Record<string, string> = {
  requested: 'Waiting on a lab',
  approved: 'Confirmed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
}

export async function getAnalyticsReport(period: Period): Promise<AnalyticsReport> {
  const since = periodStart(period)

  const [
    counts,
    builders,
    applicationRows,
    levelRows,
    bookingRows,
    memberRows,
    topSearches,
    topProgramIds,
  ] = await Promise.all([
    eventCounts(since),
    activatedBuilders(since),
    db
      .select({ status: applications.status, value: count() })
      .from(applications)
      .where(since ? gte(applications.createdAt, since) : undefined)
      .groupBy(applications.status),
    db
      .select({ status: levelRequests.status, value: count() })
      .from(levelRequests)
      .where(since ? gte(levelRequests.createdAt, since) : undefined)
      .groupBy(levelRequests.status),
    db
      .select({ status: labBookings.status, value: count() })
      .from(labBookings)
      .where(since ? gte(labBookings.createdAt, since) : undefined)
      .groupBy(labBookings.status),
    // Deliberately not period-scoped: a level is a standing fact about a
    // person, not something that happened this week.
    db
      .select({ level: users.founderLevel, value: count() })
      .from(users)
      .groupBy(users.founderLevel)
      .orderBy(users.founderLevel),
    topPropValues('search_query', 'query', since),
    // `program_view` records the numeric Payload id, so the ids come back
    // first and the titles are resolved in one batched lookup below.
    topPropValues('program_view', 'programId', since),
  ])

  const programTitles = await getProgramTitlesByIds(
    topProgramIds.map((entry) => Number(entry.label)).filter(Number.isInteger),
  )
  const topPrograms = topProgramIds.map((entry) => ({
    label: programTitles.get(Number(entry.label))?.title ?? `Programme ${entry.label}`,
    count: entry.count,
  }))

  const top = counts.get(PRIMARY_PATH[0].event) ?? 0
  let previous: number | null = null
  const path: FunnelStep[] = PRIMARY_PATH.map((step) => {
    const value = counts.get(step.event) ?? 0
    const entry: FunnelStep = {
      label: step.label,
      count: value,
      fromPrevious: previous === null || previous === 0 ? null : value / previous,
      fromTop: top === 0 ? null : value / top,
    }
    previous = value
    return entry
  })

  let totalEvents = 0
  for (const value of counts.values()) totalEvents += value

  return {
    period,
    totalEvents,
    activatedBuilders: builders,
    path,
    activity: ACTIVITY.map((entry) => ({
      label: entry.label,
      count: counts.get(entry.event) ?? 0,
    })),
    applications: applicationRows.map((row) => ({
      label: APPLICATION_LABELS[row.status] ?? row.status,
      count: row.value,
    })),
    levels: {
      requests: levelRows.map((row) => ({
        label: LEVEL_REQUEST_LABELS[row.status] ?? row.status,
        count: row.value,
      })),
      membersByLevel: memberRows.map((row) => ({
        label: `Level ${row.level}`,
        count: row.value,
      })),
    },
    bookings: bookingRows.map((row) => ({
      label: BOOKING_LABELS[row.status] ?? row.status,
      count: row.value,
    })),
    topSearches,
    topPrograms,
  }
}
