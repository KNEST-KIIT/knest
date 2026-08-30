import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Avatar, Heading, Tag, Container } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import { formatEventTime } from '@/lib/dates'
import { getEventBySlug } from '@/server/content/events'
import { getRegistrationCount, getRegistrationStatus } from '@/server/events/actions'
import { getSessionUser } from '@/server/auth/guards'
import { RegisterButton } from './register-button'

const TYPE_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  talk: 'Talk',
  ideation: 'Ideation session',
  demo_day: 'Demo day',
  networking: 'Networking',
  hackathon: 'Hackathon',
  office_hours: 'Office hours',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return {}
  return { title: event.seo?.title || event.title, description: event.seo?.description || event.summary }
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const [user, registeredCount] = await Promise.all([getSessionUser(), getRegistrationCount(event.id)])
  const initiallyRegistered = user ? await getRegistrationStatus(user.id, event.id) : false
  const full = Boolean(event.capacity && registeredCount >= event.capacity && !initiallyRegistered)

  const mentorSpeakers = (event.mentorSpeakers ?? []).filter((m) => typeof m === 'object')
  const otherSpeakers = event.speakers ?? []

  return (
    <Container className="py-16">
      <div className="max-w-[68ch]">
        <Tag tone="archive">{TYPE_LABELS[event.eventType ?? 'workshop']}</Tag>
        <Heading as="h1" size="display" className="mt-4">
          {event.title}
        </Heading>
        <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{event.summary}</p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          <span>{formatEventTime(event.startsAt)}</span>
          {event.location && <span>{event.location}</span>}
          {event.capacity && <span>{registeredCount} of {event.capacity} spots taken</span>}
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-12">
          {event.description && (
            <section>
              <Heading as="h2" size="heading">
                About this event
              </Heading>
              <RichText data={event.description} className="mt-4" />
            </section>
          )}

          {(mentorSpeakers.length > 0 || otherSpeakers.length > 0) && (
            <section>
              <Heading as="h2" size="heading">
                Who&rsquo;s speaking
              </Heading>
              <div className="mt-4 flex flex-col gap-4">
                {mentorSpeakers.map((mentor) => (
                  <div key={mentor.id} className="flex items-center gap-3">
                    <Avatar name={mentor.name} src={typeof mentor.photo === 'object' ? mentor.photo?.url : null} />
                    <div>
                      <p className="font-medium">{mentor.name}</p>
                      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                        {[mentor.title, mentor.organization].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
                {otherSpeakers.map((speaker, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Avatar name={speaker.name} src={typeof speaker.photo === 'object' ? speaker.photo?.url : null} />
                    <div>
                      <p className="font-medium">{speaker.name}</p>
                      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                        {[speaker.title, speaker.organization].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside>
          <div className="sticky top-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-raised)]">
            {event.registrationUrl ? (
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-14 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-6 font-medium text-white hover:bg-[var(--color-signal-deep)]"
              >
                Register
              </a>
            ) : (
              <RegisterButton eventId={event.id} slug={slug} initiallyRegistered={initiallyRegistered} full={full} />
            )}
          </div>
        </aside>
      </div>
    </Container>
  )
}
