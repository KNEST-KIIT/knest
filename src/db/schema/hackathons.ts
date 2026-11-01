import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { appSchema } from './enums'
import { users } from './users'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Hackathon lifecycle. Organizer-controlled, staff-enforced.
 * draft → open (registrations live) → building (submissions open) →
 * judging → completed → archived
 */
export const hackathonStatus = appSchema.enum('hackathon_status', [
  'draft',
  'open',
  'building',
  'judging',
  'completed',
  'archived',
])

export const teamMemberRole = appSchema.enum('team_member_role', ['leader', 'member'])

export const announcementType = appSchema.enum('hackathon_announcement_type', [
  'info',
  'success',
  'warning',
  'deadline',
  'winner',
])

export const submissionStatus = appSchema.enum('hackathon_submission_status', [
  'draft',
  'submitted',
  'disqualified',
])

// ---------------------------------------------------------------------------
// hackathon_events  — the root record per hackathon
// ---------------------------------------------------------------------------

/**
 * A hackathon_event is one running hackathon. programId links it to the
 * Payload CMS Programs collection (same pattern as applications — no
 * cross-schema FK, resolved in server/hackathons/actions.ts).
 *
 * slug is human-readable and used in public URLs.
 */
export const hackathonEvents = appSchema.table(
  'hackathon_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Payload CMS Programs collection document id. May be null for standalone hackathons. */
    programId: integer('program_id'),
    /** URL-safe slug, e.g. "kiit-founders-hack-2025". */
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    bannerImageKey: text('banner_image_key'),
    /** Organiser user id — a KNEST staff member (staffRole non-null). */
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: hackathonStatus('status').notNull().default('draft'),
    /** Min/max team sizes. */
    minTeamSize: integer('min_team_size').notNull().default(1),
    maxTeamSize: integer('max_team_size').notNull().default(4),
    /** Whether solo participation (1-person team) is allowed. */
    allowSolo: boolean('allow_solo').notNull().default(true),
    registrationsOpenAt: timestamp('registrations_open_at', { mode: 'date', withTimezone: true }),
    registrationsCloseAt: timestamp('registrations_close_at', {
      mode: 'date',
      withTimezone: true,
    }),
    submissionsOpenAt: timestamp('submissions_open_at', { mode: 'date', withTimezone: true }),
    submissionsCloseAt: timestamp('submissions_close_at', { mode: 'date', withTimezone: true }),
    /** Prize pool description, e.g. "₹1,50,000 total". */
    prizePoolSummary: text('prize_pool_summary'),
    /**
     * Sponsor tracks, e.g. [{ id, name, description, prize }]
     * Stored as jsonb; validated at the application layer.
     */
    tracks: jsonb('tracks')
      .$type<{ id: string; name: string; description: string; prize?: string }[]>()
      .notNull()
      .default([]),
    /**
     * Judging rubric, e.g. [{ id, name, weight, description }]
     * Weights must sum to 100; enforced in server/hackathons/judging.ts.
     */
    judgingCriteria: jsonb('judging_criteria')
      .$type<{ id: string; name: string; weight: number; description: string }[]>()
      .notNull()
      .default([]),
    /**
     * Optional Discord / Telegram / Slack webhook for announcements.
     * Stored encrypted at rest; only written via staff settings, never surfaced to participants.
     */
    discordWebhookUrl: text('discord_webhook_url'),
    telegramBotToken: text('telegram_bot_token'),
    telegramChatId: text('telegram_chat_id'),
    /** Whether the public gallery is visible before results are announced. */
    galleryPublic: boolean('gallery_public').notNull().default(false),
    /** Whether community voting (hearts) is enabled in the gallery. */
    communityVotingEnabled: boolean('community_voting_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('hackathon_events_status_idx').on(table.status),
    index('hackathon_events_program_idx').on(table.programId),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_registrations — one row per participant
// ---------------------------------------------------------------------------

/**
 * A registration links a user to a hackathon. It exists before team formation:
 * a participant registers first, then creates or joins a team.
 */
export const hackathonRegistrations = appSchema.table(
  'hackathon_registrations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Selected tracks (track ids from hackathonEvents.tracks). */
    selectedTracks: text('selected_tracks').array().notNull().default([]),
    /** Whether participant is looking to join or form a team. */
    lookingForTeam: boolean('looking_for_team').notNull().default(false),
    /** Skills the participant brings (free-tags). */
    skills: text('skills').array().notNull().default([]),
    registeredAt: timestamp('registered_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('hackathon_registrations_user_hackathon_idx').on(table.hackathonId, table.userId),
    index('hackathon_registrations_hackathon_idx').on(table.hackathonId),
    index('hackathon_registrations_looking_idx').on(table.hackathonId, table.lookingForTeam),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_teams
// ---------------------------------------------------------------------------

export const hackathonTeams = appSchema.table(
  'hackathon_teams',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** 6-character alphanumeric join code — generated on creation. */
    joinCode: text('join_code').notNull(),
    /** User id of the team leader. */
    leaderId: text('leader_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Selected tracks (subset of hackathon's tracks). */
    selectedTracks: text('selected_tracks').array().notNull().default([]),
    /** Tech stack tags e.g. ["React", "Python", "IoT"]. */
    techStack: text('tech_stack').array().notNull().default([]),
    /** Whether the team is actively recruiting members. */
    lookingForMembers: boolean('looking_for_members').notNull().default(true),
    /** "What skills does your team need?" — recruiter pitch. */
    recruitmentPitch: text('recruitment_pitch'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('hackathon_teams_hackathon_idx').on(table.hackathonId),
    // Join code is unique per hackathon (not globally — 6 chars would collide at scale).
    uniqueIndex('hackathon_teams_join_code_hackathon_idx').on(table.hackathonId, table.joinCode),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_team_members
// ---------------------------------------------------------------------------

export const hackathonTeamMembers = appSchema.table(
  'hackathon_team_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id')
      .notNull()
      .references(() => hackathonTeams.id, { onDelete: 'cascade' }),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamMemberRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One membership per (user, hackathon) — can't be on two teams.
    uniqueIndex('hackathon_team_members_user_hackathon_idx').on(table.hackathonId, table.userId),
    index('hackathon_team_members_team_idx').on(table.teamId),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_submissions
// ---------------------------------------------------------------------------

/**
 * One submission per team per hackathon. Draft until submitted; once
 * submitted, status can only be updated by staff (disqualified).
 */
export const hackathonSubmissions = appSchema.table(
  'hackathon_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => hackathonTeams.id, { onDelete: 'cascade' }),
    status: submissionStatus('hackathon_submission_status').notNull().default('draft'),
    projectTitle: text('project_title').notNull().default(''),
    tagline: text('tagline').notNull().default(''),
    description: text('description').notNull().default(''),
    /** GitHub / GitLab / Bitbucket repository URL. */
    repoUrl: text('repo_url'),
    /** Live demo or deployed app URL. */
    demoUrl: text('demo_url'),
    /** YouTube / Loom embed URL for demo video. */
    videoUrl: text('video_url'),
    /** Figma or design prototype URL. */
    figmaUrl: text('figma_url'),
    /** Tech stack tags for the submission (may differ from team's declared stack). */
    techStack: text('tech_stack').array().notNull().default([]),
    /** Which sponsor tracks this submission enters. */
    selectedTracks: text('selected_tracks').array().notNull().default([]),
    /** Cover image S3/storage key. */
    coverImageKey: text('cover_image_key'),
    submittedAt: timestamp('submitted_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One submission per team per hackathon.
    uniqueIndex('hackathon_submissions_team_hackathon_idx').on(table.hackathonId, table.teamId),
    index('hackathon_submissions_hackathon_status_idx').on(table.hackathonId, table.status),
    index('hackathon_submissions_hackathon_idx').on(table.hackathonId),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_judge_assignments
// ---------------------------------------------------------------------------

/**
 * Which judge is assigned to which submission. Created by organizers during
 * the judging phase. A judge sees only their assigned queue.
 */
export const hackathonJudgeAssignments = appSchema.table(
  'hackathon_judge_assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id')
      .notNull()
      .references(() => hackathonSubmissions.id, { onDelete: 'cascade' }),
    judgeUserId: text('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // A judge can be assigned the same submission only once.
    uniqueIndex('hackathon_judge_assignments_judge_submission_idx').on(
      table.submissionId,
      table.judgeUserId,
    ),
    index('hackathon_judge_assignments_hackathon_idx').on(table.hackathonId),
    index('hackathon_judge_assignments_judge_idx').on(table.judgeUserId),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_scores — one row per (criterion, judge, submission)
// ---------------------------------------------------------------------------

export const hackathonScores = appSchema.table(
  'hackathon_scores',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text('submission_id')
      .notNull()
      .references(() => hackathonSubmissions.id, { onDelete: 'cascade' }),
    judgeUserId: text('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    /** criterion id from hackathonEvents.judgingCriteria[n].id. */
    criterionId: text('criterion_id').notNull(),
    /** Score 1–10. */
    score: integer('score').notNull(),
    /** Optional qualitative note. */
    notes: text('notes'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One score per (submission, judge, criterion).
    uniqueIndex('hackathon_scores_submission_judge_criterion_idx').on(
      table.submissionId,
      table.judgeUserId,
      table.criterionId,
    ),
    index('hackathon_scores_submission_idx').on(table.submissionId),
    index('hackathon_scores_judge_hackathon_idx').on(table.judgeUserId, table.hackathonId),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_community_votes — one row per (submission, user)
// ---------------------------------------------------------------------------

/**
 * Community (gallery) votes / hearts. Only valid when
 * hackathonEvents.communityVotingEnabled = true and status = 'completed'.
 * One vote per user per submission — cannot vote for own team's submission.
 */
export const hackathonCommunityVotes = appSchema.table(
  'hackathon_community_votes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text('submission_id')
      .notNull()
      .references(() => hackathonSubmissions.id, { onDelete: 'cascade' }),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('hackathon_community_votes_submission_user_idx').on(
      table.submissionId,
      table.userId,
    ),
    index('hackathon_community_votes_submission_idx').on(table.submissionId),
  ],
)

// ---------------------------------------------------------------------------
// hackathon_announcements
// ---------------------------------------------------------------------------

export const hackathonAnnouncements = appSchema.table(
  'hackathon_announcements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    hackathonId: text('hackathon_id')
      .notNull()
      .references(() => hackathonEvents.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: announcementType('hackathon_announcement_type').notNull().default('info'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Whether the Discord / Telegram webhook was dispatched. */
    webhookDispatched: boolean('webhook_dispatched').notNull().default(false),
    webhookDispatchedAt: timestamp('webhook_dispatched_at', { mode: 'date', withTimezone: true }),
    /** Whether the email broadcast was sent to all registered participants. */
    emailSent: boolean('email_sent').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('hackathon_announcements_hackathon_idx').on(table.hackathonId)],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const hackathonEventsRelations = relations(hackathonEvents, ({ one, many }) => ({
  organizer: one(users, { fields: [hackathonEvents.organizerId], references: [users.id] }),
  registrations: many(hackathonRegistrations),
  teams: many(hackathonTeams),
  submissions: many(hackathonSubmissions),
  announcements: many(hackathonAnnouncements),
  judgeAssignments: many(hackathonJudgeAssignments),
  scores: many(hackathonScores),
}))

export const hackathonRegistrationsRelations = relations(hackathonRegistrations, ({ one }) => ({
  hackathon: one(hackathonEvents, {
    fields: [hackathonRegistrations.hackathonId],
    references: [hackathonEvents.id],
  }),
  user: one(users, { fields: [hackathonRegistrations.userId], references: [users.id] }),
}))

export const hackathonTeamsRelations = relations(hackathonTeams, ({ one, many }) => ({
  hackathon: one(hackathonEvents, {
    fields: [hackathonTeams.hackathonId],
    references: [hackathonEvents.id],
  }),
  leader: one(users, { fields: [hackathonTeams.leaderId], references: [users.id] }),
  members: many(hackathonTeamMembers),
  submission: many(hackathonSubmissions),
}))

export const hackathonTeamMembersRelations = relations(hackathonTeamMembers, ({ one }) => ({
  team: one(hackathonTeams, { fields: [hackathonTeamMembers.teamId], references: [hackathonTeams.id] }),
  hackathon: one(hackathonEvents, {
    fields: [hackathonTeamMembers.hackathonId],
    references: [hackathonEvents.id],
  }),
  user: one(users, { fields: [hackathonTeamMembers.userId], references: [users.id] }),
}))

export const hackathonSubmissionsRelations = relations(hackathonSubmissions, ({ one, many }) => ({
  hackathon: one(hackathonEvents, {
    fields: [hackathonSubmissions.hackathonId],
    references: [hackathonEvents.id],
  }),
  team: one(hackathonTeams, {
    fields: [hackathonSubmissions.teamId],
    references: [hackathonTeams.id],
  }),
  scores: many(hackathonScores),
  communityVotes: many(hackathonCommunityVotes),
  judgeAssignments: many(hackathonJudgeAssignments),
}))

export const hackathonJudgeAssignmentsRelations = relations(
  hackathonJudgeAssignments,
  ({ one }) => ({
    hackathon: one(hackathonEvents, {
      fields: [hackathonJudgeAssignments.hackathonId],
      references: [hackathonEvents.id],
    }),
    submission: one(hackathonSubmissions, {
      fields: [hackathonJudgeAssignments.submissionId],
      references: [hackathonSubmissions.id],
    }),
    judge: one(users, {
      fields: [hackathonJudgeAssignments.judgeUserId],
      references: [users.id],
    }),
  }),
)

export const hackathonScoresRelations = relations(hackathonScores, ({ one }) => ({
  submission: one(hackathonSubmissions, {
    fields: [hackathonScores.submissionId],
    references: [hackathonSubmissions.id],
  }),
  judge: one(users, { fields: [hackathonScores.judgeUserId], references: [users.id] }),
  hackathon: one(hackathonEvents, {
    fields: [hackathonScores.hackathonId],
    references: [hackathonEvents.id],
  }),
}))

export const hackathonCommunityVotesRelations = relations(hackathonCommunityVotes, ({ one }) => ({
  submission: one(hackathonSubmissions, {
    fields: [hackathonCommunityVotes.submissionId],
    references: [hackathonSubmissions.id],
  }),
  user: one(users, { fields: [hackathonCommunityVotes.userId], references: [users.id] }),
}))

export const hackathonAnnouncementsRelations = relations(hackathonAnnouncements, ({ one }) => ({
  hackathon: one(hackathonEvents, {
    fields: [hackathonAnnouncements.hackathonId],
    references: [hackathonEvents.id],
  }),
  author: one(users, { fields: [hackathonAnnouncements.authorId], references: [users.id] }),
}))

