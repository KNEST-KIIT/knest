import { ButtonLink, Heading, LinkCard } from '@/components/ui'
import { listFeaturedStartups } from '@/server/content/startups'
import { NextStepCard } from './next-step-card'

const journeys = {
  investor: {
    heading: 'Meet the ventures taking shape.',
    body: 'Explore vetted campus startups, founder traction metrics, and upcoming demo days. Request warm introductions directly through the KNEST incubation desk.',
    actionLabel: 'Explore the ecosystem',
    actionHref: '/invest',
    contact: 'Request Founder Introduction',
    topic: 'partnership',
  },
  alumni: {
    heading: 'Bring your experience back to the community.',
    body: 'Offer 1-on-1 mentoring, host a technical masterclass, or evaluate cohort pitch competitions. Help shape the next generation of KIIT founders.',
    actionLabel: 'Offer your support',
    actionHref: '/contact?topic=mentor',
    contact: 'Discuss another way to help',
    topic: 'partnership',
  },
  partner: {
    heading: 'Build a partnership with KNEST.',
    body: 'Sponsor maker space equipment, run corporate innovation challenges, or access top-tier engineering talent directly from Campus 15B.',
    actionLabel: 'Start a partnership conversation',
    actionHref: '/contact?topic=partnership',
    contact: 'Ask a general question',
    topic: 'general',
  },
} as const

export async function ContributionDashboard({ role }: { role: keyof typeof journeys }) {
  const journey = journeys[role]
  const featuredStartups = role === 'investor' ? await listFeaturedStartups(6).catch(() => []) : []

  return (
    <div className="flex flex-col gap-10">
      {/* Hero Command Next Step */}
      <NextStepCard
        eyebrow={role === 'investor' ? 'Deal Room Active' : 'Community Pathway'}
        heading={journey.heading}
        body={journey.body}
        actionLabel={journey.actionLabel}
        actionHref={journey.actionHref}
      />

      {/* Investor Deal Room Section */}
      {role === 'investor' && (
        <section className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-signal)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
                  Active Dealflow
                </span>
                <span className="text-xs text-[var(--color-ink-muted)]">· Verified KNEST Cohort Startups</span>
              </div>
              <Heading as="h2" size="heading" uppercase={false} className="mt-1">
                Incubated Campus Ventures
              </Heading>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Browse student and faculty-led ventures at prototype, validation, and early revenue stages.
              </p>
            </div>
            <ButtonLink href="/startups" variant="secondary" size="sm">
              View all startups →
            </ButtonLink>
          </div>

          {featuredStartups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredStartups.map((startup) => (
                <div
                  key={startup.id}
                  className="group flex flex-col justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)]/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-signal)]/50 hover:bg-white hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
                        {startup.stage || 'Incubation'}
                      </span>
                      {startup.sectors?.[0] && (
                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-muted)] border border-[var(--color-line)]">
                          {startup.sectors[0]}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                      {startup.name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)] line-clamp-2 leading-relaxed">
                      {startup.tagline}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[var(--color-line)]/60 pt-3">
                    <ButtonLink href={`/startups/${startup.slug}`} size="sm" variant="secondary" className="w-full text-center">
                      View Venture Profile →
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Startups are currently in evaluation
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                New cohort startups are published after review by the investment committee.
              </p>
              <ButtonLink href="/startups" variant="secondary" size="sm" className="mt-4">
                Explore Startup Directory
              </ButtonLink>
            </div>
          )}
        </section>
      )}

      {/* Community & Ecosystem Links */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <Heading as="h2" size="heading" uppercase={false} className="mb-4">
          Ecosystem Access &amp; Engagement
        </Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <LinkCard href="/events" label="Browse upcoming events" className="group !p-5 hover:border-[var(--color-signal)]/60 transition-all">
            <p className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
              Upcoming Demo Days &amp; Firesides
            </p>
            <p className="mt-1.5 text-xs text-[var(--color-ink-soft)] leading-relaxed">
              Attend student pitch clinics, demo days, and ecosystem networking events.
            </p>
          </LinkCard>

          <LinkCard href="/startups" label="Meet the startups" className="group !p-5 hover:border-[var(--color-signal)]/60 transition-all">
            <p className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
              Public Startup Directory
            </p>
            <p className="mt-1.5 text-xs text-[var(--color-ink-soft)] leading-relaxed">
              Explore founding stories, technical IP, and milestones achieved by KIIT teams.
            </p>
          </LinkCard>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-[var(--color-line)] pt-4">
          <span className="text-xs text-[var(--color-ink-muted)]">
            Need direct assistance from the KNEST leadership desk?
          </span>
          <ButtonLink href={`/contact?topic=${journey.topic}`} variant="primary" size="sm">
            {journey.contact} →
          </ButtonLink>
        </div>
      </section>
    </div>
  )
}
