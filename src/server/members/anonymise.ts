import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  accounts,
  applicationAnswers,
  applicationDocuments,
  applications,
  auditLogs,
  enquiries,
  eventRegistrations,
  hackathonRegistrations,
  labDeviceKeys,
  notifications,
  sessions,
  users,
  verificationTokens,
} from '@/db/schema'
import { requireStaffOrThrow } from '@/server/auth/guards'
import { deleteFile } from '@/server/storage'
import type { MemberResult } from './actions'

/**
 * Erasure of a person, without erasing the records the platform has to keep.
 *
 * "Delete my account" and "keep applications and decisions for five years" pull in different directions, and a
 * hard DELETE of the user row cannot honour both (applications cascade from it; device keys and scan events
 * restrict it). So the account is ANONYMISED: the row stays, with nothing left that identifies the person,
 * and everything that points at it (applications, audit entries, bookings, scans) keeps pointing at a row that
 * is now "Former member". The person can no longer sign in or be contacted, and nothing can be linked back.
 *
 * What is removed: name, e-mail, password, photo, profile text, skills and interests, every sign-in session,
 * linked Google identity, outstanding e-mail links, in-app notifications, event registrations, the free text of
 * their contact-form messages, and their devices' keys are revoked.
 *
 * What is kept: the application records (status, dates, decisions) and the audit trail, because those are the
 * organisation's records. Whether the applicant's own typed answers and uploaded documents are also removed is the
 * `scrubApplicationContent` choice: off keeps them for the retention period, on replaces answers with a marker and
 * deletes the files. That default is a policy decision for the owner, and the call records which was chosen.
 *
 * Super administrator only. Staff accounts cannot be anonymised until their staff role is removed, and nobody can
 * anonymise themselves, so the last administrator can never be erased by accident.
 */

export const ANONYMISED_DOMAIN = 'anonymised.invalid'
export const FORMER_MEMBER = 'Former member'

export const anonymisedEmail = (userId: string) => `anonymised-${userId}@${ANONYMISED_DOMAIN}`
export const isAnonymisedEmail = (email: string) => email.endsWith(`@${ANONYMISED_DOMAIN}`)

export async function anonymiseMember(userId: string, options: { scrubApplicationContent?: boolean } = {}): Promise<MemberResult> {
  const actor = await requireStaffOrThrow('users') // super admin only
  if (userId === actor.id) return { ok: false, error: 'You can’t anonymise your own account.' }
  const scrub = options.scrubApplicationContent === true

  const outcome = await db.transaction(async (tx): Promise<{ error?: string; keys: string[] }> => {
    // The same lock as role changes and deactivation, so an administrator cannot be erased while another is demoted.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('knest:staff-membership'))`)
    const currentActor = await tx.query.users.findFirst({ where: eq(users.id, actor.id), columns: { isActive: true, staffRole: true } })
    if (!currentActor?.isActive || currentActor.staffRole !== 'super_admin') return { error: 'Your staff access changed. Sign in again.', keys: [] }

    const target = await tx.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, email: true, staffRole: true } })
    if (!target) return { error: 'We couldn’t find that account.', keys: [] }
    if (target.staffRole) return { error: 'Remove their staff role first. Staff accounts are not anonymised directly.', keys: [] }
    if (isAnonymisedEmail(target.email)) return { keys: [] }

    const now = new Date()
    await tx
      .update(users)
      .set({
        name: FORMER_MEMBER,
        email: anonymisedEmail(userId),
        emailVerified: null,
        passwordHash: null,
        image: null,
        bio: null,
        organization: null,
        school: null,
        graduationYear: null,
        linkedinUrl: null,
        websiteUrl: null,
        skills: [],
        interests: [],
        goals: [],
        expertiseAreas: [],
        yearsOfExperience: null,
        mentorAvailability: null,
        profileVisibility: 'private',
        isActive: false,
        updatedAt: now,
      })
      .where(eq(users.id, userId))

    // Nothing that could sign them in, or reach them, survives.
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx.delete(accounts).where(eq(accounts.userId, userId))
    await tx.delete(verificationTokens).where(like(verificationTokens.identifier, `%:${target.email}`))
    await tx.delete(notifications).where(eq(notifications.userId, userId))
    await tx.delete(eventRegistrations).where(eq(eventRegistrations.userId, userId))
    await tx.update(hackathonRegistrations).set({ skills: [] }).where(eq(hackathonRegistrations.userId, userId))
    // Device keys are referenced by scan history and cannot be deleted; revoking them ends their use.
    await tx.update(labDeviceKeys).set({ revokedAt: now, revokedBy: actor.id, revokedReason: 'Account anonymised' }).where(and(eq(labDeviceKeys.userId, userId), isNull(labDeviceKeys.revokedAt)))

    // Contact-form messages they sent while signed in: who they are and what they wrote.
    await tx.update(enquiries).set({ name: FORMER_MEMBER, email: anonymisedEmail(userId), message: '[removed on request]' }).where(eq(enquiries.userId, userId))

    let keys: string[] = []
    if (scrub) {
      const owned = await tx.select({ id: applications.id }).from(applications).where(eq(applications.userId, userId))
      const applicationIds = owned.map((a) => a.id)
      if (applicationIds.length > 0) {
        await tx.update(applicationAnswers).set({ value: sql`to_jsonb('[removed on request]'::text)`, updatedAt: now }).where(inArray(applicationAnswers.applicationId, applicationIds))
        const gone = await tx.delete(applicationDocuments).where(inArray(applicationDocuments.applicationId, applicationIds)).returning({ key: applicationDocuments.storageKey })
        keys = gone.map((g) => g.key)
      }
    }

    // The trail names the actor and the choice. It never carries the person's old details.
    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: 'account_anonymised',
      entityType: 'user',
      entityId: userId,
      before: null,
      after: { scrubApplicationContent: scrub },
    })
    return { keys }
  })

  if (outcome.error !== undefined) return { ok: false, error: outcome.error }
  // Files are removed after the commit: a failed delete leaves an orphan the daily reconcile reports, never a
  // half-anonymised account.
  for (const key of outcome.keys) {
    await deleteFile(key).catch(() => console.error('[anonymise] could not delete a stored document; reconcile will report it'))
  }
  return { ok: true }
}
