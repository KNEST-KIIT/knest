import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { accounts, users } from '@/db/schema'
import { requireUser } from '@/server/auth/guards'
import { googleConfigured } from '@/server/auth/providers'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { AccountMethods } from './account-methods'

export const metadata: Metadata = { title: 'Your account' }

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  founder: 'Founder',
  mentor: 'Mentor',
  investor: 'Investor',
  alumni: 'Alumni',
  partner: 'Partner',
  other: 'Other',
}

const STAGE_LABELS: Record<string, string> = {
  exploring: 'Exploring',
  idea: 'Idea',
  validation: 'Validation',
  mvp: 'MVP / Prototype',
  early_revenue: 'Early revenue',
  scaling: 'Scaling',
  established: 'Established company',
}

export default async function AccountPage() {
  const user = await requireUser('/dashboard/account')
  const [userRow, google] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        passwordHash: true,
        platformRole: true,
        journeyStage: true,
        name: true,
        school: true,
        organization: true,
      },
    }),
    db.query.accounts.findFirst({
      where: and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')),
      columns: { provider: true },
    }),
  ])

  // Extract boolean hasPassword on the server so passwordHash is never leaked or serialized to client props
  const hasPassword = Boolean(userRow?.passwordHash)
  const profile = userRow
    ? {
        platformRole: userRow.platformRole,
        journeyStage: userRow.journeyStage,
        name: userRow.name,
        school: userRow.school,
        organization: userRow.organization,
      }
    : null

  return (
    <Section>
      <div className="max-w-xl">
        <Link href="/auth/complete" className="text-sm text-[var(--color-signal)] underline underline-offset-4">← Your workspace</Link>
        <Heading as="h1" size="title" className="mt-6">Your account</Heading>
        <p className="mt-3 break-all text-[var(--color-ink-soft)]">{user.email}</p>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Choose how you sign in. Your applications, profile and access stay with this one account.</p>
        <AccountMethods hasPassword={hasPassword} googleLinked={Boolean(google)} googleEnabled={googleConfigured()} />

        <div className="mt-10 border-t border-[var(--color-line)] pt-8">
          <Heading as="h2" size="heading">Profile &amp; role</Heading>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Your platform role, journey stage, and biographical details across KNEST.
          </p>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-white p-4 rounded-[var(--radius-sm)] border border-[var(--color-line)]">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">Platform Role</dt>
              <dd className="mt-1 font-medium text-[var(--color-ink)]">
                {profile?.platformRole ? ROLE_LABELS[profile.platformRole] ?? profile.platformRole : 'Not specified'}
              </dd>
            </div>
            {profile?.journeyStage && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">Journey Stage</dt>
                <dd className="mt-1 font-medium text-[var(--color-ink)]">
                  {STAGE_LABELS[profile.journeyStage] ?? profile.journeyStage}
                </dd>
              </div>
            )}
            {profile?.name && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">Name</dt>
                <dd className="mt-1 font-medium text-[var(--color-ink)]">{profile.name}</dd>
              </div>
            )}
            {(profile?.school || profile?.organization) && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {profile.school ? 'School / Department' : 'Organization'}
                </dt>
                <dd className="mt-1 font-medium text-[var(--color-ink)]">{profile.school || profile.organization}</dd>
              </div>
            )}
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/onboarding?step=role" variant="secondary" size="sm">
              Change role or path
            </ButtonLink>
            <ButtonLink href="/onboarding?step=profile" variant="secondary" size="sm">
              Edit profile
            </ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  )
}
