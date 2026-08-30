import { Avatar, EmptyState, Heading, LinkCard, Tag } from '@/components/ui'
import { formatEventTime } from '@/lib/dates'
import { EXPERTISE_OPTIONS } from '@/payload/fields/taxonomy'
import { getMentorByUserId } from '@/server/content/mentors'
import { listProgramsByMentor } from '@/server/content/programs'
import { listUpcomingEvents } from '@/server/content/events'
import type { SessionUser } from '@/server/auth/guards'

function expertiseLabel(value: string): string {
  return EXPERTISE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export async function MentorDashboard({ user }: { user: SessionUser }) {
  const mentor = await getMentorByUserId(user.id)
  const [programs, events] = await Promise.all([
    mentor ? listProgramsByMentor(mentor.id) : Promise.resolve([]),
    listUpcomingEvents(),
  ])

  return (
    <>
      <section>
        <Heading as="h2" size="title">
          Your profile
        </Heading>
        {!mentor ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="Your mentor profile is with our team."
            body="Mentor profiles are reviewed before they go live. We'll let you know once yours is published."
          />
        ) : (
          <div className="mt-6 flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
            <Avatar name={mentor.name} src={typeof mentor.photo === 'object' ? mentor.photo?.url : null} size="lg" />
            <div>
              <p className="font-medium">{mentor.name}</p>
              <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                {[mentor.title, mentor.organization].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {mentor.expertise.map((area) => (
                  <Tag key={area} tone="archive">
                    {expertiseLabel(area)}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-12">
        <Heading as="h2" size="title">
          Programs you support
        </Heading>
        {programs.length === 0 ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="Not attached to a program yet."
            body="When KNEST connects you to a program, it'll appear here."
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <LinkCard key={program.id} href={`/programs/${program.slug}`} label={`View ${program.title}`}>
                <p className="font-medium">{program.title}</p>
                <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{program.tagline}</p>
              </LinkCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <Heading as="h2" size="title">
          Upcoming
        </Heading>
        {events.length === 0 ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="Nothing on your calendar yet."
            body="Here's what's coming up at KNEST once new sessions are scheduled."
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((event) => (
              <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {formatEventTime(event.startsAt)}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
