import type { Metadata } from 'next'
import { ButtonLink, Section, SectionHeading } from '@/components/ui'
import { requireOnboardedUser } from '@/server/auth/guards'
// This page alone enforces onboarding completion — see the layout for why.

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * A minimal placeholder. The full role-aware dashboard — one next step for a
 * student, application status and milestones for a founder — is Phase 7;
 * this exists now only so links already built (onboarding's completion,
 * the apply CTA) land somewhere real rather than a 404.
 */
export default async function DashboardPage() {
  const user = await requireOnboardedUser('/dashboard')

  return (
    <Section>
      <SectionHeading as="h1">Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}.</SectionHeading>
      <p className="mt-4 text-[var(--color-ink-soft)]">
        Your full dashboard is being built. In the meantime, here&rsquo;s where things stand.
      </p>
      <div className="mt-8 flex gap-4">
        <ButtonLink href="/dashboard/applications">Your applications</ButtonLink>
        <ButtonLink href="/programs" variant="secondary">
          Browse programs
        </ButtonLink>
      </div>
    </Section>
  )
}
