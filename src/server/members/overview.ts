'use server'

import { and, count, eq, gte, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { applications, eventRegistrations, labBookings, levelRequests, users } from '@/db/schema'
import { requireStaff } from '@/server/auth/guards'
import { canAccessArea } from '@/server/auth/roles'

/**
 * The staff dashboard's numbers.
 *
 * `UX_WIREFRAMES.md §10` specified this screen — counter tiles and a "needs
 * your attention" list — and it was never built; `/admin` went straight to
 * Payload's stock collection grid. The counters read real tables and render
 * `0` when that is the answer (§21): zero is information, and a fabricated
 * demo number is a lie that outlives the demo.
 *
 * Everything here is a `COUNT`, so the whole screen is a handful of index
 * lookups rather than a page of rows nobody reads.
 */

export type AttentionItem = {
  label: string
  count: number
  href: string
  /** Which admin area gates it, so the dashboard only shows what you can act on. */
  area: 'applications' | 'levels' | 'mentors' | 'users'
}

export type Overview = {
  counters: { label: string; value: number; hint: string }[]
  attention: AttentionItem[]
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function getStaffOverview(): Promise<Overview> {
  const staff = await requireStaff()
  const since = new Date(Date.now() - THIRTY_DAYS_MS)

  const [
    [members],
    [newMembers],
    [onboarded],
    [pendingApplications],
    [pendingLevels],
    [pendingBookings],
    [upcomingRegistrations],
    [mentorsAwaiting],
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(users).where(gte(users.createdAt, since)),
    db.select({ value: count() }).from(users).where(isNotNull(users.onboardingCompletedAt)),
    db
      .select({ value: count() })
      .from(applications)
      .where(eq(applications.status, 'submitted')),
    db
      .select({ value: count() })
      .from(levelRequests)
      .where(eq(levelRequests.status, 'pending')),
    db
      .select({ value: count() })
      .from(labBookings)
      .where(eq(labBookings.status, 'requested')),
    db.select({ value: count() }).from(eventRegistrations),
    // Mentors who finished onboarding and have no published profile yet. The
    // product tells them "your profile is with our team"; until now no screen
    // showed staff that queue, so the promise had nobody keeping it.
    db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          eq(users.platformRole, 'mentor'),
          isNotNull(users.onboardingCompletedAt),
          isNull(users.staffRole),
        ),
      ),
  ])

  const attention: AttentionItem[] = [
    {
      label: 'Applications waiting to be read',
      count: pendingApplications?.value ?? 0,
      href: '/admin/applications?status=submitted',
      area: 'applications',
    },
    {
      label: 'Level requests waiting on a decision',
      count: pendingLevels?.value ?? 0,
      href: '/admin/levels?status=pending',
      area: 'levels',
    },
    {
      label: 'Mentors waiting on a profile',
      count: mentorsAwaiting?.value ?? 0,
      href: '/admin/members?platformRole=mentor',
      area: 'mentors',
    },
  ]

  return {
    counters: [
      { label: 'Members', value: members?.value ?? 0, hint: 'Accounts on the platform' },
      { label: 'New this month', value: newMembers?.value ?? 0, hint: 'Signed up in the last 30 days' },
      { label: 'Onboarded', value: onboarded?.value ?? 0, hint: 'Finished the onboarding flow' },
      { label: 'Event registrations', value: upcomingRegistrations?.value ?? 0, hint: 'Across every event' },
      { label: 'Lab requests open', value: pendingBookings?.value ?? 0, hint: 'Awaiting a lab manager' },
    ],
    // Only surface what this person can actually act on. A reviewer being shown
    // a mentor queue they cannot open is a 404 waiting to happen — which is
    // exactly what the Analytics link in the header already does.
    attention: attention.filter((item) => canAccessArea(staff.staffRole, item.area)),
  }
}
