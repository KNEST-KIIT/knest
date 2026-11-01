import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  hackathonAnnouncements,
  hackathonEvents,
  hackathonJudgeAssignments,
  hackathonRegistrations,
  hackathonSubmissions,
  notifications,
  users,
} from '@/db/schema'
import { requireUserOrThrow } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { dispatchHackathonWebhook } from './webhooks'

export type ActionResult = { ok: true } | { ok: false; error: string }

function requireOrganizerOrStaff(user: { staffRole: StaffRole | null }) {
  if (user.staffRole !== 'super_admin' && user.staffRole !== 'program_manager') {
    throw new Error('Access denied: hackathon management requires program_manager or super_admin.')
  }
}

/**
 * Create or update a hackathon event.
 */
export async function upsertHackathonEvent(data: {
  id?: string
  slug: string
  title: string
  tagline?: string
  description?: string
  status?: 'draft' | 'open' | 'building' | 'judging' | 'completed' | 'archived'
  minTeamSize?: number
  maxTeamSize?: number
  allowSolo?: boolean
  registrationsOpenAt?: Date | null
  registrationsCloseAt?: Date | null
  submissionsOpenAt?: Date | null
  submissionsCloseAt?: Date | null
  prizePoolSummary?: string
  tracks?: { id: string; name: string; description: string; prize?: string }[]
  judgingCriteria?: { id: string; name: string; weight: number; description: string }[]
  discordWebhookUrl?: string
  telegramBotToken?: string
  telegramChatId?: string
  galleryPublic?: boolean
  communityVotingEnabled?: boolean
}): Promise<ActionResult & { id?: string }> {
  const user = await requireUserOrThrow()
  requireOrganizerOrStaff(user)

  // Validate criteria weights sum to 100 if present
  if (data.judgingCriteria && data.judgingCriteria.length > 0) {
    const totalWeight = data.judgingCriteria.reduce((sum, c) => sum + c.weight, 0)
    if (totalWeight !== 100) {
      return { ok: false, error: `Judging criteria weights must sum to 100% (currently ${totalWeight}%).` }
    }
  }

  const payload = {
    slug: data.slug.trim().toLowerCase(),
    title: data.title.trim(),
    tagline: data.tagline?.trim(),
    description: data.description?.trim(),
    organizerId: user.id,
    status: data.status ?? 'draft',
    minTeamSize: data.minTeamSize ?? 1,
    maxTeamSize: data.maxTeamSize ?? 4,
    allowSolo: data.allowSolo ?? true,
    registrationsOpenAt: data.registrationsOpenAt ?? null,
    registrationsCloseAt: data.registrationsCloseAt ?? null,
    submissionsOpenAt: data.submissionsOpenAt ?? null,
    submissionsCloseAt: data.submissionsCloseAt ?? null,
    prizePoolSummary: data.prizePoolSummary?.trim(),
    tracks: data.tracks ?? [],
    judgingCriteria: data.judgingCriteria ?? [],
    discordWebhookUrl: data.discordWebhookUrl?.trim() || null,
    telegramBotToken: data.telegramBotToken?.trim() || null,
    telegramChatId: data.telegramChatId?.trim() || null,
    galleryPublic: data.galleryPublic ?? false,
    communityVotingEnabled: data.communityVotingEnabled ?? false,
    updatedAt: new Date(),
  }

  if (data.id) {
    await db.update(hackathonEvents).set(payload).where(eq(hackathonEvents.id, data.id))
    return { ok: true, id: data.id }
  } else {
    const [inserted] = await db
      .insert(hackathonEvents)
      .values({ ...payload, organizerId: user.id })
      .returning({ id: hackathonEvents.id })
    if (!inserted) return { ok: false, error: 'Failed to create hackathon.' }
    return { ok: true, id: inserted.id }
  }
}

/**
 * Publish an announcement, notify participants, and dispatch webhooks.
 */
export async function createAndDispatchAnnouncement(
  hackathonId: string,
  data: {
    title: string
    body: string
    type: 'info' | 'success' | 'warning' | 'deadline' | 'winner'
    sendEmail?: boolean
  },
): Promise<ActionResult & { announcementId?: string }> {
  const user = await requireUserOrThrow()
  requireOrganizerOrStaff(user)

  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: { id: true, title: true, slug: true },
  })
  if (!hackathon) return { ok: false, error: 'Hackathon not found.' }

  // 1. Insert announcement row
  const [announcement] = await db
    .insert(hackathonAnnouncements)
    .values({
      hackathonId,
      authorId: user.id,
      title: data.title.trim(),
      body: data.body.trim(),
      type: data.type,
      emailSent: data.sendEmail ?? false,
    })
    .returning({ id: hackathonAnnouncements.id })

  if (!announcement) return { ok: false, error: 'Failed to create announcement.' }

  // 2. Fetch all registered users to broadcast in-app notifications
  const registrations = await db.query.hackathonRegistrations.findMany({
    where: eq(hackathonRegistrations.hackathonId, hackathonId),
    columns: { userId: true },
  })

  if (registrations.length > 0) {
    const notificationRows = registrations.map((r) => ({
      userId: r.userId,
      type: 'hackathon_result_announced' as const,
      title: `${hackathon.title}: ${data.title}`,
      body: data.body.slice(0, 200),
      href: `/hackathons/${hackathon.slug}`,
    }))

    // Bulk insert in chunks of 50 to avoid parameter limits
    for (let i = 0; i < notificationRows.length; i += 50) {
      await db.insert(notifications).values(notificationRows.slice(i, i + 50))
    }
  }

  // 3. Dispatch webhooks asynchronously
  await dispatchHackathonWebhook(
    hackathonId,
    {
      title: data.title,
      body: data.body,
      type: data.type,
      hackathonTitle: hackathon.title,
      hackathonSlug: hackathon.slug,
      actionUrl: `${process.env.NEXTAUTH_URL || 'https://kiitnest.com'}/hackathons/${hackathon.slug}`,
    },
    announcement.id,
  )

  return { ok: true, announcementId: announcement.id }
}

/**
 * Assign a judge to a list of submissions.
 */
export async function assignJudge(
  hackathonId: string,
  judgeUserId: string,
  submissionIds: string[],
): Promise<ActionResult> {
  const user = await requireUserOrThrow()
  requireOrganizerOrStaff(user)

  // Verify the target user exists
  const judge = await db.query.users.findFirst({
    where: eq(users.id, judgeUserId),
    columns: { id: true, name: true },
  })
  if (!judge) return { ok: false, error: 'Judge user not found.' }

  for (const submissionId of submissionIds) {
    await db
      .insert(hackathonJudgeAssignments)
      .values({
        hackathonId,
        judgeUserId,
        submissionId,
      })
      .onConflictDoNothing()
  }

  return { ok: true }
}

/**
 * Calculate the full judging leaderboard with criteria weights and judge averages.
 */
export async function getHackathonLeaderboard(hackathonId: string) {
  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: { id: true, title: true, judgingCriteria: true },
  })
  if (!hackathon) throw new Error('Hackathon not found.')

  const criteriaMap = new Map<string, number>()
  for (const c of hackathon.judgingCriteria) {
    criteriaMap.set(c.id, c.weight)
  }

  // Fetch all submitted projects
  const submissions = await db.query.hackathonSubmissions.findMany({
    where: and(
      eq(hackathonSubmissions.hackathonId, hackathonId),
      eq(hackathonSubmissions.status, 'submitted'),
    ),
    with: {
      team: {
        with: {
          members: {
            with: { user: { columns: { id: true, name: true, image: true } } },
          },
        },
      },
      scores: true,
      communityVotes: { columns: { id: true } },
    },
  })

  // Compute weighted score for each submission
  const results = submissions.map((sub) => {
    // Group scores by criterion
    const scoresByCriterion = new Map<string, number[]>()
    for (const scoreRow of sub.scores) {
      const list = scoresByCriterion.get(scoreRow.criterionId) ?? []
      list.push(scoreRow.score)
      scoresByCriterion.set(scoreRow.criterionId, list)
    }

    let totalWeightedScore = 0
    const criteriaBreakdown: { criterionId: string; avgScore: number; weight: number }[] = []

    for (const criterion of hackathon.judgingCriteria) {
      const scores = scoresByCriterion.get(criterion.id) ?? []
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      const weightedContribution = (avg * criterion.weight) / 10 // score is 1-10, normalized
      totalWeightedScore += weightedContribution
      criteriaBreakdown.push({
        criterionId: criterion.id,
        avgScore: Math.round(avg * 10) / 10,
        weight: criterion.weight,
      })
    }

    return {
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      tagline: sub.tagline,
      repoUrl: sub.repoUrl,
      demoUrl: sub.demoUrl,
      videoUrl: sub.videoUrl,
      teamName: sub.team.name,
      teamMembers: sub.team.members.map((m) => m.user.name ?? 'Member'),
      selectedTracks: sub.selectedTracks,
      communityVoteCount: sub.communityVotes.length,
      judgesCount: new Set(sub.scores.map((s) => s.judgeUserId)).size,
      totalWeightedScore: Math.round(totalWeightedScore * 10) / 10,
      criteriaBreakdown,
    }
  })

  // Sort descending by weighted score, break ties by community votes
  results.sort((a, b) => {
    if (b.totalWeightedScore !== a.totalWeightedScore) {
      return b.totalWeightedScore - a.totalWeightedScore
    }
    return b.communityVoteCount - a.communityVoteCount
  })

  return results
}
