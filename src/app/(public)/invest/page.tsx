import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading, LinkCard, Section, Tag } from '@/components/ui'
import { formatEventTime } from '@/lib/dates'
import { STARTUPS_EMPTY } from '@/lib/empty-state-copy'
import { listUpcomingEvents } from '@/server/content/events'
import { listFeaturedStartups } from '@/server/content/startups'
import { listFounderArticles } from '@/server/content/articles'

export const metadata: Metadata = {
  title: 'Invest in the ecosystem',
  description: "KNEST's dealflow is still forming. Here's where it stands, honestly.",
}

/**
 * Deliberately not a dashboard or a pipeline (PHASE-7-9-IMPLEMENTATION-PLAN.md
 * §4.6) — KNEST has no dealflow yet, and a filterable investor view over an
 * empty startup pipeline would communicate exactly one true thing: that the
 * ecosystem is younger than the page claims. This is a pure content-assembly
 * page over three collections that already exist; each section carries its
 * own honest empty state rather than hiding when there's nothing to show.
 */
export default async function InvestPage() {
  const [demoDays, startups, articles] = await Promise.all([
    listUpcomingEvents({ eventType: 'demo_day' }),
    listFeaturedStartups(6),
    listFounderArticles(6),
  ])

  return (
    <Section>
      <Heading as="h1" size="display">
        Invest in the ecosystem.
      </Heading>
      <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
        KNEST is building the pipeline of KIIT&rsquo;s next founders. Some of it exists today —
        demo days, ventures already underway, the stories behind them. Most of it is still
        ahead. This page shows both, honestly.
      </p>

      <div className="mt-16">
        <Heading as="h2" size="title">
          Upcoming demo days
        </Heading>
        {demoDays.length === 0 ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="No demo days scheduled yet."
            body="When a cohort is ready to show its work, it'll be listed here first."
          />
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {demoDays.map((event) => (
              <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
                <Tag tone="archive">Demo day</Tag>
                <Heading as="h3" size="heading" className="mt-4">
                  {event.title}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{event.summary}</p>
                <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {formatEventTime(event.startsAt)}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </div>

      <div className="mt-16">
        <Heading as="h2" size="title">
          Startups from the ecosystem
        </Heading>
        {startups.length === 0 ? (
          <EmptyState headingLevel="h3" className="mt-6" {...STARTUPS_EMPTY} />
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {startups.map((startup) => (
              <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
                {startup.stage && <Tag tone="signal">{startup.stage}</Tag>}
                <Heading as="h3" size="heading" className="mt-4">
                  {startup.name}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{startup.tagline}</p>
              </LinkCard>
            ))}
          </div>
        )}
      </div>

      <div className="mt-16">
        <Heading as="h2" size="title">
          Founder stories
        </Heading>
        {articles.length === 0 ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="No founder stories published yet."
            body="As ventures move through KNEST, the people behind them will be featured here."
          />
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const startup = typeof article.startup === 'object' ? article.startup : null
              return (
                <LinkCard
                  key={article.id}
                  href={startup ? `/startups/${startup.slug}` : '#'}
                  label={`Read ${startup?.name ?? article.title}'s story`}
                >
                  <Heading as="h3" size="heading">
                    {article.title}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{article.summary}</p>
                  {startup && (
                    <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                      Read {startup.name}&rsquo;s story →
                    </span>
                  )}
                </LinkCard>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-16 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8">
        <Heading as="h2" size="heading">
          Want to talk?
        </Heading>
        <p className="mt-3 max-w-[52ch] text-[var(--color-ink-soft)]">
          If you&rsquo;d like to support KNEST&rsquo;s founders — as a mentor, a partner or an
          investor — reach out and we&rsquo;ll connect you with the right people.
        </p>
        <Link
          href="/about#contact"
          className="mt-6 inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-6 font-medium text-white hover:bg-[var(--color-signal-deep)]"
        >
          Get in touch
        </Link>
      </div>
    </Section>
  )
}
