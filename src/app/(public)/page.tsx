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
import { BuiltWithKnest } from './built-with-knest'
import { Narrative } from './narrative'

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
]

export default async function HomePage() {
  const [homepage, user, programsResult] = await Promise.all([
    getHomepage(),
    getSessionUser(),
    // The front door must survive a CMS outage, and say so honestly: the journey
    // section shows "unavailable", never an empty or invented programs list.
    listPrograms({}).then(
      (programs) => ({ programs, unavailable: false as const }),
      (error) => {
        console.error('Homepage: could not load programs', error)
        return { programs: [], unavailable: true as const }
      },
    ),
    track('landing_view'),
  ])
  const sections = enabledSections(homepage)

  return (
    <>
      {sections.map((key) => {
        switch (key) {
          case 'hero':
            return <Hero key={key} homepage={homepage} />

          case 'problem':
            return <Narrative key={key} homepage={homepage} />

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
            return <TheJourney key={key} allPrograms={programsResult.programs} programsUnavailable={programsResult.unavailable} />

          case 'offer':
            return (
              <Section key={key} className="py-10 md:py-14 relative bg-[var(--color-paper-soft)]">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-[var(--color-line)] relative">
                  <div>
                    <Reveal delay={0.1}>
                      <p className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)] mb-3">
                        What KNEST offers
                      </p>
                    </Reveal>
                    <RevealHeading as="h2" size="display" className="tracking-tight text-4xl md:text-5xl font-bold text-[var(--color-ink)] leading-[1.1]">
                      What KNEST actually gives you.
                    </RevealHeading>
                  </div>
                </div>
                
                <div className="border border-[var(--color-line)] bg-white/80 divide-y divide-[var(--color-line)] shadow-[0_4px_24px_rgba(13,19,33,0.02)] backdrop-blur-sm">
                  {OFFER_ITEMS.map((item, i) => (
                    <Reveal key={item.label} delay={i * 0.05}>
                      <Link
                        href={item.href}
                        className="group relative flex flex-col md:flex-row md:items-center py-5 sm:py-7 px-6 sm:px-8 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] hover:bg-[var(--color-paper)]/50"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-signal)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]" />
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-signal)] scale-y-0 group-hover:scale-y-100 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] origin-top" />
                        
                        <div className="relative w-14 shrink-0 font-mono text-lg sm:text-xl font-bold text-[var(--color-signal)]/30 group-hover:text-[var(--color-signal)] group-hover:translate-x-2 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        
                        <div className="relative md:w-1/4 pr-4">
                          <h3 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors duration-300">
                            {item.label}
                          </h3>
                        </div>
                        
                        <div className="relative flex-1 mt-2 md:mt-0">
                          <p className="text-[var(--color-ink-soft)] text-sm sm:text-base font-light leading-relaxed group-hover:text-[var(--color-ink)] transition-colors duration-300">
                            {item.body}
                          </p>
                        </div>

                        <div className="relative shrink-0 pl-4 text-right hidden md:block">
                          <span className="font-mono text-xl font-bold text-[var(--color-signal)] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] inline-block">
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
            return null

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
