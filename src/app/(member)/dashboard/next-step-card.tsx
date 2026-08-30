import Link from 'next/link'

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
  body?: string
  reason?: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6 md:p-8">
      <p className="font-[family-name:var(--font-display)] text-[length:var(--text-small)] uppercase tracking-[0.14em] text-[var(--color-signal)]">
        {eyebrow}
      </p>
      {/*
        The text face, not the display face. Anton is a condensed poster
        cut drawn for caps and short labels; this heading is a full
        sentence ("You have an idea. The next job is finding out if it's
        real."), and a sentence set in a condensed poster face lowercase
        is cramped and slow to read. Display type for labels, text type
        for sentences — the size still carries the hierarchy.
      */}
      <h2 className="mt-2 text-[length:var(--text-heading)] font-semibold leading-snug">{heading}</h2>
      {body && <p className="mt-2 text-[var(--color-ink-soft)]">{body}</p>}
      {reason && (
        <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          <strong>Why this: </strong>
          {reason}
        </p>
      )}
      <Link
        href={actionHref}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-6 text-[length:var(--text-small)] font-medium text-white hover:bg-[var(--color-signal-deep)]"
      >
        {actionLabel}
      </Link>
    </div>
  )
}
