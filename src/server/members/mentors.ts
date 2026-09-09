'use server'

import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireAdminArea } from '@/server/auth/guards'
import { getContentClient } from '@/server/content/payload-client'

/**
 * Mentors who finished signing up and have no public profile yet.
 *
 * The product already makes this promise. Onboarding tells a mentor "your
 * profile is with our team", and `USER_JOURNEYS.md:172` says staff review it.
 * Nothing anywhere listed that queue, so the promise had nobody keeping it: a
 * mentor could sign up, be told they were being reviewed, and wait
 * indefinitely while no screen existed that would have shown them to anyone.
 *
 * "Has a profile" is `cms.mentors.userId`, the same link the mentor dashboard
 * uses to find their own public page — not a name match, which would silently
 * skip anyone who signed up as "Dr A. Mishra" and was published as "Anjali
 * Mishra".
 */
export async function listMentorsAwaitingProfile() {
  await requireAdminArea('mentors')

  const signups = await db.query.users.findMany({
    where: and(
      eq(users.platformRole, 'mentor'),
      isNotNull(users.onboardingCompletedAt),
      eq(users.isActive, true),
    ),
    columns: {
      id: true,
      name: true,
      email: true,
      school: true,
      createdAt: true,
      onboardingCompletedAt: true,
    },
    orderBy: [desc(users.createdAt)],
    limit: 200,
  })
  if (signups.length === 0) return { awaiting: [], published: [] }

  // One query for every linked profile rather than one per mentor.
  const payload = await getContentClient()
  const profiles = await payload.find({
    collection: 'mentors',
    depth: 0,
    limit: 500,
    overrideAccess: false,
    where: { userId: { in: signups.map((mentor) => mentor.id) } },
  })
  const linked = new Set(profiles.docs.map((doc) => doc.userId).filter(Boolean) as string[])

  return {
    awaiting: signups.filter((mentor) => !linked.has(mentor.id)),
    published: signups.filter((mentor) => linked.has(mentor.id)),
  }
}
