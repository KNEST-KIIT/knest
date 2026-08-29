'use server'

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { applicationAnswers, applicationDocuments, applications, auditLogs, users } from '@/db/schema'
import type { applicationStatus } from '@/db/schema'
import { requireAdminArea } from '@/server/auth/guards'
import { notify } from '@/server/notifications/send'
import { applicationStatusChangedTemplate } from '@/server/notifications/templates'
import { getApplicationProgram } from './program-questions'
import { isLegalTransition } from './transitions'
import type { ActionResult } from './actions'

type Status = (typeof applicationStatus.enumValues)[number]

export async function listApplicationsForReview(filters: { programId?: number; status?: Status }) {
  await requireAdminArea('applications')

  const conditions = []
  if (filters.programId) conditions.push(eq(applications.programId, filters.programId))
  if (filters.status) conditions.push(eq(applications.status, filters.status))

  const rows = await db.query.applications.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(applications.submittedAt)],
    with: { user: { columns: { id: true, name: true, email: true } } },
  })

  return Promise.all(
    rows.map(async (row) => {
      const program = await getApplicationProgram(row.programId)
      return { application: row, applicant: row.user, programTitle: program?.title ?? 'Unknown program' }
    }),
  )
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

export async function changeApplicationStatus(
  applicationId: string,
  newStatus: Status,
  note?: string,
): Promise<ActionResult> {
  const staff = await requireAdminArea('applications')

  const application = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) })
  if (!application) return { ok: false, error: 'That application doesn’t exist.' }

  if (!isLegalTransition(application.status, newStatus)) {
    return {
      ok: false,
      error: `Can’t move an application from ${application.status} to ${newStatus}.`,
    }
  }

  const terminal = newStatus === 'accepted' || newStatus === 'rejected'
  await db
    .update(applications)
    .set({
      status: newStatus,
      decisionAt: terminal ? new Date() : application.decisionAt,
      decisionNote: note ?? application.decisionNote,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId))

  await db.insert(auditLogs).values({
    actorUserId: staff.id,
    action: 'application_status_changed',
    entityType: 'application',
    entityId: applicationId,
    before: { status: application.status },
    after: { status: newStatus, note: note ?? null },
  })

  const program = await getApplicationProgram(application.programId)
  const { subject, text } = applicationStatusChangedTemplate(program?.title ?? 'your program', newStatus)
  await notify({
    userId: application.userId,
    type: 'application_status_changed',
    title: subject,
    body: text,
    href: '/dashboard/applications',
    applicationId,
    email: { subject, text },
  })

  return { ok: true }
}
