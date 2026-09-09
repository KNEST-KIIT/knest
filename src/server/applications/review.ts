'use server'

import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { applicationAnswers, applicationDocuments, applications, auditLogs, users } from '@/db/schema'
import type { applicationStatus } from '@/db/schema'
import { requireAdminArea, requireStaffOrThrow } from '@/server/auth/guards'
import { sendNotificationEmail, writeNotification } from '@/server/notifications/send'
import { applicationStatusChangedTemplate } from '@/server/notifications/templates'
import { track } from '@/server/analytics/track'
import { getApplicationProgram, getProgramTitlesByIds } from './program-questions'
import { isLegalTransition } from './transitions'
import type { ActionResult } from './actions'

type Status = (typeof applicationStatus.enumValues)[number]

/**
 * Deliberately modest, and the reason this got a limit at all: the query had
 * none, so the review screen loaded every application there had ever been and
 * degraded quietly as the number grew. There was also no way to find one
 * person by name — a reviewer looking for "Aditi" had to read the list.
 *
 * Not exported: this file is `'use server'`, where every export becomes a
 * callable server action, so only async functions may leave it.
 */
const APPLICATIONS_PER_PAGE = 25

export async function listApplicationsForReview(filters: {
  programId?: number
  status?: Status
  q?: string
  page?: number
}) {
  await requireAdminArea('applications')

  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const conditions = []
  if (filters.programId) conditions.push(eq(applications.programId, filters.programId))
  if (filters.status) conditions.push(eq(applications.status, filters.status))

  // Searching by applicant means joining to users. `findMany` with a `where`
  // on a relation is not something Drizzle's query API expresses, so the
  // matching ids are resolved first and the list is then filtered by them.
  if (filters.q) {
    const term = `%${filters.q}%`
    const matches = await db
      .select({ id: users.id })
      .from(users)
      .where(or(ilike(users.email, term), ilike(users.name, term)))
      .limit(500)
    if (matches.length === 0) {
      return { rows: [], page, total: 0, pageCount: 1 }
    }
    conditions.push(inArray(applications.userId, matches.map((match) => match.id)))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [total]] = await Promise.all([
    db.query.applications.findMany({
      where,
      orderBy: [desc(applications.submittedAt)],
      with: { user: { columns: { id: true, name: true, email: true } } },
      limit: APPLICATIONS_PER_PAGE,
      offset: (page - 1) * APPLICATIONS_PER_PAGE,
    }),
    db.select({ value: count() }).from(applications).where(where),
  ])

  // One batched lookup for every program referenced, not one per row (§5.2).
  const programs = await getProgramTitlesByIds([...new Set(rows.map((row) => row.programId))])

  const totalCount = total?.value ?? 0
  return {
    rows: rows.map((row) => ({
      application: row,
      applicant: row.user,
      programTitle: programs.get(row.programId)?.title ?? 'Unknown program',
    })),
    page,
    total: totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / APPLICATIONS_PER_PAGE)),
  }
}

export async function getApplicationForReview(applicationId: string) {
  await requireAdminArea('applications')

  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: { user: true },
  })
  if (!application) return null

  const program = await getApplicationProgram(application.programId)
  const [answers, documents] = await Promise.all([
    db.query.applicationAnswers.findMany({ where: eq(applicationAnswers.applicationId, applicationId) }),
    db.query.applicationDocuments.findMany({ where: eq(applicationDocuments.applicationId, applicationId) }),
  ])

  return { application, applicant: application.user, program, answers, documents }
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

  const application = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) })
  if (!application) return { ok: false, error: 'That application doesn’t exist.' }

  if (!isLegalTransition(application.status, newStatus)) {
    return {
      ok: false,
      error: `Can’t move an application from ${application.status} to ${newStatus}.`,
    }
  }

  const program = await getApplicationProgram(application.programId)
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
  await db.transaction(async (tx) => {
    await tx
      .update(applications)
      .set({
        status: newStatus,
        decisionAt: terminal ? new Date() : application.decisionAt,
        decisionNote: note ?? application.decisionNote,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId))

    await tx.insert(auditLogs).values({
      actorUserId: staff.id,
      action: 'application_status_changed',
      entityType: 'application',
      entityId: applicationId,
      before: { status: application.status },
      after: { status: newStatus, note: note ?? null },
    })

    await writeNotification(tx, notifyInput)
  })

  await sendNotificationEmail(application.userId, notifyInput.email)
  if (newStatus === 'accepted') {
    await track('application_accepted', { applicationId, programId: application.programId }, { userId: application.userId })
  }

  return { ok: true }
}
