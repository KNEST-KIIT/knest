import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Avatar, Heading, Tag } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import { formatEventTime, hasPassed } from '@/lib/dates'
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
  // Defend against legacy inverted date ranges: if endsAt is earlier than startsAt, use startsAt
  const startTime = new Date(event.startsAt).getTime()
  const endTime = event.endsAt ? new Date(event.endsAt).getTime() : NaN
  const validRange = isNaN(endTime) || endTime > startTime
  const effectiveEnd = validRange && event.endsAt ? event.endsAt : event.startsAt
  const finished = hasPassed(effectiveEnd)
  const full = Boolean(event.capacity && registeredCount >= event.capacity && !initiallyRegistered)
  let hasValidExternalRegistration = false
  if (event.registrationUrl) {
    try {
      const parsed = new URL(event.registrationUrl.trim())
      hasValidExternalRegistration = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      hasValidExternalRegistration = false
    }
  }

  const mentorSpeakers = (event.mentorSpeakers ?? []).filter((m) => typeof m === 'object')
  const otherSpeakers = event.speakers ?? []

  return (
    <div className="mx-auto w-full max-w-160 px-6 py-16 md:px-10">
      <div className="max-w-[68ch]">
        <Tag tone="archive">{TYPE_LABELS[event.eventType ?? 'workshop']}</Tag>
        <Heading as="h1" size="display" className="mt-4">
          {event.title}
        </Heading>
        <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{event.summary}</p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          <span>{formatEventTime(event.startsAt)}</span>
          {finished && <Tag tone="archive">Finished</Tag>}
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
            {finished ? (
              <div>
                <p className="font-medium">This event has finished.</p>
                <Link href="/events" className="mt-3 inline-block text-[var(--color-signal)] underline underline-offset-4">
                  See upcoming events
                </Link>
              </div>
            ) : (
              <>
                {hasValidExternalRegistration ? (
                  <a
                    href={event.registrationUrl!.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-14 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-6 font-medium text-white hover:bg-[var(--color-signal-deep)]"
                  >
                    Register
                  </a>
                ) : (
                  <RegisterButton eventId={event.id} slug={slug} initiallyRegistered={initiallyRegistered} full={full} />
                )}
                <a
                  href={`/events/${slug}/calendar.ics`}
                  download
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center text-[length:var(--text-small)] text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]"
                >
                  Add to calendar
                </a>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
