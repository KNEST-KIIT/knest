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
    <div className="group relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-ink)] p-8 md:p-12 shadow-2xl text-white">
      {/* Background gradients and meshes for luxury feel */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[var(--color-signal)]/40 via-[var(--color-ink)] to-[var(--color-ink)] opacity-60 mix-blend-multiply" />
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-[var(--color-signal)] opacity-20 blur-[100px]" />

      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-[family-name:var(--font-display)] text-[length:var(--text-small)] uppercase tracking-widest text-[var(--color-paper)] backdrop-blur-md">
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
          <div className="mt-6 max-w-xl rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-[length:var(--text-small)] text-white/60">
              <strong className="text-white">Why this step:</strong> {reason}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href={actionHref}
            className="group/btn relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-white px-8 font-medium text-[var(--color-ink)] shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-transform hover:scale-105"
          >
            <span className="relative z-10">{actionLabel}</span>
            <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-black/5 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
          </Link>
        </div>
      </div>
    </div>
  )
}
