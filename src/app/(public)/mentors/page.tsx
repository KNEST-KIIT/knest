import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Avatar, ButtonLink, EmptyState, Heading, LinkCard, LiveRegion, Section } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { resultSummary } from '@/lib/result-summary'
import { MENTORS_EMPTY } from '@/lib/empty-state-copy'
import { expertiseLabel } from '@/lib/labels'
import { EXPERTISE_OPTIONS } from '@/payload/fields/taxonomy'
import { listMentors } from '@/server/content/mentors'
import { NeedSelect } from './need-select'
import { AvailabilityBadge } from './availability-badge'

export const metadata: Metadata = {
  title: 'Mentors',
  description:
    'Founders, operators and investors who have agreed to help KIIT students build. Start from what you are stuck on.',
}

const HOW_IT_WORKS = [
  {
    title: 'Come with a question, not a pitch',
    body: '“How do I price this?” gets you an hour of real help. “Can I pick your brain?” gets you a polite reply and nothing else.',
  },
  {
    title: 'Availability is honest',
    body: 'Open, limited or unavailable, shown as it is. A mentor who is out of time this term stays listed and stays honest about it, rather than quietly disappearing.',
  },
  {
    title: 'Advice, not obligation',
    body: 'A mentor is not an investor, a co-founder or a guarantee. They give you a shortcut past a mistake they already made — what you do with it is yours.',
  },
]

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const expertise = params.expertise

  // The whole directory, so the "I need help with" list can be built from the
  // areas real mentors actually cover, then narrowed in memory.
  const all = await listMentors()
  const mentors = expertise ? all.filter((m) => (m.expertise ?? []).some((area) => area === expertise)) : all

  const covered = new Set(all.flatMap((m) => m.expertise ?? []))
  const needOptions = EXPERTISE_OPTIONS.filter(
    (option) => covered.has(option.value) || option.value === expertise,
  ).map((option) => ({ value: option.value, label: option.label }))
  // One area on offer is not a choice — it is a button that hides everyone else.
  const offerNeeds = needOptions.length >= 2

  const label = expertise ? expertiseLabel(expertise) : undefined
  const summary = resultSummary(mentors.length, 'mentor', {
    hasFilters: Boolean(expertise),
    emptyNoFilters: 'No mentors listed yet.',
    emptyWithFilters: label ? `No mentors listed for ${label} yet.` : undefined,
    qualifier: label ? `for ${label}` : undefined,
  })

  return (
    <>
      <PageHeader
        kicker="Mentors"
        title="Find who can help."
        description="You already know what you’re stuck on. Start there, not with a directory of photographs — every mentor here has agreed to help KIIT students specifically, and has been vouched for by KNEST."
      />

      <Section padding="top">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          {offerNeeds && (
            <div className="lg:max-w-[280px]">
              <Suspense>
                <NeedSelect options={needOptions} />
              </Suspense>
            </div>
          )}

          <div className={offerNeeds ? '' : 'lg:col-span-2'}>
            <LiveRegion message={summary} />

            {mentors.length === 0 && expertise ? (
              <EmptyState
                heading="Nobody covers that yet"
                body={`No one in the directory lists ${expertiseLabel(expertise)} at the moment. Try a neighbouring area, or tell us what you need and we will look for someone.`}
                action={<ButtonLink href="/mentors" variant="secondary">Show everyone</ButtonLink>}
              />
            ) : mentors.length === 0 ? (
              <EmptyState
                {...MENTORS_EMPTY}
                action={<ButtonLink href="/about#contact">Introduce yourself</ButtonLink>}
              />
            ) : (
              <>
                <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {summary}
                </p>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {mentors.map((mentor) => (
                    <LinkCard key={mentor.id} href={`/mentors/${mentor.slug}`} label={`View ${mentor.name}`}>
                      <Avatar
                        name={mentor.name}
                        src={typeof mentor.photo === 'object' ? mentor.photo?.url : null}
                        size="lg"
                      />
                      <Heading as="h2" size="heading" className="mt-4">
                        {mentor.name}
                      </Heading>
                      <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                        {[mentor.title, mentor.organization].filter(Boolean).join(' · ')}
                      </p>
                      {mentor.expertise && mentor.expertise.length > 0 && (
                        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                          {mentor.expertise.map(expertiseLabel).join(' · ')}
                        </p>
                      )}
                      <div className="mt-4">
                        <AvailabilityBadge availability={mentor.availability ?? 'limited'} />
                      </div>
                    </LinkCard>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          How mentoring works here
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          Three things worth knowing before you write to anyone.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {HOW_IT_WORKS.map((entry) => (
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

      <Section id="become-a-mentor" padding="tight" className="scroll-mt-24 border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Are you a mentor?
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            Mentor profiles are added by KNEST rather than self-serve — everyone listed is someone the
            team has vouched for. If you have built something, run something, or funded something, and
            you can give a few hours a term, we would like to hear from you.
          </p>
          <p className="mt-3 max-w-[56ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            KIIT alumni especially: you are one step ahead of the people asking, which makes you more
            useful than someone ten steps ahead who has forgotten the beginning.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/about#contact">Get in touch</ButtonLink>
            <Link
              href="/ecosystem"
              className="inline-flex h-11 items-center text-[length:var(--text-small)] font-medium underline underline-offset-4"
            >
              See how the ecosystem fits together
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}
