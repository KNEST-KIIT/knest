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
export function EcosystemSection({ groups }: { groups: EcosystemGroup[] }) {
  if (groups.length === 0) return null

  return (
    <Section className="border-t border-[var(--color-line)]">
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
    </Section>
  )
}
