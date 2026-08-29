import { ButtonLink } from '@/components/ui'
import { formatDeadline, formatDate } from '@/lib/dates'
import type { Program } from '@/payload/payload-types'
import { getSessionUser } from '@/server/auth/guards'
import { getApplicationStatusForUser } from '@/server/applications/actions'

/**
 * Every state a visitor can be in when they reach the apply decision
 * (UX_WIREFRAMES.md §4): open, closing soon, not yet open, closed, already
 * applied, or signed out. The button always says something true about what
 * happens next — never a bare "Apply" that hides which of these is real.
 */
export async function ApplyCta({ program }: { program: Program }) {
  const user = await getSessionUser()

  if (program.applicationStatus === 'opening_soon') {
    return (
      <div>
        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {program.applicationOpensAt ? `Opens ${formatDate(program.applicationOpensAt)}` : 'Opening soon'}
        </p>
        <ButtonLink href={`/programs/${program.slug}`} variant="secondary" size="lg" fullWidth className="mt-3">
          Notify me
        </ButtonLink>
      </div>
    )
  }

  if (program.applicationStatus === 'closed' || program.applicationStatus === 'in_progress') {
    return (
      <div>
        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {program.applicationStatus === 'in_progress'
            ? 'This cohort is in progress.'
            : program.nextCohortStart
              ? `The next cohort opens ${formatDate(program.nextCohortStart)}.`
              : 'Applications for this cohort have closed.'}
        </p>
        <ButtonLink href={`/programs/${program.slug}`} variant="secondary" size="lg" fullWidth className="mt-3">
          Notify me
        </ButtonLink>
      </div>
    )
  }

  // applicationStatus === 'open'
  if (user) {
    const existing = await getApplicationStatusForUser(user.id, program.id)
    if (existing) {
      return (
        <ButtonLink href="/dashboard/applications" size="lg" fullWidth>
          {existing === 'draft' ? 'Continue application' : 'View your application'}
        </ButtonLink>
      )
    }
  }

  return (
    <div>
      {program.applicationDeadline && (
        <p className="mb-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Closes {formatDeadline(program.applicationDeadline)}
        </p>
      )}
      <ButtonLink
        href={user ? `/apply/${program.slug}` : `/signup?next=${encodeURIComponent(`/apply/${program.slug}`)}`}
        size="lg"
        fullWidth
      >
        Apply to {program.title}
      </ButtonLink>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        About 20 minutes · you can save and come back
      </p>
    </div>
  )
}
