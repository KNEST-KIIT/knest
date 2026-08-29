import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Avatar, EmptyState, Heading, LinkCard, LiveRegion, Section } from '@/components/ui'
import { EXPERTISE_OPTIONS } from '@/payload/fields/taxonomy'
import { listMentors, type MentorFilters as Filters } from '@/server/content/mentors'
import { NeedSelect } from './need-select'
import { AvailabilityBadge } from './availability-badge'

export const metadata: Metadata = {
  title: 'Mentors',
  description: 'You already know what you need help with. Start there.',
}

function expertiseLabel(value: string): string {
  return EXPERTISE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function resultSummary(count: number, expertise: string | undefined): string {
  if (count === 0) {
    return expertise ? `No mentors listed for ${expertiseLabel(expertise)} yet.` : 'No mentors yet.'
  }
  return `${count} mentor${count === 1 ? '' : 's'}${expertise ? ` for ${expertiseLabel(expertise)}` : ''}.`
}

async function MentorsList({ filters }: { filters: Filters }) {
  const mentors = await listMentors(filters)
  const summary = resultSummary(mentors.length, filters.expertise)

  if (mentors.length === 0 && filters.expertise) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState
          heading="No matches yet"
          body={`Nobody in the directory covers ${expertiseLabel(filters.expertise)} yet. Try another area, or check back soon.`}
        />
      </>
    )
  }

  if (mentors.length === 0) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState
          heading="OUR MENTOR NETWORK IS FORMING."
          body="We're bringing together founders, operators and investors who want to help. If that's you, we'd like to hear from you."
        />
      </>
    )
  }

  return (
    <>
      <LiveRegion message={summary} />
      <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mentors.map((mentor) => (
          <LinkCard key={mentor.id} href={`/mentors/${mentor.slug}`} label={`View ${mentor.name}`}>
            <Avatar name={mentor.name} src={typeof mentor.photo === 'object' ? mentor.photo?.url : null} size="lg" />
            <Heading as="h3" size="heading" className="mt-4">
              {mentor.name}
            </Heading>
            <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              {[mentor.title, mentor.organization].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-4">
              <AvailabilityBadge availability={mentor.availability ?? 'limited'} />
            </div>
          </LinkCard>
        ))}
      </div>
    </>
  )
}

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const filters: Filters = { expertise: params.expertise }

  return (
    <Section>
      <Heading as="h1" size="display">
        Find who can help.
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        You already know what you&rsquo;re stuck on. Start there, not with a directory of photos.
      </p>

      <div className="mt-10 max-w-[420px]">
        <Suspense>
          <NeedSelect />
        </Suspense>
      </div>

      <div className="mt-10">
        <MentorsList filters={filters} />
      </div>

      <div
        id="become-a-mentor"
        className="mt-16 scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8"
      >
        <Heading as="h2" size="heading">
          Are you a mentor?
        </Heading>
        <p className="mt-3 max-w-[52ch] text-[var(--color-ink-soft)]">
          Mentor profiles are added by KNEST, not self-serve — every mentor here is someone the
          team has vouched for. If you&rsquo;d like to be one,{' '}
          <Link href="/about#contact" className="underline underline-offset-2">
            get in touch
          </Link>
          .
        </p>
      </div>
    </Section>
  )
}
