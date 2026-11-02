import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
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
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { isDiscordWebhookUrl, isTelegramBotToken, isTelegramChatId } from './webhook-safety'
import { dispatchHackathonWebhook } from './webhooks'

export type ActionResult = { ok: true } | { ok: false; error: string }

function requireOrganizerOrStaff(user: { staffRole: StaffRole | null }) {
  if (user.staffRole !== 'super_admin' && user.staffRole !== 'program_manager') {
    // A 403 the caller can answer with, not an anonymous Error that surfaces as a 500.
    throw new UnauthorizedError(403)
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Why a hackathon's settings cannot be saved, or null. One message, for the organiser to read. */
export function hackathonProblem(data: {
  slug: string
  title: string
  minTeamSize?: number
  maxTeamSize?: number
  registrationsOpenAt?: Date | null
  registrationsCloseAt?: Date | null
  submissionsOpenAt?: Date | null
  submissionsCloseAt?: Date | null
  discordWebhookUrl?: string
  telegramBotToken?: string
  telegramChatId?: string
}): string | null {
  const slug = data.slug.trim().toLowerCase()
  if (!SLUG.test(slug) || slug.length > 80) return 'The address (slug) may use lowercase letters, numbers and single hyphens, up to 80 characters.'
  if (!data.title.trim() || data.title.trim().length > 160) return 'Give the hackathon a title of up to 160 characters.'
  const min = data.minTeamSize ?? 1
  const max = data.maxTeamSize ?? 4
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 50) return 'Team size must be whole numbers, with the smallest at least 1 and no larger than the largest.'
  const ordered = (a?: Date | null, b?: Date | null) => !a || !b || a.getTime() < b.getTime()
  if (!ordered(data.registrationsOpenAt, data.registrationsCloseAt)) return 'Registrations must close after they open.'
  if (!ordered(data.submissionsOpenAt, data.submissionsCloseAt)) return 'Submissions must close after they open.'
  const discord = data.discordWebhookUrl?.trim()
  if (discord && !isDiscordWebhookUrl(discord)) return 'That is not a Discord webhook address (https://discord.com/api/webhooks/...).'
  const token = data.telegramBotToken?.trim()
  const chat = data.telegramChatId?.trim()
  if ((token || chat) && !(token && chat)) return 'Telegram needs both a bot token and a chat id.'
  if (token && !isTelegramBotToken(token)) return 'That does not look like a Telegram bot token.'
  if (chat && !isTelegramChatId(chat)) return 'That does not look like a Telegram chat id.'
  return null
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

  const problem = hackathonProblem(data)
  if (problem) return { ok: false, error: problem }

  // Validate criteria weights sum to 100 if present
  if (data.judgingCriteria && data.judgingCriteria.length > 0) {
    const totalWeight = data.judgingCriteria.reduce((sum, c) => sum + c.weight, 0)
    if (totalWeight !== 100) {
      return { ok: false, error: `Judging criteria weights must sum to 100% (currently ${totalWeight}%).` }
    }
  }

  // organizerId is not part of an edit: whoever saves a hackathon must not take it over from its organiser.
  const payload = {
    slug: data.slug.trim().toLowerCase(),
    title: data.title.trim(),
    tagline: data.tagline?.trim(),
    description: data.description?.trim(),
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

  try {
    if (data.id) {
      const updated = await db.update(hackathonEvents).set(payload).where(eq(hackathonEvents.id, data.id)).returning({ id: hackathonEvents.id })
      if (updated.length === 0) return { ok: false, error: 'That hackathon no longer exists.' }
      return { ok: true, id: data.id }
    }
    const [inserted] = await db
      .insert(hackathonEvents)
      .values({ ...payload, organizerId: user.id })
      .returning({ id: hackathonEvents.id })
    if (!inserted) return { ok: false, error: 'Failed to create hackathon.' }
    return { ok: true, id: inserted.id }
  } catch (error) {
    // The slug is unique; saying so is better than an error page.
    const e = error as { code?: string; cause?: { code?: string } } | null
    if (e?.code === '23505' || e?.cause?.code === '23505') return { ok: false, error: 'Another hackathon already uses that address (slug). Choose a different one.' }
    throw error
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

  const title = data.title?.trim() ?? ''
  const body = data.body?.trim() ?? ''
  if (!title || title.length > 160) return { ok: false, error: 'Give the announcement a title of up to 160 characters.' }
  if (!body || body.length > 4000) return { ok: false, error: 'Write a message of up to 4000 characters.' }
  if (!['info', 'success', 'warning', 'deadline', 'winner'].includes(data.type)) return { ok: false, error: 'Choose an announcement type.' }

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
      title,
      body,
      type: data.type,
      // No e-mail is sent from here yet, so the row must not claim one was.
      emailSent: false,
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

  // Verify the target user exists and can sign in
  const judge = await db.query.users.findFirst({
    where: eq(users.id, judgeUserId),
    columns: { id: true, name: true, isActive: true },
  })
  if (!judge || !judge.isActive) return { ok: false, error: 'Judge user not found.' }

  // Every submission must belong to THIS hackathon: the ids come from the caller, and an assignment under the
  // wrong event would let a judge score work that is not part of it.
  const ids = [...new Set(submissionIds)]
  if (ids.length === 0 || ids.length > 200) return { ok: false, error: 'Choose between 1 and 200 submissions.' }
  const owned = await db.query.hackathonSubmissions.findMany({
    where: and(eq(hackathonSubmissions.hackathonId, hackathonId), inArray(hackathonSubmissions.id, ids)),
    columns: { id: true },
  })
  if (owned.length !== ids.length) return { ok: false, error: 'One of those submissions does not belong to this hackathon.' }

  for (const submissionId of ids) {
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
  // Scores before the results are announced are the organisers' to see, not the public's.
  const user = await requireUserOrThrow()
  requireOrganizerOrStaff(user)
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
