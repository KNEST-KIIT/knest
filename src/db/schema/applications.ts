import { relations } from 'drizzle-orm'
import { index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { applicationStatus, appSchema } from './enums'
import { users } from './users'
import type { ApplicationQuestion } from '@/server/applications/types'

/**
 * An application to one program. programId is a Payload document id, stored
 * as a plain integer rather than a Postgres foreign key — spec §32's
 * cms/app split means Payload's schema and Drizzle's migrations must stay
 * independent, so referential integrity to a program is enforced in
 * src/server/applications/actions.ts (which checks the program exists via
 * Payload's API before creating a draft), not at the database level.
 */
export const applications = appSchema.table(
  'applications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programId: integer('program_id').notNull(),
    status: applicationStatus('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { mode: 'date', withTimezone: true }),
    decisionAt: timestamp('decision_at', { mode: 'date', withTimezone: true }),
    /** Staff-facing only — never surfaced to the applicant. */
    decisionNote: text('decision_note'),
    /**
     * The program's questions exactly as the applicant saw them when they
     * submitted. Answers are keyed by question id, so without this a program
     * edited or deleted afterwards leaves review unable to say what was asked
     * (R-04). Null on drafts and on applications submitted before this column.
     */
    questionSnapshot: jsonb('question_snapshot').$type<ApplicationQuestion[]>(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One application per (user, program) — "start" is idempotent by design
    // rather than by a check in application code alone.
    uniqueIndex('applications_user_program_idx').on(table.userId, table.programId),
    index('applications_program_idx').on(table.programId),
    index('applications_status_idx').on(table.status),
  ],
)

/**
 * One row per answered question. questionId is the row id Payload assigns to
 * an entry in a program's applicationQuestions array — stable across saves,
 * so an answer stays correctly attributed even if a program manager reorders
 * or edits other questions later.
 */
export const applicationAnswers = appSchema.table(
  'application_answers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    questionId: text('question_id').notNull(),
    /** A string for text/textarea/select/url, a string[] for multiselect. */
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('application_answers_app_question_idx').on(table.applicationId, table.questionId),
  ],
)

export const applicationDocuments = appSchema.table(
  'application_documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    questionId: text('question_id').notNull(),
    fileName: text('file_name').notNull(),
    /** Storage key — a local path in dev, an S3 key in production (src/server/storage). */
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedAt: timestamp('uploaded_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('application_documents_app_question_idx').on(table.applicationId, table.questionId),
  ],
)

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  answers: many(applicationAnswers),
  documents: many(applicationDocuments),
}))

export const applicationAnswersRelations = relations(applicationAnswers, ({ one }) => ({
  application: one(applications, { fields: [applicationAnswers.applicationId], references: [applications.id] }),
}))

export const applicationDocumentsRelations = relations(applicationDocuments, ({ one }) => ({
  application: one(applications, { fields: [applicationDocuments.applicationId], references: [applications.id] }),
}))
