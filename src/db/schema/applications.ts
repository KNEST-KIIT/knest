import { relations, sql } from 'drizzle-orm'
import { check, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { applicationStatus, appSchema, documentScanStatus } from './enums'
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

/**
 * One attached file per (application, question).
 *
 * An upload is written to the isolated quarantine bucket first and recorded here as `pending`, bound to the
 * exact object it created: bucket, key and S3 version id (and ETag and SHA-256). A malware verdict is applied
 * only when it names that same bucket, key and version, so a verdict for an earlier upload, a replaced file or
 * a different object can never release this one. Only then is the version copied to the clean documents bucket
 * and the row becomes `clean`, the sole state in which the file is readable (src/server/security/scan-processor.ts).
 */
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
    /** Object key in clean storage, generated at upload (src/server/storage). The same key names the quarantine object. */
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedAt: timestamp('uploaded_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),

    /** Screening state. Owned by this database; see documentScanStatus. */
    scanStatus: documentScanStatus('scan_status').notNull().default('pending'),
    /** The object GuardDuty scans: all three must match a verdict. Null only on rows that pre-date screening. */
    quarantineBucket: text('quarantine_bucket'),
    quarantineKey: text('quarantine_key'),
    quarantineVersionId: text('quarantine_version_id'),
    /** ETag S3 returned for the quarantine upload; a verdict that disagrees with it is refused. */
    quarantineEtag: text('quarantine_etag'),
    /** Lower-case hex SHA-256 of the bytes as uploaded. The clean copy must carry the same checksum. */
    sha256: text('sha256'),
    /** S3 version id of the clean copy that downloads are served from. Set only when the row becomes `clean`. */
    cleanVersionId: text('clean_version_id'),
    /** GuardDuty's scanResultStatus as received (NO_THREATS_FOUND, THREATS_FOUND, UNSUPPORTED, ...), or an internal reason code. */
    scanResult: text('scan_result'),
    /** GuardDuty statusReasons (for example PASSWORD_PROTECTED) or internal detail for scan_error. */
    scanReasons: jsonb('scan_reasons').$type<string[]>(),
    /** Name of the first threat GuardDuty reported. Staff and logs only; never shown to the applicant. */
    scanThreat: text('scan_threat'),
    /** The EventBridge event id that decided this row, so a replayed event is recognisably the same one. */
    scanEventId: text('scan_event_id'),
    scanDecidedAt: timestamp('scan_decided_at', { mode: 'date', withTimezone: true }),
  },
  (t) => [
    uniqueIndex('application_documents_app_question_idx').on(t.applicationId, t.questionId),
    // One row per quarantine object version. Nulls (legacy rows) are distinct, so they do not collide.
    uniqueIndex('application_documents_quarantine_binding_idx').on(t.quarantineBucket, t.quarantineKey, t.quarantineVersionId),
    // The overdue sweep reads only rows still waiting for a verdict.
    index('application_documents_pending_idx').on(t.uploadedAt).where(sql`${t.scanStatus} = 'pending'`),
    // The binding is all or nothing.
    check(
      'application_documents_binding_complete',
      sql`(${t.quarantineBucket} is null and ${t.quarantineKey} is null and ${t.quarantineVersionId} is null) or (${t.quarantineBucket} is not null and ${t.quarantineKey} is not null and ${t.quarantineVersionId} is not null)`,
    ),
    // A row cannot be `clean` without the evidence: a bound version, GuardDuty's clean verdict, the event that said so, and the clean copy.
    check(
      'application_documents_clean_is_proven',
      sql`${t.scanStatus} <> 'clean' or (${t.quarantineVersionId} is not null and ${t.cleanVersionId} is not null and ${t.scanResult} = 'NO_THREATS_FOUND' and ${t.scanEventId} is not null and ${t.scanDecidedAt} is not null)`,
    ),
    // Every decided row says when it was decided.
    check('application_documents_decided_has_time', sql`${t.scanStatus} = 'pending' or ${t.scanDecidedAt} is not null`),
    check('application_documents_sha256_shape', sql`${t.sha256} is null or ${t.sha256} ~ '^[0-9a-f]{64}$'`),
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
