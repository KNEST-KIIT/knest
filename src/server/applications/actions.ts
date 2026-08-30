'use server'

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { applicationAnswers, applicationDocuments, applications, users } from '@/db/schema'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { sendNotificationEmail, writeNotification } from '@/server/notifications/send'
import { applicationReceivedTemplate } from '@/server/notifications/templates'
import { track } from '@/server/analytics/track'
import { generateStorageKey, putFile } from '@/server/storage'
import { getApplicationProgram, getApplicationProgramBySlug } from './program-questions'
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES, schemaForQuestion } from './validation'

export type ActionResult = { ok: true } | { ok: false; error: string; code?: string }

/** Read-only: which status (if any) the signed-in user's application to this program is in. Used by the public program page to decide the apply CTA — no auth throw, just null if nothing exists. */
export async function getApplicationStatusForUser(userId: string, programId: number) {
  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.userId, userId), eq(applications.programId, programId)),
    columns: { status: true },
  })
  return existing?.status ?? null
}

/**
 * Idempotent: returns the existing application (draft or otherwise) if the
 * user already started one, rather than erroring — "start" from the program
 * page and "continue" from the dashboard both land here safely.
 *
 * Atomic by construction (PHASE-5-6-RETROSPECTIVE.md §4 / PHASE-7-9-
 * RETROSPECTIVE.md §1): the insert leans on the unique index
 * (userId, programId) via onConflictDoNothing() rather than a
 * check-then-insert — two concurrent requests can no longer both pass a
 * check before either commits. Only the (rare) conflict case re-queries.
 */
export async function startApplication(
  programSlug: string,
): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  const user = await requireUserOrThrow()
  const program = await getApplicationProgramBySlug(programSlug)

  if (!program) return { ok: false, error: 'That program doesn’t exist.' }
  if (program.applicationStatus !== 'open') {
    return { ok: false, error: 'Applications for this program aren’t open right now.' }
  }
  if (program.applicationDeadline && new Date(program.applicationDeadline) < new Date()) {
    return { ok: false, error: `Applications for this program closed on ${program.applicationDeadline}.` }
  }

  const [created] = await db
    .insert(applications)
    .values({ userId: user.id, programId: program.id })
    .onConflictDoNothing({ target: [applications.userId, applications.programId] })
    .returning({ id: applications.id })

  if (created) {
    await track('application_start', { programId: program.id })
    return { ok: true, applicationId: created.id }
  }

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.userId, user.id), eq(applications.programId, program.id)),
    columns: { id: true },
  })
  if (!existing) return { ok: false, error: 'We couldn’t start that application.' }
  return { ok: true, applicationId: existing.id }
}

/** Ownership check only — callers add their own status check where it matters (draft-only writes vs. read access to any status). */
async function loadOwnedApplication(applicationId: string, userId: string) {
  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  })
  if (!application || application.userId !== userId) return null
  return application
}

export async function saveAnswer(
  applicationId: string,
  questionId: string,
  value: unknown,
): Promise<ActionResult> {
  const user = await requireUserOrThrow()
  const application = await loadOwnedApplication(applicationId, user.id)
  if (!application) throw new UnauthorizedError(403)
  if (application.status !== 'draft') {
    return { ok: false, error: 'This application has already been submitted.' }
  }

  const program = await getApplicationProgram(application.programId)
  const question = program?.questions.find((q) => q.id === questionId)
  if (!question) return { ok: false, error: 'That question no longer exists on this program.' }

  const parsed = schemaForQuestion(question).safeParse(value)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your answer.' }
  }

  await db
    .insert(applicationAnswers)
    .values({ applicationId, questionId, value: parsed.data })
    .onConflictDoUpdate({
      target: [applicationAnswers.applicationId, applicationAnswers.questionId],
      set: { value: parsed.data, updatedAt: new Date() },
    })

  await db.update(applications).set({ updatedAt: new Date() }).where(eq(applications.id, applicationId))

  return { ok: true }
}

export async function uploadDocument(
  applicationId: string,
  questionId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<ActionResult> {
  const user = await requireUserOrThrow()
  const application = await loadOwnedApplication(applicationId, user.id)
  if (!application) throw new UnauthorizedError(403)
  if (application.status !== 'draft') {
    return { ok: false, error: 'This application has already been submitted.' }
  }

  // Validated server-side regardless of what the client already checked
  // (spec §31) — a client-side check is a courtesy, never the enforcement.
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: 'We can take PDF, DOC or PPT files.' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That file is over 10 MB. Try compressing it.' }
  }

  const storageKey = generateStorageKey(file.name)
  await putFile(storageKey, file.buffer)

  await db
    .insert(applicationDocuments)
    .values({
      applicationId,
      questionId,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      fileSize: file.size,
    })
    .onConflictDoUpdate({
      target: [applicationDocuments.applicationId, applicationDocuments.questionId],
      set: { fileName: file.name, storageKey, mimeType: file.type, fileSize: file.size, uploadedAt: new Date() },
    })

  await db.update(applications).set({ updatedAt: new Date() }).where(eq(applications.id, applicationId))

  return { ok: true }
}

export async function submitApplication(applicationId: string): Promise<ActionResult> {
  const sessionUser = await requireUserOrThrow()
  const application = await loadOwnedApplication(applicationId, sessionUser.id)
  if (!application) throw new UnauthorizedError(403)
  if (application.status !== 'draft') {
    return { ok: false, error: 'This application has already been submitted.' }
  }

  const program = await getApplicationProgram(application.programId)
  if (!program) return { ok: false, error: 'That program no longer exists.' }
  // Two independent "is this still open" signals exist on a program; both
  // are checked here now, matching what startApplication already checks —
  // a staff member closing applicationStatus mid-cohort (with no deadline
  // set) previously blocked new applicants but not an existing draft from
  // submitting (PHASE-7-9-RETROSPECTIVE.md §1).
  if (program.applicationStatus !== 'open') {
    return { ok: false, error: 'Applications for this program aren’t open right now.' }
  }
  if (program.applicationDeadline && new Date(program.applicationDeadline) < new Date()) {
    return {
      ok: false,
      error: `Applications for this program closed on ${program.applicationDeadline}.`,
    }
  }

  // Identity matters here (spec §31, USER_JOURNEYS Journey 2) — verification
  // does not block signup or onboarding, only the moment a real decision
  // about a real person gets made.
  const user = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
    columns: { email: true, emailVerified: true },
  })
  if (!user?.emailVerified) {
    return { ok: false, error: 'Verify your email before submitting.', code: 'verify-required' }
  }

  const [answers, documents] = await Promise.all([
    db.query.applicationAnswers.findMany({ where: eq(applicationAnswers.applicationId, applicationId) }),
    db.query.applicationDocuments.findMany({ where: eq(applicationDocuments.applicationId, applicationId) }),
  ])
  const answeredIds = new Set(answers.map((a) => a.questionId))
  const documentedIds = new Set(documents.map((d) => d.questionId))

  for (const question of program.questions) {
    if (question.required === false) continue
    const answered =
      question.fieldType === 'file' ? documentedIds.has(question.id) : answeredIds.has(question.id)
    if (!answered) {
      return { ok: false, error: `“${question.label}” still needs an answer.` }
    }
  }

  // Status update and the notification's DB write commit together
  // (PHASE-7-9-RETROSPECTIVE.md §1) — a crash between the two previously
  // left the application marked submitted with no corresponding row for
  // the dashboard to show. The email send stays outside the transaction:
  // it already tolerates failure on its own (sendNotificationEmail never
  // throws) and must not hold a DB transaction open on a network call.
  const { subject, text } = applicationReceivedTemplate(program.title)
  const notifyInput = {
    userId: sessionUser.id,
    type: 'application_received' as const,
    title: `We've got your application to ${program.title}`,
    body: `We'll be in touch. You can track its status any time.`,
    href: '/dashboard/applications',
    applicationId,
    email: { subject, text },
  }

  await db.transaction(async (tx) => {
    await tx
      .update(applications)
      .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, applicationId))

    await writeNotification(tx, notifyInput)
  })

  await sendNotificationEmail(sessionUser.id, notifyInput.email)
  await track('application_submit', { applicationId, programId: program.id })

  return { ok: true }
}

export async function listApplicationsForUser(userId: string) {
  const rows = await db.query.applications.findMany({
    where: eq(applications.userId, userId),
    orderBy: [desc(applications.updatedAt)],
  })

  return Promise.all(
    rows.map(async (row) => {
      const program = await getApplicationProgram(row.programId)
      return { application: row, programTitle: program?.title ?? 'Unknown program', programSlug: program?.slug ?? null }
    }),
  )
}

export async function getOwnedApplicationDetail(applicationId: string, userId: string) {
  const application = await loadOwnedApplication(applicationId, userId)
  if (!application) return null

  const program = await getApplicationProgram(application.programId)
  const [answers, documents] = await Promise.all([
    db.query.applicationAnswers.findMany({ where: eq(applicationAnswers.applicationId, applicationId) }),
    db.query.applicationDocuments.findMany({ where: eq(applicationDocuments.applicationId, applicationId) }),
  ])

  return { application, program, answers, documents }
}
