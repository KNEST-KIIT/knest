import { EmptyState, Heading, LinkCard, Tag } from '@/components/ui'
import { STARTUPS_EMPTY } from '@/lib/empty-state-copy'
import { listStartups } from '@/server/content/startups'
import type { Homepage, Startup } from '@/payload/payload-types'

/**
 * BUILT WITH KNEST — signature experience 05 (CONTENT_SPEC.md §1.9).
 * Renders at full section height whether populated or empty — the empty
 * state (spec §46's honest-first discipline) is the expected launch state,
 * not a fallback to hide.
 */
export async function BuiltWithKnest({ homepage }: { homepage: Homepage }) {
  const curated = (homepage.featuredStartups ?? []).filter(
    (s): s is Startup => typeof s === 'object',
  )
  const startups = curated.length > 0 ? curated : await listStartups()

  return (
    <div>
      {startups.length === 0 ? (
        <EmptyState {...STARTUPS_EMPTY} size="default" />
      ) : (
        <>
          <Heading as="h2" size="display">
            Built with KNEST.
          </Heading>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {startups.slice(0, 6).map((startup) => (
              <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
                {startup.stage && <Tag tone="signal">{startup.stage}</Tag>}
                <Heading as="h3" size="heading" className="mt-4">
                  {startup.name}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                  {startup.tagline}
                </p>
              </LinkCard>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
