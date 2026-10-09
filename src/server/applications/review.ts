'use server'

import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { applicationAnswers, applicationDocuments, applications, auditLogs, users } from '@/db/schema'
import { likePattern } from '@/lib/pagination'
import { REVIEW_PAGE_SIZE } from './review-constants'
import type { applicationStatus } from '@/db/schema'
import { requireAdminArea, requireStaffOrThrow } from '@/server/auth/guards'
import { sendNotificationEmail, writeNotification } from '@/server/notifications/send'
import { applicationStatusChangedTemplate } from '@/server/notifications/templates'
import { track } from '@/server/analytics/track'
import { getApplicationProgram, getProgramTitlesByIds } from './program-questions'
import { isLegalTransition } from './transitions'
import type { ActionResult } from './actions'

type Status = (typeof applicationStatus.enumValues)[number]

const MAX_DECISION_NOTE = 2000


/**
 * The reviewer queue: submitted applications only (a draft is the applicant's own work in progress
 * and is not for staff to read), newest submission first, filterable by program and status and
 * searchable by applicant name or e-mail, one page at a time.
 */
export async function listApplicationsForReview(filters: { programId?: number; status?: Status; q?: string; page?: number }) {
  await requireAdminArea('applications')

  const conditions = [ne(applications.status, 'draft')]
  if (filters.programId) conditions.push(eq(applications.programId, filters.programId))
  if (filters.status && filters.status !== 'draft') conditions.push(eq(applications.status, filters.status))
  const q = filters.q?.trim()
  if (q) {
    const pattern = likePattern(q)
    conditions.push(
      inArray(applications.userId, db.select({ id: users.id }).from(users).where(or(ilike(users.name, pattern), ilike(users.email, pattern)))),
    )
  }
  const where = and(...conditions)
  const page = Math.max(1, filters.page ?? 1)

  const [total] = await db.select({ value: count() }).from(applications).where(where)
  const found = await db.query.applications.findMany({
    where,
    orderBy: [desc(applications.submittedAt), desc(applications.id)],
    limit: REVIEW_PAGE_SIZE,
    offset: (page - 1) * REVIEW_PAGE_SIZE,
    with: { user: { columns: { id: true, name: true, email: true } } },
  })
  const rows = found

  // One batched lookup for every program referenced, not one per row (§5.2).
  const programs = await getProgramTitlesByIds([...new Set(rows.map((row) => row.programId))])

  return {
    total: total?.value ?? 0,
    page,
    rows: rows.map((row) => ({
      application: row,
      applicant: row.user,
      programTitle: programs.get(row.programId)?.title ?? 'Unknown program',
    })),
  }
}

export async function getApplicationForReview(applicationId: string) {
  await requireAdminArea('applications')

  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: { user: true },
  })
  if (!application) return null

  const program = await getApplicationProgram(application.programId, { includeUnpublished: true })
  const [answers, documents] = await Promise.all([
    db.query.applicationAnswers.findMany({ where: eq(applicationAnswers.applicationId, applicationId) }),
    db.query.applicationDocuments.findMany({ where: eq(applicationDocuments.applicationId, applicationId) }),
  ])

  // Review shows what the applicant was actually asked: the questions frozen at
  // submit, not whatever the program says today (or nothing, if it was deleted).
  const asSubmitted = application.questionSnapshot
    ? {
        id: application.programId,
        title: program?.title ?? 'Program no longer available',
        slug: program?.slug ?? '',
        applicationStatus: program?.applicationStatus ?? ('closed' as const),
        applicationDeadline: program?.applicationDeadline ?? null,
        questions: application.questionSnapshot,
      }
    : program

  return { application, applicant: application.user, program: asSubmitted, answers, documents }
}

/**
 * Called only from src/app/api/admin/applications/[id]/status/route.ts — a
 * route handler, so this uses requireStaffOrThrow (throws, caught at the API
 * boundary) rather than requireAdminArea (calls notFound(), correct for a
 * page component but not for a route — PHASE-7-9-RETROSPECTIVE.md §1,
 * carried over unfixed from PHASE-5-6-RETROSPECTIVE.md §1). Verified live:
 * a non-staff request now gets a JSON 403 instead of an empty-body 404.
 */
export async function changeApplicationStatus(
  applicationId: string,
  newStatus: Status,
  note?: string,
): Promise<ActionResult> {
  const staff = await requireStaffOrThrow('applications')

  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > MAX_DECISION_NOTE)) {
    return { ok: false, error: `The note must be text of at most ${MAX_DECISION_NOTE} characters.` }
  }

  const application = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) })
  if (!application) return { ok: false, error: 'That application doesn’t exist.' }

  if (!isLegalTransition(application.status, newStatus)) {
    return {
      ok: false,
      error: `Can’t move an application from ${application.status} to ${newStatus}.`,
    }
  }

  const program = await getApplicationProgram(application.programId, { includeUnpublished: true })
  const { subject, text } = applicationStatusChangedTemplate(program?.title ?? 'your program', newStatus)
  const notifyInput = {
    userId: application.userId,
    type: 'application_status_changed' as const,
    title: subject,
    body: text,
    href: '/dashboard/applications',
    applicationId,
    email: { subject, text },
  }

  // Status update, audit log insert, and the notification's DB write commit
  // together (PHASE-7-9-RETROSPECTIVE.md §1) — previously a crash between
  // any two of these left either a status change with no audit trail, or an
  // application already marked with its new status while the client that
  // triggered it saw an error. The email send stays outside the transaction
  // for the same reason as submitApplication's.
  const terminal = newStatus === 'accepted' || newStatus === 'rejected'
  //
  // The update is conditional on the status that was just read, so two
  // reviewers acting at once cannot both win: the second finds the row already
  // moved, writes nothing (no audit row, no second notification) and is told so.
  const moved = await db.transaction(async (tx) => {
    const updated = await tx
      .update(applications)
      .set({
        status: newStatus,
        decisionAt: terminal ? new Date() : application.decisionAt,
        decisionNote: note ?? application.decisionNote,
        updatedAt: new Date(),
      })
      .where(and(eq(applications.id, applicationId), eq(applications.status, application.status)))
      .returning({ id: applications.id })
    if (updated.length === 0) return false

    await tx.insert(auditLogs).values({
      actorUserId: staff.id,
      action: 'application_status_changed',
      entityType: 'application',
      entityId: applicationId,
      before: { status: application.status },
      after: { status: newStatus, note: note ?? null },
    })

    await writeNotification(tx, notifyInput)
    return true
  })
  if (!moved) {
    return { ok: false, error: 'Someone else changed this application first. Reload to see its current status.', code: 'conflict' }
  }

  await sendNotificationEmail(application.userId, notifyInput.email)
  if (newStatus === 'accepted') {
    await track('application_accepted', { applicationId, programId: application.programId }, { userId: application.userId })
  }

  return { ok: true }
}
