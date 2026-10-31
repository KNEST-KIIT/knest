import { Avatar, ButtonLink, EmptyState, Heading, LinkCard, Tag } from '@/components/ui'
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
    <div className="flex flex-col gap-8">
      {/* Mentor Quick Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--color-line)] bg-white p-4 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-signal)]/10 text-[var(--color-signal)] font-bold text-lg">
            🎓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--color-ink)]">Mentor Network Hub</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-blue-700 border border-blue-200">
                Advisory Board
              </span>
            </div>
            <p className="text-xs text-[var(--color-ink-muted)]">
              KNEST Ecosystem · Supporting Student Founders & KIIT Ventures
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/contact?topic=mentor" variant="secondary" size="sm" className="text-xs">
            💬 Mentor Support
          </ButtonLink>
          <ButtonLink href="/events" variant="secondary" size="sm" className="text-xs">
            📅 Community Events
          </ButtonLink>
          <ButtonLink href="/dashboard/account" variant="secondary" size="sm" className="text-xs">
            ⚙️ Edit Profile
          </ButtonLink>
        </div>
      </div>

      {/* Mentor Profile Overview */}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Heading as="h2" size="heading" uppercase={false}>
            Advisory Profile
          </Heading>
          {mentor && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
              Verified Mentor
            </span>
          )}
        </div>

        {!mentor ? (
          <EmptyState
            headingLevel="h3"
            className="border-none shadow-none"
            heading="Public Mentor Profile Pending Review"
            body="Our incubation team reviews and publishes mentor profiles before they appear on the public directory. Contact us to update your advisory areas or bio."
            action={
              <ButtonLink href="/contact?topic=mentor" variant="secondary">
                Contact Advisory Team
              </ButtonLink>
            }
          />
        ) : (
          <div className="flex flex-col items-start gap-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-5 sm:flex-row sm:items-center">
            <Avatar
              name={mentor.name}
              src={typeof mentor.photo === 'object' ? mentor.photo?.url : null}
              size="lg"
            />
            <div className="w-full min-w-0 flex-1 [overflow-wrap:anywhere]">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-[var(--color-ink)]">{mentor.name}</p>
                <span className="text-xs text-[var(--color-ink-muted)]">·</span>
                <span className="text-xs font-medium text-[var(--color-signal)]">Advisory Fellow</span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                {[mentor.title, mentor.organization].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {mentor.expertise.map((area) => (
                  <Tag key={area} tone="archive" className="max-w-full text-xs">
                    {expertiseLabel(area)}
                  </Tag>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--color-line)]/50">
                <ButtonLink href={`/mentors/${mentor.slug}`} variant="secondary" size="sm" className="text-xs">
                  View Public Profile Page →
                </ButtonLink>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Cohorts & Programs Supported */}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Programs You Support
            </Heading>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Active incubation batches and grant tracks under your advisory
            </p>
          </div>
          <ButtonLink href="/programs" variant="secondary" size="sm" className="text-xs">
            All Programs
          </ButtonLink>
        </div>

        {programs.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="border-none shadow-none"
            heading="No Program Assignments Yet"
            body="When you are paired with an active student batch or grant program, it will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <LinkCard
                key={program.id}
                href={`/programs/${program.slug}`}
                label={`View ${program.title}`}
                className="group hover:border-[var(--color-signal)]/50 transition-all"
              >
                <p className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                  {program.title}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-soft)] line-clamp-2">
                  {program.tagline}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Campus Events & Demo Days
            </Heading>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Upcoming pitch sessions, workshops, and guest lectures
            </p>
          </div>
          <ButtonLink href="/events" variant="secondary" size="sm" className="text-xs">
            Full Calendar
          </ButtonLink>
        </div>

        {events.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="border-none shadow-none"
            heading="No Upcoming Events Scheduled"
            body="Upcoming sessions, pitch reviews, and hackathons will be listed here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((event) => (
              <LinkCard
                key={event.id}
                href={`/events/${event.slug}`}
                label={`View ${event.title}`}
                className="group hover:border-[var(--color-signal)]/50 transition-all"
              >
                <p className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                  {event.title}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  📅 {formatEventTime(event.startsAt)}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
