import Link from 'next/link'
import { Heading } from '@/components/ui'

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
    <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink)] bg-[var(--color-ink)] p-8 md:p-12 text-white">
      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-white/20 bg-white/10 px-3 py-1 font-[family-name:var(--font-display)] text-[length:var(--text-small)] uppercase tracking-widest text-[var(--color-paper)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-signal)]" />
          {eyebrow}
        </p>
        
        <Heading as="h2" size="display" className="mt-6 max-w-2xl text-3xl md:text-5xl text-white">
          {heading}
        </Heading>
        
        <p className="mt-4 max-w-xl text-[length:var(--text-body)] leading-relaxed text-white/70">
          {body}
        </p>
        
        {reason && (
          <div className="mt-6 max-w-xl rounded-[var(--radius-sm)] border border-white/15 bg-white/5 p-4">
            <p className="text-[length:var(--text-small)] text-white/60">
              <strong className="text-white">Why this step:</strong> {reason}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href={actionHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] bg-white px-8 py-3 text-center font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors duration-200 motion-reduce:transition-none"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
