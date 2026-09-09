import { ButtonLink, Heading } from '@/components/ui'

/**
 * The single-action hero card (CONTENT_SPEC.md §5) — one visual shape reused
 * across dashboard variants for whichever item deserves the primary slot
 * (a student's recommended path, a founder's next milestone) rather than
 * three near-duplicate one-off cards.
 */
export function NextStepCard({
  eyebrow,
  heading,
  body,
  reason,
  actionLabel,
  actionHref,
}: {
  eyebrow: string
  heading: string
  body: string
  reason?: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6 md:p-8">
      <p className="font-[family-name:var(--font-display)] text-[length:var(--text-small)] uppercase tracking-[0.14em] text-[var(--color-signal)]">
        {eyebrow}
      </p>
      <Heading as="h2" size="heading" className="mt-2" uppercase={false}>
        {heading}
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">{body}</p>
      {reason && (
        <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          <strong>Why this: </strong>
          {reason}
        </p>
      )}
      <div className="mt-6">
        <ButtonLink href={actionHref}>{actionLabel}</ButtonLink>
      </div>
    </div>
  )
}
