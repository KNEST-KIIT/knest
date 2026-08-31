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

export const metadata: Metadata = {
  title: 'KNEST — What if you actually built it?',
  description:
    "KIIT's university-wide innovation and entrepreneurship ecosystem. Programs, mentors, space and a community of people building things, at every stage.",
}

const OFFER_ITEMS = [
  { label: 'Programs', body: 'Structured paths from idea to venture, run in cohorts.', href: '#programs' },
  { label: 'Mentors', body: 'People who’ve built things, made mistakes, and will tell you about both.', href: '#mentors' },
  { label: 'Space', body: 'Labs, studios and desks. Somewhere to build that isn’t your hostel room.', href: '#space' },
  { label: 'Industry', body: 'Introductions to companies, customers and partners you couldn’t reach alone.', href: '#industry' },
  { label: 'Community', body: 'Other people building things. This turns out to matter more than anyone expects.', href: '#community' },
  { label: 'Capital', body: 'Direct grants, cloud credits, and introductions to seed investors when you scale.', href: '#capital' },
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
            return (
              <Section key={key} measure="prose">
                <Heading as="h2" size="title">
                  {homepage.problemHeading}
                </Heading>
                {homepage.problemBody && (
                  <div className="mt-6 flex flex-col gap-4 text-[var(--color-ink-soft)]">
                    {homepage.problemBody.split('\n\n').map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                )}
              </Section>
            )

          case 'person':
            return (
              <section key={key} className="relative w-full py-32 md:py-48 overflow-hidden bg-black text-white text-center">
                <div className="absolute inset-0 z-0">
                  <div className="absolute inset-0 bg-black/70 z-10"></div>
                  <img src="/images/stage_idea.jpg" alt="" className="w-full h-full object-cover opacity-40 grayscale" />
                </div>
                <div className="relative z-20 mx-auto max-w-[68ch] px-6">
                  <Heading as="h2" size="title" className="text-white">
                    {homepage.personHeading}
                  </Heading>
                  {homepage.personLines && homepage.personLines.length > 0 && (
                    <div className="mt-8 flex flex-col gap-3 text-[length:var(--text-heading)] font-light text-[var(--color-paper)]/90">
                      {homepage.personLines.map((entry, i) => (
                        <Reveal key={entry.id ?? i} delay={i * 0.15}>
                          <p>{entry.line}</p>
                        </Reveal>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )

          case 'knest':
            return (
              <Section key={key} measure="prose">
                <Heading as="h2" size="title">
                  {homepage.knestHeading}
                </Heading>
                {homepage.knestBody && <p className="mt-6 text-[var(--color-ink-soft)]">{homepage.knestBody}</p>}
              </Section>
            )

          case 'journey_selector':
            return (
              <Section key={key}>
                <JourneySelector signedIn={Boolean(user)} />
              </Section>
            )

          case 'journey':
            return <TheJourney key={key} allPrograms={allPrograms} />

          case 'offer':
            return (
              <Section key={key} className="py-24 md:py-32 relative bg-[var(--color-paper-soft)]">
                <RevealHeading size="display" className="tracking-tighter max-w-3xl">
                  What KNEST actually gives you.
                </RevealHeading>
                
                <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {OFFER_ITEMS.map((item, i) => (
                    <Reveal key={item.label} delay={i * 0.1}>
                      <Link href={item.href} className="group relative flex flex-col p-6 h-full rounded-2xl bg-white border border-[var(--color-line)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer">
                        {/* Animated background on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-signal-wash)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        {/* Animated border ring */}
                        <div className="absolute inset-0 border-2 border-transparent group-hover:border-[var(--color-signal)]/10 rounded-2xl transition-colors duration-300"></div>

                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors duration-300">
                              {item.label}
                            </h3>
                            <div className="font-[family-name:var(--font-display)] text-3xl font-light text-[var(--color-ink-soft)] opacity-40 group-hover:opacity-100 group-hover:text-[var(--color-signal)] transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3 origin-center">
                              {String(i + 1).padStart(2, '0')}
                            </div>
                          </div>
                          
                          <p className="text-[var(--color-ink-soft)] text-sm leading-relaxed group-hover:text-[var(--color-ink)] transition-colors duration-300 flex-grow">
                            {item.body}
                          </p>
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
            return (
              <Section key={key} className="flex min-h-[60vh] flex-col justify-center">
                <BuiltWithKnest homepage={homepage} />
              </Section>
            )

          case 'closing':
            return (
              <div key={key} className="bg-[var(--color-ink)] py-32 md:py-48 border-t-8 border-[var(--color-signal)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 z-0"></div>
                <Section inverted className="text-center relative z-10">
                <Heading as="h2" size="display">
                  {homepage.closingHeading}
                </Heading>
                {homepage.closingBody && (
                  <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-paper)]/80">
                    {homepage.closingBody}
                  </p>
                )}
                <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
                  <ButtonLink href="/signup" size="lg">
                    {homepage.closingCta ?? 'Start your journey'}
                  </ButtonLink>
                  <Link
                    href="/programs"
                    className="inline-flex h-11 items-center text-[length:var(--text-small)] font-medium text-[var(--color-paper)] underline underline-offset-4"
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
