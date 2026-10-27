import { Heading } from '@/components/ui'
import { applicationDeadlineState, brochureLink, SIEL } from '@/content/siel'
import { formatDate } from '@/lib/dates'

const LABEL = 'text-xs font-bold uppercase tracking-widest text-[var(--color-ink-muted)]'

/**
 * Admissions at a glance for the SIEL programme.
 *
 * Three rules from the stakeholder change list govern it: the cohort start is 13 July 2027; an application
 * deadline appears only once a confirmed date exists (the earlier one is outdated, so until then the page says
 * the date is awaiting confirmation); and there is exactly one brochure call to action, the download at the top
 * of this panel. Nothing below it repeats the offer. While no brochure has been supplied, the panel says so
 * instead of linking to nothing.
 */
export function SielAdmissions() {
  const deadline = applicationDeadlineState()
  const brochure = brochureLink()
  return (
    <section aria-labelledby="siel-admissions-heading" className="mt-10 border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading as="h3" size="heading" id="siel-admissions-heading">
            Admissions at a glance
          </Heading>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {SIEL.programmeName}. Eligibility and the full admission process are published by {SIEL.shortName} at siel.kiit.ac.in.
          </p>
        </div>
        {brochure ? (
          <a
            href={brochure}
            {...(brochure.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="inline-flex min-h-11 items-center gap-2 border border-[var(--color-signal)] bg-[var(--color-signal)] px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[var(--color-signal-deep)]"
          >
            Download the brochure (PDF)
          </a>
        ) : (
          <p className="max-w-xs text-sm text-[var(--color-ink-soft)]">
            The brochure is not available yet. It will be linked here once it is published.
          </p>
        )}
      </div>

      <dl className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className={LABEL}>Cohort start</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
            <time dateTime={SIEL.cohortStart}>{formatDate(SIEL.cohortStart)}</time>
          </dd>
        </div>
        <div>
          <dt className={LABEL}>Application deadline</dt>
          {deadline.kind === 'confirmed' ? (
            <dd className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
              <time dateTime={deadline.iso}>{formatDate(deadline.iso)}</time>
            </dd>
          ) : (
            <dd className="mt-1">
              <span className="text-lg font-semibold text-[var(--color-ink)]">Awaiting confirmation</span>
              <span className="mt-1 block text-sm text-[var(--color-ink-soft)]">The date will be shown here once {SIEL.shortName} confirms it.</span>
            </dd>
          )}
        </div>
      </dl>
    </section>
  )
}
