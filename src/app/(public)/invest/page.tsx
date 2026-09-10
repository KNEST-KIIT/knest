import type { Metadata } from 'next'
import { ButtonLink, EmptyState, Heading, LinkCard, Section, Tag } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { formatEventTime } from '@/lib/dates'
import { STARTUPS_EMPTY } from '@/lib/empty-state-copy'
import { stageLabel } from '@/lib/labels'
import { listUpcomingEvents } from '@/server/content/events'
import { listFeaturedStartups } from '@/server/content/startups'
import { listFounderArticles } from '@/server/content/articles'

export const metadata: Metadata = {
  title: 'Invest in the ecosystem',
  description:
    'KNEST’s dealflow is still forming. Here is exactly where it stands, what you would be backing, and the ways in.',
}

const WHAT_YOU_GET = [
  {
    title: 'First sight, not last',
    body: 'Ventures reach you while they are still deciding what to build, not once a round is already circled. That is worth more than a polished deck arriving late.',
  },
  {
    title: 'Diligence that already happened',
    body: 'Anything on this site came through a program: an application read by staff, a cohort that ran, mentors who worked with the team. You are not starting from a cold inbox.',
  },
  {
    title: 'A university behind the team',
    body: 'Labs, faculty, IP support and a campus to hire from. A KIIT venture starts with infrastructure most pre-seed companies pay for.',
  },
]

const WAYS_IN = [
  {
    title: 'Back a venture',
    body: 'Angel cheques and pre-seed rounds, once a venture is ready for one. We will tell you when it is not.',
  },
  {
    title: 'Judge or mentor',
    body: 'Sit on a demo day panel or take office hours. The fastest way to see how these teams actually think.',
  },
  {
    title: 'Sponsor the work',
    body: 'Grants, prize pools and lab equipment reach further at this stage than most cheques do.',
  },
]

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
    <>
      <PageHero
        eyebrow="For investors"
        title="Invest in the ecosystem."
        image="/images/stage_mentoring.jpg"
        lede="KNEST is building the pipeline of KIIT’s next founders. Some of it exists today — demo days, ventures already underway, the people behind them. Most of it is still ahead. This page shows both, honestly."
      />

      <Section padding="tight">
        <Heading as="h2" size="title">
          What you would be backing
        </Heading>
        <p className="mt-4 max-w-[58ch] text-[var(--color-ink-soft)]">
          KIIT has scale, labs and a large student body. What it has not had is a route from a student
          noticing a problem to a company someone can invest in. That route is what KNEST is.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {WHAT_YOU_GET.map((entry) => (
            <div
              key={entry.title}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
            >
              <Heading as="h3" size="heading">
                {entry.title}
              </Heading>
              <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {entry.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Upcoming demo days
        </Heading>
        {demoDays.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="mt-8"
            heading="No demo days scheduled yet."
            body="When a cohort is ready to show its work, it is listed here first — and invitations go to this list before anywhere else."
            action={<ButtonLink href="/events">See what else is on</ButtonLink>}
          />
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {demoDays.map((event) => (
              <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
                <Tag tone="archive">Demo day</Tag>
                <Heading as="h3" size="heading" className="mt-4">
                  {event.title}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                  {event.summary}
                </p>
                <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {formatEventTime(event.startsAt)}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Ventures underway
        </Heading>
        {startups.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="mt-8"
            {...STARTUPS_EMPTY}
            action={<ButtonLink href="/about#contact">Talk to us early</ButtonLink>}
          />
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {startups.map((startup) => (
              <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
                {startup.stage && <Tag tone="signal">{stageLabel(startup.stage)}</Tag>}
                <Heading as="h3" size="heading" className="mt-4">
                  {startup.name}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                  {startup.tagline}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Founder stories
        </Heading>
        {articles.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="mt-8"
            heading="No founder stories published yet."
            body="As ventures move through KNEST, the people behind them are written up here — what they tried, what failed, and what they would do differently."
            action={<ButtonLink href="/stories" variant="secondary">See all stories</ButtonLink>}
          />
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const startup = typeof article.startup === 'object' ? article.startup : null
              return (
                <LinkCard
                  key={article.id}
                  href={`/stories/${article.slug}`}
                  label={`Read ${startup?.name ?? article.title}'s story`}
                >
                  {startup && <Tag tone="signal">{startup.name}</Tag>}
                  <Heading as="h3" size="heading" className={startup ? 'mt-4' : undefined}>
                    {article.title}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {article.summary}
                  </p>
                  <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                    Read the story →
                  </span>
                </LinkCard>
              )
            })}
          </div>
        )}
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Ways in
        </Heading>
        <p className="mt-4 max-w-[58ch] text-[var(--color-ink-soft)]">
          Capital is one of them, and at this stage it is not always the most useful one.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {WAYS_IN.map((entry) => (
            <div
              key={entry.title}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
            >
              <Heading as="h3" size="heading">
                {entry.title}
              </Heading>
              <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {entry.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Want to talk?
          </Heading>
          <p className="mt-3 max-w-[52ch] text-[var(--color-ink-soft)]">
            Tell us what you invest in and at what stage, and we will tell you honestly whether there is
            anything here for you yet — and come back to you when there is.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/about#contact">Get in touch</ButtonLink>
            <ButtonLink href="/ecosystem" variant="secondary">
              See how it works
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
