import Link from 'next/link'
import { Heading, Section } from '@/components/ui'
import type { EcosystemGroup } from '@/server/content/ecosystem-groups'

/**
 * The homepage triple-helix section: academia, industry, and government and
 * community, each listing only what the platform actually holds. Counts come
 * from published CMS rows (see src/server/content/ecosystem-counts.ts); a
 * zero count never renders, and with nothing to show the whole section is
 * absent. The only fixed words are the three group names and the record
 * labels, so the section makes no institutional claim of its own.
 */
export function EcosystemSection({
  groups,
  metrics,
  testimonials,
}: {
  groups: EcosystemGroup[]
  metrics?: unknown[] | null
  testimonials?: unknown[] | null
}) {
  const validMetrics = (metrics ?? []).filter(
    (m): m is { id: string | number; label: string; value: string; asOf?: string } =>
      Boolean(m && typeof m === 'object' && 'label' in m && 'value' in m),
  )

  const validTestimonials = (testimonials ?? []).filter(
    (t): t is { id: string | number; quote: string; attribution: string; role?: string | null } =>
      Boolean(t && typeof t === 'object' && 'quote' in t && 'attribution' in t),
  )

  if (groups.length === 0 && validMetrics.length === 0 && validTestimonials.length === 0) return null

  return (
    <Section className="border-t border-[var(--color-line)]">
      {groups.length > 0 && (
        <>
          <div className="max-w-3xl">
            <Heading as="h2" size="display">
              Who is on the platform.
            </Heading>
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-ink-soft)]">
              Counted from the published records, so it changes as people and partners are added.
            </p>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`ecosystem-${group.key}`} className="min-w-0 border-t-2 border-[var(--color-ink)] pt-5">
                <h3 id={`ecosystem-${group.key}`} className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-signal)]">
                  {group.title}
                </h3>
                <ul className="mt-5 space-y-4">
                  {group.stats.map((stat) => (
                    <li key={stat.key}>
                      <Link
                        href={stat.href}
                        className="group flex items-baseline gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)]"
                      >
                        <span className="font-[family-name:var(--font-display)] text-4xl font-bold tabular-nums text-[var(--color-ink)]">
                          {stat.value}
                        </span>
                        <span className="text-base text-[var(--color-ink-soft)] group-hover:text-[var(--color-ink)] group-hover:underline">
                          {stat.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {validMetrics.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[var(--color-line)]">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-6">
            Verified impact
          </h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {validMetrics.map((m) => (
              <div key={m.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5 shadow-sm">
                <span className="font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-[var(--color-ink)]">
                  {m.value}
                </span>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {validTestimonials.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[var(--color-line)]">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-6">
            Voices from the community
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {validTestimonials.map((t) => (
              <figure key={t.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-6 flex flex-col justify-between shadow-sm">
                <blockquote className="text-[length:var(--text-body)] text-[var(--color-ink-soft)] italic leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 pt-4 border-t border-[var(--color-line)]/50">
                  <div className="font-semibold text-[var(--color-ink)]">{t.attribution}</div>
                  {t.role && <div className="text-xs text-[var(--color-ink-muted)] mt-0.5">{t.role}</div>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}
