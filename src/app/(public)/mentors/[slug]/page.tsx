import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Avatar, ButtonLink, Heading, Tag } from '@/components/ui'
import { expertiseLabel } from '@/lib/labels'
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
        <div className="mt-8">
          <ButtonLink href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" size="lg">
            Connect on LinkedIn ↗
          </ButtonLink>
        </div>
      )}

      <div className="mt-12 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6">
        <Heading as="h2" size="heading">
          Before you write
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          Lead with the specific thing you are stuck on and what you have already tried. A mentor can
          answer that in one reply. &ldquo;Can I pick your brain?&rdquo; usually goes unanswered — not
          out of rudeness, but because there is nothing in it to answer.
        </p>
      </div>

      <p className="mt-10 text-[length:var(--text-small)]">
        <Link href="/mentors" className="underline underline-offset-2">
          ← All mentors
        </Link>
      </p>
    </div>
  )
}
