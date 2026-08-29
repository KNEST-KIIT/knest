'use server'

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { applicationAnswers, applicationDocuments, applications, users } from '@/db/schema'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { notify } from '@/server/notifications/send'
import { applicationReceivedTemplate } from '@/server/notifications/templates'
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

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.userId, user.id), eq(applications.programId, program.id)),
  })
  if (existing) return { ok: true, applicationId: existing.id }

  const [created] = await db
    .insert(applications)
    .values({ userId: user.id, programId: program.id })
    .returning({ id: applications.id })

  if (!created) return { ok: false, error: 'We couldn’t start that application.' }
  return { ok: true, applicationId: created.id }
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

  await db
    .update(applications)
    .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(applications.id, applicationId))

  const { subject, text } = applicationReceivedTemplate(program.title)
  await notify({
    userId: sessionUser.id,
    type: 'application_received',
    title: `We've got your application to ${program.title}`,
    body: `We'll be in touch. You can track its status any time.`,
    href: '/dashboard/applications',
    applicationId,
    email: { subject, text },
  })

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
