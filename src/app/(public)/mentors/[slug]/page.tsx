import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Avatar, Heading, Tag } from '@/components/ui'
import { EXPERTISE_OPTIONS } from '@/payload/fields/taxonomy'
import { getMentorBySlug } from '@/server/content/mentors'
import { AvailabilityBadge } from '../availability-badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const mentor = await getMentorBySlug(slug)
  if (!mentor) return {}

  return {
    title: mentor.name,
    description: mentor.bio ?? `${mentor.name}, mentor at KNEST.`,
  }
}

function expertiseLabel(value: string): string {
  return EXPERTISE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export default async function MentorDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const mentor = await getMentorBySlug(slug)
  if (!mentor) notFound()

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
      <div className="flex items-start gap-6">
        <Avatar name={mentor.name} src={typeof mentor.photo === 'object' ? mentor.photo?.url : null} size="lg" />
        <div>
          <Heading as="h1" size="title">
            {mentor.name}
          </Heading>
          <p className="mt-1 text-[var(--color-ink-soft)]">
            {[mentor.title, mentor.organization].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-3">
            <AvailabilityBadge availability={mentor.availability ?? 'limited'} />
          </div>
        </div>
      </div>

      {mentor.bio && <p className="mt-8 max-w-[60ch] text-[var(--color-ink-soft)]">{mentor.bio}</p>}

      <div className="mt-8 flex flex-wrap gap-2">
        {mentor.expertise.map((area) => (
          <Tag key={area} tone="archive">
            {expertiseLabel(area)}
          </Tag>
        ))}
      </div>

      {mentor.linkedinUrl && (
        <a
          href={mentor.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-6 font-medium text-white hover:bg-[var(--color-signal-deep)]"
        >
          Connect on LinkedIn
        </a>
      )}
    </div>
  )
}
