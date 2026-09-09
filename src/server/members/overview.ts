'use server'

import { and, count, eq, gte, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { applications, eventRegistrations, labBookings, levelRequests, users } from '@/db/schema'
import { requireStaff } from '@/server/auth/guards'
import { canAccessArea } from '@/server/auth/roles'
import { getContentClient } from '@/server/content/payload-client'

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

/**
 * How many onboarded mentors have no linked profile.
 *
 * Two lookups rather than a join, because the two halves live in schemas that
 * are deliberately kept apart (spec §32): Payload owns `cms`, Drizzle owns
 * `app`, and there is no foreign key between them to join on.
 */
async function countMentorsAwaitingProfile(onboardedCount: number): Promise<number> {
  if (onboardedCount === 0) return 0

  const mentorAccounts = await db.query.users.findMany({
    where: and(eq(users.platformRole, 'mentor'), isNotNull(users.onboardingCompletedAt)),
    columns: { id: true },
    limit: 500,
  })
  if (mentorAccounts.length === 0) return 0

  const payload = await getContentClient()
  const profiles = await payload.find({
    collection: 'mentors',
    depth: 0,
    limit: 500,
    overrideAccess: false,
    where: { userId: { in: mentorAccounts.map((mentor) => mentor.id) } },
  })
  const linked = new Set(profiles.docs.map((doc) => doc.userId).filter(Boolean) as string[])

  return mentorAccounts.filter((mentor) => !linked.has(mentor.id)).length
}

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
    [mentorsOnboarded],
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
    // Mentors who finished onboarding, whether or not they have a profile.
    // Which of them are still waiting is answered below, against the CMS.
    db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.platformRole, 'mentor'), isNotNull(users.onboardingCompletedAt))),
  ])

  // "Has a profile" lives in `cms.mentors.userId`, not in `app.users`, so the
  // real number needs both. An earlier version counted mentors with no
  // `staffRole`, which is a different question entirely and answered it wrong.
  const mentorsWaiting = canAccessArea(staff.staffRole, 'mentors')
    ? await countMentorsAwaitingProfile(mentorsOnboarded?.value ?? 0)
    : 0

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
      count: mentorsWaiting,
      href: '/admin/mentors',
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
