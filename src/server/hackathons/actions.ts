'use server'

import { and, count, desc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  hackathonEvents,
  hackathonRegistrations,
  hackathonTeamMembers,
  hackathonTeams,
  hackathonSubmissions,
  hackathonAnnouncements,
  hackathonCommunityVotes,
  hackathonJudgeAssignments,
  hackathonScores,
} from '@/db/schema'
import { requireUserOrThrow } from '@/server/auth/guards'
import { sanitizeSubmissionUrl } from './url-sanitize'
import { enforceRateLimit, RATE_LIMITS } from '@/server/security/rate-limit'

export type ActionResult = { ok: true } | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Read — public
// ---------------------------------------------------------------------------

/** List all hackathons visible on the public hub (not draft, not archived). */
export async function listPublicHackathons() {
  return db.query.hackathonEvents.findMany({
    where: and(
      ne(hackathonEvents.status, 'draft'),
      ne(hackathonEvents.status, 'archived'),
    ),
    columns: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      bannerImageKey: true,
      status: true,
      registrationsOpenAt: true,
      registrationsCloseAt: true,
      submissionsCloseAt: true,
      prizePoolSummary: true,
      tracks: true,
      minTeamSize: true,
      maxTeamSize: true,
      allowSolo: true,
      galleryPublic: true,
      communityVotingEnabled: true,
    },
    orderBy: [desc(hackathonEvents.registrationsOpenAt)],
  })
}

/** Get a single hackathon by slug. */
export async function getHackathonBySlug(slug: string) {
  return db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.slug, slug),
    columns: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      description: true,
      bannerImageKey: true,
      status: true,
      minTeamSize: true,
      maxTeamSize: true,
      allowSolo: true,
      registrationsOpenAt: true,
      registrationsCloseAt: true,
      submissionsOpenAt: true,
      submissionsCloseAt: true,
      prizePoolSummary: true,
      tracks: true,
      judgingCriteria: true,
      galleryPublic: true,
      communityVotingEnabled: true,
      // Never expose webhook secrets to the client.
      discordWebhookUrl: false,
      telegramBotToken: false,
      telegramChatId: false,
    },
  })
}

/** Count registered participants for a hackathon (public). */
export async function countRegistrations(hackathonId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(hackathonRegistrations)
    .where(eq(hackathonRegistrations.hackathonId, hackathonId))
  return row?.value ?? 0
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Register the signed-in user for a hackathon. Idempotent. */
export async function registerForHackathon(
  hackathonId: string,
  opts: { selectedTracks?: string[]; lookingForTeam?: boolean; skills?: string[] } = {},
): Promise<ActionResult> {
  const user = await requireUserOrThrow()
  await enforceRateLimit(user.id, RATE_LIMITS.applicationStart)

  // Check hackathon exists and is accepting registrations.
  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: { id: true, status: true, registrationsCloseAt: true },
  })
  if (!hackathon) return { ok: false, error: 'Hackathon not found.' }
  if (hackathon.status === 'draft' || hackathon.status === 'archived') {
    return { ok: false, error: 'Registrations are not open for this hackathon.' }
  }
  if (hackathon.registrationsCloseAt && hackathon.registrationsCloseAt < new Date()) {
    return { ok: false, error: 'Registrations have closed for this hackathon.' }
  }

  // Idempotent insert.
  await db
    .insert(hackathonRegistrations)
    .values({
      hackathonId,
      userId: user.id,
      selectedTracks: opts.selectedTracks ?? [],
      lookingForTeam: opts.lookingForTeam ?? false,
      skills: opts.skills ?? [],
    })
    .onConflictDoNothing()

  return { ok: true }
}

/** Check whether the signed-in user is registered for a hackathon. */
export async function getMyRegistration(hackathonId: string) {
  const user = await requireUserOrThrow()
  return db.query.hackathonRegistrations.findFirst({
    where: and(
      eq(hackathonRegistrations.hackathonId, hackathonId),
      eq(hackathonRegistrations.userId, user.id),
    ),
  })
}

// ---------------------------------------------------------------------------
// Teams — discovery
// ---------------------------------------------------------------------------

/** List teams actively recruiting (lookingForMembers = true). */
export async function listOpenTeams(hackathonId: string) {
  return db.query.hackathonTeams.findMany({
    where: and(
      eq(hackathonTeams.hackathonId, hackathonId),
      eq(hackathonTeams.lookingForMembers, true),
    ),
    with: {
      leader: { columns: { id: true, name: true, image: true } },
      members: {
        with: { user: { columns: { id: true, name: true, image: true } } },
      },
    },
    orderBy: [desc(hackathonTeams.createdAt)],
  })
}

/** Get the signed-in user's team for a hackathon (if any). */
export async function getMyTeam(hackathonId: string) {
  const user = await requireUserOrThrow()
  const membership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
    ),
    with: {
      team: {
        with: {
          members: {
            with: { user: { columns: { id: true, name: true, image: true, skills: true } } },
          },
        },
      },
    },
  })
  return membership?.team ?? null
}

// ---------------------------------------------------------------------------
// Teams — mutations
// ---------------------------------------------------------------------------

/** Generate a 6-char alphanumeric join code unique within the hackathon. */
async function generateJoinCode(hackathonId: string): Promise<string> {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from(
      { length: 6 },
      () => CHARS[Math.floor(Math.random() * CHARS.length)],
    ).join('')
    const existing = await db.query.hackathonTeams.findFirst({
      where: and(
        eq(hackathonTeams.hackathonId, hackathonId),
        eq(hackathonTeams.joinCode, code),
      ),
      columns: { id: true },
    })
    if (!existing) return code
  }
  throw new Error('Could not generate a unique join code after 10 attempts.')
}

export async function createTeam(
  hackathonId: string,
  opts: {
    name: string
    selectedTracks?: string[]
    techStack?: string[]
    recruitmentPitch?: string
  },
): Promise<ActionResult & { teamId?: string }> {
  const user = await requireUserOrThrow()
  await enforceRateLimit(user.id, RATE_LIMITS.applicationStart)

  // Must be registered.
  const reg = await db.query.hackathonRegistrations.findFirst({
    where: and(
      eq(hackathonRegistrations.hackathonId, hackathonId),
      eq(hackathonRegistrations.userId, user.id),
    ),
    columns: { id: true },
  })
  if (!reg) return { ok: false, error: 'You must register for this hackathon before creating a team.' }

  // Cannot already be in a team.
  const existingMembership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
    ),
    columns: { id: true },
  })
  if (existingMembership) return { ok: false, error: 'You are already on a team for this hackathon.' }

  const name = opts.name.trim()
  if (!name || name.length < 2) return { ok: false, error: 'Team name must be at least 2 characters.' }
  if (name.length > 60) return { ok: false, error: 'Team name must be 60 characters or fewer.' }

  const joinCode = await generateJoinCode(hackathonId)

  const [team] = await db
    .insert(hackathonTeams)
    .values({
      hackathonId,
      name,
      joinCode,
      leaderId: user.id,
      selectedTracks: opts.selectedTracks ?? [],
      techStack: opts.techStack ?? [],
      recruitmentPitch: opts.recruitmentPitch,
    })
    .returning({ id: hackathonTeams.id })

  if (!team) return { ok: false, error: 'Failed to create team.' }

  // Add the creator as leader member.
  await db.insert(hackathonTeamMembers).values({
    teamId: team.id,
    hackathonId,
    userId: user.id,
    role: 'leader',
  })

  return { ok: true, teamId: team.id }
}

export async function joinTeamByCode(
  hackathonId: string,
  joinCode: string,
): Promise<ActionResult> {
  const user = await requireUserOrThrow()
  await enforceRateLimit(user.id, RATE_LIMITS.applicationStart)

  const team = await db.query.hackathonTeams.findFirst({
    where: and(
      eq(hackathonTeams.hackathonId, hackathonId),
      eq(hackathonTeams.joinCode, joinCode.toUpperCase().trim()),
    ),
    with: { members: { columns: { userId: true } } },
  })
  if (!team) return { ok: false, error: 'Invalid join code. Check the code and try again.' }

  // Check hackathon max team size.
  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: { maxTeamSize: true },
  })
  if (!hackathon) return { ok: false, error: 'Hackathon not found.' }
  if (team.members.length >= hackathon.maxTeamSize) {
    return { ok: false, error: 'This team is already at the maximum size.' }
  }

  // Must be registered.
  const reg = await db.query.hackathonRegistrations.findFirst({
    where: and(
      eq(hackathonRegistrations.hackathonId, hackathonId),
      eq(hackathonRegistrations.userId, user.id),
    ),
    columns: { id: true },
  })
  if (!reg) return { ok: false, error: 'You must register for this hackathon before joining a team.' }

  // Cannot already be in a team (unique index enforces this too, but give a nicer error).
  const existingMembership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
    ),
    columns: { id: true },
  })
  if (existingMembership) return { ok: false, error: 'You are already on a team for this hackathon.' }

  await db.insert(hackathonTeamMembers).values({
    teamId: team.id,
    hackathonId,
    userId: user.id,
    role: 'member',
  })

  return { ok: true }
}

export async function disbandTeam(hackathonId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const membership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
    ),
    with: { team: { columns: { id: true, leaderId: true } } },
  })
  if (!membership) return { ok: false, error: 'You are not on a team for this hackathon.' }
  if (membership.role !== 'leader') {
    return { ok: false, error: 'Only the team leader can disband the team.' }
  }

  // Check if team has already submitted a final submission
  const sub = await db.query.hackathonSubmissions.findFirst({
    where: and(
      eq(hackathonSubmissions.hackathonId, hackathonId),
      eq(hackathonSubmissions.teamId, membership.team.id),
    ),
    columns: { id: true, status: true },
  })
  if (sub?.status === 'submitted') {
    return { ok: false, error: 'Cannot disband a team with a finalized submission.' }
  }

  if (sub) {
    await db.delete(hackathonSubmissions).where(eq(hackathonSubmissions.id, sub.id))
  }

  await db
    .delete(hackathonTeamMembers)
    .where(eq(hackathonTeamMembers.teamId, membership.team.id))

  await db
    .delete(hackathonTeams)
    .where(eq(hackathonTeams.id, membership.team.id))

  return { ok: true }
}

export async function transferLeadership(
  hackathonId: string,
  newLeaderUserId: string,
): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const currentMembership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
    ),
    with: { team: { columns: { id: true, leaderId: true } } },
  })
  if (!currentMembership || currentMembership.role !== 'leader') {
    return { ok: false, error: 'Only the current team leader can transfer leadership.' }
  }

  const targetMembership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.teamId, currentMembership.team.id),
      eq(hackathonTeamMembers.userId, newLeaderUserId),
    ),
    columns: { id: true },
  })
  if (!targetMembership) {
    return { ok: false, error: 'The new leader must be an existing member of your team.' }
  }

  await db
    .update(hackathonTeamMembers)
    .set({ role: 'leader' })
    .where(eq(hackathonTeamMembers.id, targetMembership.id))

  await db
    .update(hackathonTeamMembers)
    .set({ role: 'member' })
    .where(eq(hackathonTeamMembers.id, currentMembership.id))

  await db
    .update(hackathonTeams)
    .set({ leaderId: newLeaderUserId })
    .where(eq(hackathonTeams.id, currentMembership.team.id))

  return { ok: true }
}

export async function leaveTeam(hackathonId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const membership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
    ),
    with: { team: { columns: { id: true, leaderId: true } } },
  })
  if (!membership) return { ok: false, error: 'You are not on a team for this hackathon.' }

  if (membership.role === 'leader') {
    const otherMembers = await db.query.hackathonTeamMembers.findMany({
      where: and(
        eq(hackathonTeamMembers.teamId, membership.team.id),
        ne(hackathonTeamMembers.userId, user.id),
      ),
      columns: { id: true },
    })
    if (otherMembers.length === 0) {
      // Solo leader: automatically disband the team cleanly
      return disbandTeam(hackathonId)
    }
    return {
      ok: false,
      error:
        'Team leaders cannot leave while other members are in the team. Transfer leadership or disband the team.',
    }
  }

  await db
    .delete(hackathonTeamMembers)
    .where(
      and(
        eq(hackathonTeamMembers.hackathonId, hackathonId),
        eq(hackathonTeamMembers.userId, user.id),
      ),
    )

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

/** Get draft or submitted submission for the current user's team. */
export async function getTeamSubmission(teamId: string) {
  return db.query.hackathonSubmissions.findFirst({
    where: eq(hackathonSubmissions.teamId, teamId),
  })
}

/** Save (upsert) a submission draft. */
export async function saveSubmissionDraft(
  hackathonId: string,
  teamId: string,
  data: {
    projectTitle?: string
    tagline?: string
    description?: string
    repoUrl?: string
    demoUrl?: string
    videoUrl?: string
    figmaUrl?: string
    techStack?: string[]
    selectedTracks?: string[]
  },
): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  // Verify user is on this team.
  const membership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
      eq(hackathonTeamMembers.teamId, teamId),
    ),
    columns: { id: true },
  })
  if (!membership) return { ok: false, error: 'You are not a member of this team.' }

  // Check for existing submission.
  const existing = await db.query.hackathonSubmissions.findFirst({
    where: and(
      eq(hackathonSubmissions.hackathonId, hackathonId),
      eq(hackathonSubmissions.teamId, teamId),
    ),
    columns: { id: true, status: true },
  })

  if (existing?.status === 'submitted') {
    return { ok: false, error: 'Your submission has already been submitted and cannot be edited.' }
  }

  const payload = {
    hackathonId,
    teamId,
    projectTitle: data.projectTitle ?? '',
    tagline: data.tagline ?? '',
    description: data.description ?? '',
    repoUrl: sanitizeSubmissionUrl(data.repoUrl),
    demoUrl: sanitizeSubmissionUrl(data.demoUrl),
    videoUrl: sanitizeSubmissionUrl(data.videoUrl),
    figmaUrl: sanitizeSubmissionUrl(data.figmaUrl),
    techStack: data.techStack ?? [],
    selectedTracks: data.selectedTracks ?? [],
    updatedAt: new Date(),
  }

  if (existing) {
    await db
      .update(hackathonSubmissions)
      .set(payload)
      .where(eq(hackathonSubmissions.id, existing.id))
  } else {
    await db.insert(hackathonSubmissions).values(payload)
  }

  return { ok: true }
}

/** Finalize a submission. Only possible during the building phase. */
export async function submitProject(
  hackathonId: string,
  teamId: string,
): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: { status: true, submissionsCloseAt: true },
  })
  if (!hackathon) return { ok: false, error: 'Hackathon not found.' }
  if (hackathon.status !== 'building') {
    return { ok: false, error: 'Submissions are not currently open for this hackathon.' }
  }
  if (hackathon.submissionsCloseAt && hackathon.submissionsCloseAt < new Date()) {
    return { ok: false, error: 'The submission deadline has passed.' }
  }

  const membership = await db.query.hackathonTeamMembers.findFirst({
    where: and(
      eq(hackathonTeamMembers.hackathonId, hackathonId),
      eq(hackathonTeamMembers.userId, user.id),
      eq(hackathonTeamMembers.teamId, teamId),
    ),
    columns: { id: true },
  })
  if (!membership) return { ok: false, error: 'You are not a member of this team.' }

  const submission = await db.query.hackathonSubmissions.findFirst({
    where: and(
      eq(hackathonSubmissions.hackathonId, hackathonId),
      eq(hackathonSubmissions.teamId, teamId),
    ),
    columns: { id: true, status: true, projectTitle: true, repoUrl: true },
  })
  if (!submission) return { ok: false, error: 'Save a draft first before submitting.' }
  if (submission.status === 'submitted') return { ok: false, error: 'Already submitted.' }
  if (!submission.projectTitle?.trim()) {
    return { ok: false, error: 'Project title is required before submitting.' }
  }
  if (!submission.repoUrl?.trim()) {
    return { ok: false, error: 'Repository URL is required before submitting.' }
  }

  await db
    .update(hackathonSubmissions)
    .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(hackathonSubmissions.id, submission.id))

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Gallery — public submissions
// ---------------------------------------------------------------------------

export async function listGallerySubmissions(hackathonId: string) {
  // Only return submitted projects for public gallery.
  return db.query.hackathonSubmissions.findMany({
    where: and(
      eq(hackathonSubmissions.hackathonId, hackathonId),
      eq(hackathonSubmissions.status, 'submitted'),
    ),
    with: {
      team: {
        with: {
          members: { with: { user: { columns: { id: true, name: true, image: true } } } },
        },
        columns: { id: true, name: true, selectedTracks: true, techStack: true },
      },
      communityVotes: { columns: { id: true } },
    },
    columns: {
      id: true,
      projectTitle: true,
      tagline: true,
      description: true,
      repoUrl: true,
      demoUrl: true,
      videoUrl: true,
      techStack: true,
      selectedTracks: true,
      coverImageKey: true,
      submittedAt: true,
    },
  })
}

// ---------------------------------------------------------------------------
// Community votes
// ---------------------------------------------------------------------------

export async function toggleCommunityVote(
  hackathonId: string,
  submissionId: string,
): Promise<ActionResult & { voted?: boolean }> {
  const user = await requireUserOrThrow()
  await enforceRateLimit(user.id, RATE_LIMITS.applicationStart)

  // Verify hackathon has voting enabled and is completed.
  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: { communityVotingEnabled: true, status: true },
  })
  if (!hackathon?.communityVotingEnabled) {
    return { ok: false, error: 'Community voting is not enabled for this hackathon.' }
  }

  // No voting for own team's submission.
  const submission = await db.query.hackathonSubmissions.findFirst({
    where: eq(hackathonSubmissions.id, submissionId),
    with: { team: { with: { members: { columns: { userId: true } } } } },
    columns: { id: true },
  })
  if (!submission) return { ok: false, error: 'Submission not found.' }
  const onTeam = submission.team?.members.some((m) => m.userId === user.id)
  if (onTeam) return { ok: false, error: 'You cannot vote for your own team\'s submission.' }

  const existing = await db.query.hackathonCommunityVotes.findFirst({
    where: and(
      eq(hackathonCommunityVotes.submissionId, submissionId),
      eq(hackathonCommunityVotes.userId, user.id),
    ),
    columns: { id: true },
  })

  if (existing) {
    await db.delete(hackathonCommunityVotes).where(eq(hackathonCommunityVotes.id, existing.id))
    return { ok: true, voted: false }
  }

  await db.insert(hackathonCommunityVotes).values({
    submissionId,
    hackathonId,
    userId: user.id,
  })
  return { ok: true, voted: true }
}

// ---------------------------------------------------------------------------
// Announcements — read
// ---------------------------------------------------------------------------

export async function listAnnouncements(hackathonId: string) {
  return db.query.hackathonAnnouncements.findMany({
    where: eq(hackathonAnnouncements.hackathonId, hackathonId),
    with: { author: { columns: { id: true, name: true } } },
    orderBy: [desc(hackathonAnnouncements.createdAt)],
    limit: 20,
  })
}

// ---------------------------------------------------------------------------
// Judge console — read
// ---------------------------------------------------------------------------

export async function getMyJudgeQueue(hackathonId: string) {
  const user = await requireUserOrThrow()

  const assignments = await db.query.hackathonJudgeAssignments.findMany({
    where: and(
      eq(hackathonJudgeAssignments.hackathonId, hackathonId),
      eq(hackathonJudgeAssignments.judgeUserId, user.id),
    ),
    with: {
      submission: {
        with: {
          team: { columns: { id: true, name: true } },
          scores: {
            where: eq(hackathonScores.judgeUserId, user.id),
          },
        },
      },
    },
  })
  return assignments
}

/** Submit/update scores for one submission from the current judge. */
export async function submitJudgeScores(
  hackathonId: string,
  submissionId: string,
  scores: { criterionId: string; score: number; notes?: string }[],
): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  // Validate score range.
  for (const s of scores) {
    if (s.score < 1 || s.score > 10 || !Number.isInteger(s.score)) {
      return { ok: false, error: 'Scores must be integers between 1 and 10.' }
    }
  }

  // Verify judge assignment.
  const assignment = await db.query.hackathonJudgeAssignments.findFirst({
    where: and(
      eq(hackathonJudgeAssignments.hackathonId, hackathonId),
      eq(hackathonJudgeAssignments.submissionId, submissionId),
      eq(hackathonJudgeAssignments.judgeUserId, user.id),
    ),
    columns: { id: true },
  })
  if (!assignment) return { ok: false, error: 'You are not assigned to judge this submission.' }

  // Upsert each criterion score.
  for (const s of scores) {
    await db
      .insert(hackathonScores)
      .values({
        submissionId,
        judgeUserId: user.id,
        hackathonId,
        criterionId: s.criterionId,
        score: s.score,
        notes: s.notes,
      })
      .onConflictDoUpdate({
        target: [
          hackathonScores.submissionId,
          hackathonScores.judgeUserId,
          hackathonScores.criterionId,
        ],
        set: { score: s.score, notes: s.notes ?? null, updatedAt: new Date() },
      })
  }

  return { ok: true }
}

