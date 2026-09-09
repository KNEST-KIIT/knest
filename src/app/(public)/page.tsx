import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink, Heading, Section, Reveal, RevealHeading } from '@/components/ui'
import { getSessionUser } from '@/server/auth/guards'
import { enabledSections, getHomepage } from '@/server/content/homepage'
import { listPrograms } from '@/server/content/programs'
import { track } from '@/server/analytics/track'
import { Hero } from './hero'
import { JourneySelector } from './journey-selector'
import { TheJourney } from './the-journey'
import { TheEcosystem } from './the-ecosystem'
import { BuiltWithKnest } from './built-with-knest'
import { ExecutionFlow } from './execution-flow'

export const metadata: Metadata = {
  title: 'KNEST — What if you actually built it?',
  description:
    "KIIT's university-wide innovation and entrepreneurship ecosystem. Programs, mentors, space and a community of people building things, at every stage.",
}

const OFFER_ITEMS = [
  { label: 'Programs', body: 'Structured paths from idea to venture, run in cohorts.', href: '/programs' },
  { label: 'Mentors', body: 'People who’ve built things, made mistakes, and will tell you about both.', href: '/mentors' },
  { label: 'Space', body: 'Labs, studios and desks. Somewhere to build that isn’t your hostel room.', href: '/ecosystem#infrastructure' },
  { label: 'Industry', body: 'Introductions to companies, customers and partners you couldn’t reach alone.', href: '/ecosystem#partners' },
  { label: 'Community', body: 'Other people building things. This turns out to matter more than anyone expects.', href: '/about' },
  { label: 'Capital', body: 'Direct grants, cloud credits, and introductions to seed investors when you scale.', href: '/invest' },
]

export default async function HomePage() {
  const [homepage, user, allPrograms] = await Promise.all([getHomepage(), getSessionUser(), listPrograms({}), track('landing_view')])
  const sections = enabledSections(homepage)

  return (
    <>
      {sections.map((key) => {
        switch (key) {
          case 'hero':
            return <Hero key={key} homepage={homepage} />

          case 'problem':
            return <ExecutionFlow key={key} homepage={homepage} />

          case 'person':
            return null

          case 'knest':
            return null

          case 'journey_selector':
            return (
              <Section key={key} className="!py-6 md:!py-8">
                <JourneySelector signedIn={Boolean(user)} />
              </Section>
            )

          case 'journey':
            return <TheJourney key={key} allPrograms={allPrograms} />

          case 'offer':
            return (
              <Section key={key} className="py-10 md:py-14 relative bg-[var(--color-paper-soft)]">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 pb-4 border-b border-[var(--color-line)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)] mb-1.5">
                      The KNEST Guarantee
                    </p>
                    <RevealHeading size="display" className="tracking-tight text-3xl md:text-4xl font-bold text-[var(--color-ink)]">
                      What KNEST actually gives you.
                    </RevealHeading>
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mt-2 md:mt-0">
                    6 Core Operational Linkages
                  </p>
                </div>
                
                <div className="border border-[var(--color-line)] bg-white/70 divide-y divide-[var(--color-line)] shadow-sm">
                  {OFFER_ITEMS.map((item, i) => (
                    <Reveal key={item.label} delay={i * 0.05}>
                      <Link
                        href={item.href}
                        className="group flex flex-col md:flex-row md:items-center py-4 sm:py-5 px-5 sm:px-7 border-l-4 border-l-transparent hover:border-l-[var(--color-signal)] hover:bg-gradient-to-r hover:from-[#f4e4e2] hover:via-white hover:to-white transition-all duration-300 cursor-pointer"
                      >
                        <div className="w-14 shrink-0 font-mono text-lg sm:text-xl font-bold text-[var(--color-signal)]/45 group-hover:text-[var(--color-signal)] group-hover:scale-110 transition-all">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        
                        <div className="md:w-1/4 pr-4">
                          <h3 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors duration-200">
                            {item.label}
                          </h3>
                        </div>
                        
                        <div className="flex-1 mt-1.5 md:mt-0">
                          <p className="text-[var(--color-ink-soft)] text-sm sm:text-[15px] font-light leading-relaxed group-hover:text-[var(--color-ink)] transition-colors duration-200">
                            {item.body}
                          </p>
                        </div>

                        <div className="shrink-0 pl-4 text-right hidden md:block">
                          <span className="font-mono text-base font-bold text-[var(--color-signal)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-200 inline-block">
                            →
                          </span>
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </Section>
            )

          case 'ecosystem':
            return <TheEcosystem key={key} />

          case 'startups':
            return null

          case 'closing':
            return (
              <div key={key} className="bg-[var(--color-ink)] py-16 md:py-24 border-t border-[var(--color-signal)] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--color-signal)_0%,_transparent_70%)] mix-blend-screen pointer-events-none"></div>
                <Section inverted className="text-center relative z-10 !py-0">
                <Heading as="h2" size="display" className="text-white">
                  {homepage.closingHeading}
                </Heading>
                {homepage.closingBody && (
                  <p className="mt-6 text-lg md:text-xl font-light text-[var(--color-paper)]/80 max-w-2xl mx-auto">
                    {homepage.closingBody}
                  </p>
                )}
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
                  <ButtonLink href="/signup" size="lg" className="rounded-none uppercase tracking-widest text-sm px-8 border border-white hover:bg-white hover:text-[var(--color-ink)]">
                    {homepage.closingCta ?? 'Start your journey'}
                  </ButtonLink>
                  <Link
                    href="/programs"
                    className="text-sm uppercase tracking-widest font-bold text-[var(--color-paper)]/70 hover:text-white border-b border-[var(--color-paper)]/30 hover:border-white transition-colors"
                  >
                    Browse programs
                  </Link>
                </div>
              </Section>
              </div>
            )

          default:
            return null
        }
      })}
    </>
  )
}
