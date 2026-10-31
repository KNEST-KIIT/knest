import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { accounts, users } from '@/db/schema'
import { requireUser } from '@/server/auth/guards'
import { googleConfigured } from '@/server/auth/providers'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { AccountMethods } from './account-methods'
import { ProfileEditor } from './profile-editor'

export const metadata: Metadata = { title: 'Your profile & account — KNEST' }

const ROLE_LABELS: Record<string, string> = {
  student: 'Student Builder',
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
        id: true,
        email: true,
        passwordHash: true,
        platformRole: true,
        journeyStage: true,
        name: true,
        bio: true,
        school: true,
        organization: true,
        graduationYear: true,
        linkedinUrl: true,
        websiteUrl: true,
        skills: true,
      },
    }),
    db.query.accounts.findFirst({
      where: and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')),
      columns: { provider: true },
    }),
  ])

  const hasPassword = Boolean(userRow?.passwordHash)
  const initialProfile = {
    name: userRow?.name || '',
    email: userRow?.email || user.email || '',
    bio: userRow?.bio || '',
    school: userRow?.school || '',
    graduationYear: userRow?.graduationYear || null,
    linkedinUrl: userRow?.linkedinUrl || '',
    websiteUrl: userRow?.websiteUrl || '',
    skills: userRow?.skills || [],
    platformRole: userRow?.platformRole ? ROLE_LABELS[userRow.platformRole] ?? userRow.platformRole : 'Student Builder',
    journeyStage: userRow?.journeyStage ? STAGE_LABELS[userRow.journeyStage] ?? userRow.journeyStage : null,
  }

  return (
    <Section>
      <div className="max-w-5xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-signal)]">
          <Link href="/auth/complete" className="hover:underline flex items-center gap-1">
            <span>←</span> Back to workspace
          </Link>
          <span>/</span>
          <span className="text-[var(--color-ink-muted)]">Profile &amp; Settings</span>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Heading as="h1" size="title" className="tracking-tight">
              Builder Profile &amp; Settings
            </Heading>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Manage your campus presence, technical superpowers, and institutional sign-in methods.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/onboarding?step=role" variant="secondary" size="sm">
              Change platform role
            </ButtonLink>
          </div>
        </div>

        {/* Builder Profile Studio */}
        <ProfileEditor initialProfile={initialProfile} />

        {/* Sign-in & Authentication Methods */}
        <div className="mt-14 border-t border-[var(--color-line)] pt-10">
          <Heading as="h2" size="heading">
            Sign-in &amp; Security Credentials
          </Heading>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Choose how you authenticate on KNEST. Your applications, lab bookings, and founder data stay with this one account.
          </p>
          <p className="mt-2 text-xs font-mono text-[var(--color-ink-muted)]">
            Account email: <strong className="text-[var(--color-ink)]">{user.email}</strong>
          </p>

          <AccountMethods
            hasPassword={hasPassword}
            googleLinked={Boolean(google)}
            googleEnabled={googleConfigured()}
          />
        </div>
      </div>
    </Section>
  )
}
