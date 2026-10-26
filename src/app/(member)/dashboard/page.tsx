import type { Metadata } from 'next'
import { Section, Heading } from '@/components/ui'
import Link from 'next/link'
import { requireOnboardedUser } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { isLabBookingEnabled } from '@/server/features'
import { isLabAdmin, labsRunBy } from '@/server/labs/access'
import { listNotificationsForUser } from '@/server/notifications/actions'
import { NotificationsList } from './notifications-list'
import { StudentDashboard } from './student-view'
import { FounderDashboard } from './founder-view'
import { MentorDashboard } from './mentor-view'
import { ContributionDashboard } from './contribution-view'
// This page alone enforces onboarding completion — see the layout for why.

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Role-aware, per CONTENT_SPEC.md §5: a student sees one next step, a
 * founder sees where their applications stand, a mentor sees their profile
 * and who they support. Investors, alumni and partners get contribution
 * paths supported by the public ecosystem pages and staff enquiry queue.
 */
export default async function DashboardPage() {
  const user = await requireOnboardedUser('/dashboard')
  const firstName = user.name?.split(' ')[0]

  const greeting =
    user.platformRole === 'founder'
      ? `${firstName ? `${firstName}, h` : 'H'}ere's where things stand.`
      : user.platformRole === 'mentor'
        ? `Thanks for being here${firstName ? `, ${firstName}` : ''}.`
        : `Welcome back${firstName ? `, ${firstName}` : ''}.`

  const notifications = await listNotificationsForUser(user.id)
  // Lab heads, assistants and administrators get a link to their console while lab booking is on.
  const runsLabs = isLabBookingEnabled() && (isLabAdmin((user.staffRole ?? null) as StaffRole | null) || (await labsRunBy(user.id)).length > 0)

  const notificationsSlot = notifications.length > 0 ? (
    <NotificationsList notifications={notifications} />
  ) : null

  return (
    <Section>
      <Heading as="h1" size="display">
        {greeting}
      </Heading>

      {runsLabs && (
        <p className="mt-6">
          <Link href="/dashboard/lab-staff" className="font-semibold text-[var(--color-signal)] underline underline-offset-4">
            Your labs: requests, schedule and reports
          </Link>
        </p>
      )}

      <div className="mt-8">
        {user.platformRole === 'founder' ? (
          <FounderDashboard user={user} notificationsSlot={notificationsSlot} />
        ) : user.platformRole === 'mentor' ? (
          <>
            <MentorDashboard user={user} />
            {notificationsSlot && <div className="mt-8">{notificationsSlot}</div>}
          </>
        ) : user.platformRole === 'investor' || user.platformRole === 'alumni' || user.platformRole === 'partner' ? (
          <>
            <ContributionDashboard role={user.platformRole} />
            {notificationsSlot && <div className="mt-8">{notificationsSlot}</div>}
          </>
        ) : (
          <StudentDashboard user={user} notificationsSlot={notificationsSlot} />
        )}
      </div>
    </Section>
  )
}
