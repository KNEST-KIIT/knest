import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { getSessionUser } from '@/server/auth/guards'
import { enabledSections, getHomepage } from '@/server/content/homepage'
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
  { label: 'Programs', body: 'Structured paths from idea to venture, run in cohorts.' },
  { label: 'Mentors', body: 'People who’ve built things, made mistakes, and will tell you about both.' },
  { label: 'Space', body: 'Labs, studios and desks. Somewhere to build that isn’t your hostel room.' },
  { label: 'Industry', body: 'Introductions to companies, customers and partners you couldn’t reach alone.' },
  { label: 'Community', body: 'Other people building things. This turns out to matter more than anyone expects.' },
]

export default async function HomePage() {
  const [homepage, user] = await Promise.all([getHomepage(), getSessionUser(), track('landing_view')])
  const sections = enabledSections(homepage)

  return (
    <>
      {sections.map((key) => {
        switch (key) {
          case 'hero':
            return <Hero key={key} homepage={homepage} />

          case 'problem':
            return (
              <Section key={key} className="mx-auto max-w-[68ch]">
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
              <Section key={key} inverted className="mx-auto max-w-[68ch] text-center">
                <Heading as="h2" size="title">
                  {homepage.personHeading}
                </Heading>
                {homepage.personLines && homepage.personLines.length > 0 && (
                  <div className="mt-6 flex flex-col gap-2 text-[length:var(--text-heading)]">
                    {homepage.personLines.map((entry, i) => (
                      <p key={entry.id ?? i}>{entry.line}</p>
                    ))}
                  </div>
                )}
              </Section>
            )

          case 'knest':
            return (
              <Section key={key} className="mx-auto max-w-[68ch]">
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
            return (
              <Section key={key}>
                <TheJourney />
              </Section>
            )

          case 'offer':
            return (
              <Section key={key}>
                <Heading as="h2" size="display">
                  What KNEST actually gives you.
                </Heading>
                <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                  {OFFER_ITEMS.map((item) => (
                    <div key={item.label}>
                      <p className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase">
                        {item.label}
                      </p>
                      <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )

          case 'ecosystem':
            return (
              <Section key={key}>
                <TheEcosystem />
              </Section>
            )

          case 'startups':
            return (
              <Section key={key} className="flex min-h-[60vh] flex-col justify-center">
                <BuiltWithKnest homepage={homepage} />
              </Section>
            )

          case 'closing':
            return (
              <Section key={key} inverted className="text-center">
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
                    className="text-[length:var(--text-small)] font-medium text-[var(--color-paper)] underline underline-offset-4"
                  >
                    Browse programs
                  </Link>
                </div>
              </Section>
            )

          default:
            return null
        }
      })}
    </>
  )
}
