import { relations } from 'drizzle-orm'
import { boolean, index, integer, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'
import {
  appSchema,
  journeyStage,
  mentorAvailability,
  platformRole,
  profileVisibility,
  staffRole,
} from './enums'

/**
 * The single account record for every human on the platform — student, founder,
 * mentor and admin alike. There is deliberately no second user table for staff:
 * `staffRole` is what grants access to /admin, via the Payload auth strategy in
 * `src/payload/auth-strategy.ts`. One person, one login (spec §08).
 */
export const users = appSchema.table(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // --- Identity ---
    email: text('email').notNull().unique(),
    emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
    /** Null for OAuth-only accounts; bcrypt (cost 12) otherwise. Never sent to a client. */
    passwordHash: text('password_hash'),
    name: text('name'),
    image: text('image'),

    // --- Roles (spec §02/§24) ---
    platformRole: platformRole('platform_role').notNull().default('student'),
    /** Null for the overwhelming majority of users. Non-null = staff = /admin access. */
    staffRole: staffRole('staff_role'),

    // --- Profile (spec §26) ---
    bio: text('bio'),
    organization: text('organization'),
    /** School / department within KIIT. */
    school: text('school'),
    graduationYear: integer('graduation_year'),
    linkedinUrl: text('linkedin_url'),
    websiteUrl: text('website_url'),
    skills: text('skills').array().notNull().default([]),
    interests: text('interests').array().notNull().default([]),
    profileVisibility: profileVisibility('profile_visibility').notNull().default('community'),

    // --- Onboarding step 2: what they're looking for (spec §09) ---
    goals: text('goals').array().notNull().default([]),

    // --- Onboarding step 5, mentor branch only. A mentor's platform account
    // does not become a public Mentor profile automatically — staff review
    // before publishing (spec §14) — these fields are what they review. ---
    expertiseAreas: text('expertise_areas').array().notNull().default([]),
    yearsOfExperience: integer('years_of_experience'),
    mentorAvailability: mentorAvailability('mentor_availability'),

    // --- Journey (spec §09) ---
    journeyStage: journeyStage('journey_stage'),
    onboardingCompletedAt: timestamp('onboarding_completed_at', {
      mode: 'date',
      withTimezone: true,
    }),

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('users_staff_role_idx').on(table.staffRole),
    index('users_platform_role_idx').on(table.platformRole),
  ],
)

// --- Auth.js adapter tables -------------------------------------------------

export const accounts = appSchema.table(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index('accounts_user_id_idx').on(table.userId),
  ],
)

/**
 * Database sessions, not JWTs. A DB session can be revoked server-side the
 * instant a role changes or an account is disabled — which is what makes the
 * §31 "never rely on frontend authorization" guarantee actually enforceable.
 */
export const sessions = appSchema.table(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
)

export const verificationTokens = appSchema.table(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))
