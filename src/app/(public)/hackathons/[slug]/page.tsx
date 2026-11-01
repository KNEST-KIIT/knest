import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { getSessionUser } from '@/server/auth/guards'
import {
  countRegistrations,
  getHackathonBySlug,
  getMyRegistration,
  getMyTeam,
  getTeamSubmission,
  listAnnouncements,
  listOpenTeams,
} from '@/server/hackathons/actions'
import { HackathonCountdown } from '../countdown'
import { HackathonTeamActions } from './team-actions'
import { HackathonSubmissionForm } from './submission-form'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const hackathon = await getHackathonBySlug(slug)
  if (!hackathon) return { title: 'Hackathon Not Found' }

  return {
    title: `${hackathon.title} · KNEST Arena`,
    description: hackathon.tagline || hackathon.description?.slice(0, 160),
  }
}

export default async function HackathonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { slug } = await params
  const { tab = 'overview' } = await searchParams
  const hackathon = await getHackathonBySlug(slug)

  if (!hackathon) notFound()

  const user = await getSessionUser()
  const [participantCount, openTeams, announcements] = await Promise.all([
    countRegistrations(hackathon.id),
    listOpenTeams(hackathon.id),
    listAnnouncements(hackathon.id),
  ])

  let registration = null
  let myTeam = null
  let teamSubmission = null

  if (user) {
    registration = await getMyRegistration(hackathon.id)
    myTeam = await getMyTeam(hackathon.id)
    if (myTeam) {
      teamSubmission = await getTeamSubmission(myTeam.id)
    }
  }

  const isSubmissionsOpen = hackathon.status === 'building'
  const isRegistrationsOpen = hackathon.status === 'open'
  const deadline =
    hackathon.status === 'open'
      ? hackathon.registrationsCloseAt
      : hackathon.submissionsCloseAt
  const deadlineLabel =
    hackathon.status === 'open' ? 'Registrations Close' : 'Submission Deadline'

  return (
    <Section>
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)] mb-4">
        <ButtonLink href="/hackathons" variant="secondary" size="sm">
          ← Back to Hackathons
        </ButtonLink>
        <span>/</span>
        <span className="font-semibold text-[var(--color-ink)]">{hackathon.title}</span>
      </div>

      {/* Hero Banner Card */}
      <div className="rounded-3xl border border-[var(--color-line)] bg-gradient-to-br from-white via-[var(--color-paper-soft)]/40 to-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-positive-wash)] px-3 py-1 text-xs font-bold text-[var(--color-positive)]">
                <span className="size-2 rounded-full bg-[var(--color-positive)] animate-pulse" />
                {hackathon.status.toUpperCase()}
              </span>

              {hackathon.prizePoolSummary && (
                <span className="rounded-full bg-[var(--color-signal-wash)] px-3 py-1 text-xs font-bold text-[var(--color-signal)]">
                  🏆 {hackathon.prizePoolSummary}
                </span>
              )}

              <span className="text-xs font-medium text-[var(--color-ink-muted)]">
                · {participantCount} hackers registered
              </span>
            </div>

            <Heading as="h1" size="display" className="mt-3">
              {hackathon.title}
            </Heading>

            {hackathon.tagline && (
              <p className="mt-2 text-[var(--text-body)] font-medium text-[var(--color-ink-soft)] leading-relaxed">
                {hackathon.tagline}
              </p>
            )}

            {/* Quick stats pills */}
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 font-medium text-[var(--color-ink)]">
                <span>👥 Team Size:</span>
                <span className="font-bold">
                  {hackathon.minTeamSize === hackathon.maxTeamSize
                    ? `${hackathon.minTeamSize} members`
                    : `${hackathon.minTeamSize}–${hackathon.maxTeamSize} hackers`}
                </span>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 font-medium text-[var(--color-ink)]">
                <span>🏢 Campus Lab Access:</span>
                <span className="font-bold text-[var(--color-signal)]">Campus 15B Maker Hub</span>
              </div>

              {hackathon.galleryPublic && (
                <ButtonLink
                  href={`/hackathons/${hackathon.slug}/gallery`}
                  variant="secondary"
                  size="sm"
                >
                  🎨 View Public Gallery
                </ButtonLink>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-4">
            {deadline && (
              <HackathonCountdown targetDate={deadline} label={deadlineLabel} />
            )}

            {/* Hardware Lab Fast-Track Button */}
            <ButtonLink
              href="/dashboard/lab-booking"
              variant="secondary"
              size="sm"
              className="text-xs"
            >
              ⚡ Fast-Track 3D Printer / Lab Booking →
            </ButtonLink>
          </div>
        </div>

        {/* User Status Bar */}
        <div className="mt-8 border-t border-[var(--color-line)]/70 pt-6">
          <HackathonTeamActions
            hackathonId={hackathon.id}
            isRegistered={Boolean(registration)}
            myTeam={myTeam}
            currentUserId={user?.id}
            availableTracks={hackathon.tracks}
            canCreateTeam={isRegistrationsOpen || isSubmissionsOpen}
          />
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="mt-8 flex border-b border-[var(--color-line)]">
        <a
          href={`/hackathons/${hackathon.slug}?tab=overview`}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'overview'
              ? 'border-[var(--color-signal)] text-[var(--color-signal)]'
              : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Overview &amp; Tracks
        </a>

        <a
          href={`/hackathons/${hackathon.slug}?tab=teams`}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'teams'
              ? 'border-[var(--color-signal)] text-[var(--color-signal)]'
              : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Squads &amp; Teams ({openTeams.length} Open)
        </a>

        <a
          href={`/hackathons/${hackathon.slug}?tab=workspace`}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'workspace'
              ? 'border-[var(--color-signal)] text-[var(--color-signal)]'
              : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Submission Workspace
        </a>

        <a
          href={`/hackathons/${hackathon.slug}?tab=announcements`}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'announcements'
              ? 'border-[var(--color-signal)] text-[var(--color-signal)]'
              : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Broadcasts ({announcements.length})
        </a>
      </div>

      {/* Tab 1: Overview */}
      {tab === 'overview' && (
        <div className="mt-8 flex flex-col gap-10">
          {hackathon.description && (
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-xs">
              <Heading as="h2" size="heading" uppercase={false}>
                About this Sprint
              </Heading>
              <div className="mt-3 text-xs text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-line">
                {hackathon.description}
              </div>
            </div>
          )}

          {/* Tracks & Bounties Grid */}
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Prize Tracks &amp; Bounties
            </Heading>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              Choose one or more tracks when building your submission.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hackathon.tracks.map((track) => (
                <div
                  key={track.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--color-signal)]">
                      TRACK
                    </span>
                    {track.prize && (
                      <span className="font-mono text-xs font-bold text-[var(--color-positive)]">
                        {track.prize}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                    {track.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-relaxed">
                    {track.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Judging Criteria Rubric */}
          {hackathon.judgingCriteria.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Heading as="h2" size="heading" uppercase={false}>
                    Evaluation Rubric &amp; Weighting
                  </Heading>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                    Transparent scoring guidelines enforced across all jury members.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--color-paper-soft)] px-3 py-1 font-mono text-xs font-bold text-[var(--color-ink-muted)]">
                  100% Total
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {hackathon.judgingCriteria.map((crit) => (
                  <div
                    key={crit.id}
                    className="flex flex-col justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)]/40 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[var(--color-ink)]">
                          {crit.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-[var(--color-signal)]">
                          {crit.weight}%
                        </span>
                      </div>
                      <p className="mt-2 text-[length:var(--text-micro)] text-[var(--color-ink-muted)] leading-relaxed">
                        {crit.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Teams & Teams */}
      {tab === 'teams' && (
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <Heading as="h2" size="heading" uppercase={false}>
                Recruiting Squads &amp; Teams
              </Heading>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Teams looking for frontend developers, AI researchers, or hardware builders.
              </p>
            </div>
          </div>

          {openTeams.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center">
              <p className="text-xs text-[var(--color-ink-muted)]">
                No squads currently recruiting. Create a squad or join using a join code above!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {openTeams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                      {team.name}
                    </h3>
                    <span className="rounded-full bg-[var(--color-positive-wash)] px-2 py-0.5 text-[length:var(--text-micro)] font-bold text-[var(--color-positive)]">
                      {team.members.length} member{team.members.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {team.recruitmentPitch && (
                    <p className="mt-2 text-xs text-[var(--color-ink-soft)] line-clamp-2">
                      &quot;{team.recruitmentPitch}&quot;
                    </p>
                  )}

                  {team.techStack && team.techStack.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {team.techStack.map((stack) => (
                        <span
                          key={stack}
                          className="rounded bg-[var(--color-paper-soft)] px-2 py-0.5 text-[length:var(--text-micro)] font-mono text-[var(--color-ink-muted)]"
                        >
                          {stack}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border-t border-[var(--color-line)]/60 pt-3 flex items-center justify-between text-xs">
                    <span className="text-[var(--color-ink-muted)]">
                      Lead: <strong>{team.leader?.name || 'Hacker'}</strong>
                    </span>
                    <span className="font-mono text-[length:var(--text-micro)] text-[var(--color-signal)]">
                      Code: {team.joinCode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Submission Workspace */}
      {tab === 'workspace' && (
        <div className="mt-8 flex flex-col gap-6">
          {!user ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                Sign In to Access Your Team Workspace
              </h3>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                You must be logged in and part of a registered team to edit or submit a project.
              </p>
              <div className="mt-4">
                <ButtonLink href={`/login?next=/hackathons/${hackathon.slug}?tab=workspace`} size="sm">
                  Sign In →
                </ButtonLink>
              </div>
            </div>
          ) : !myTeam ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                No Team Found
              </h3>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Create or join a team first to unlock the project submission workspace.
              </p>
            </div>
          ) : (
            <HackathonSubmissionForm
              hackathonId={hackathon.id}
              teamId={myTeam.id}
              initialSubmission={teamSubmission ?? null}
              availableTracks={hackathon.tracks}
              isSubmissionsOpen={isSubmissionsOpen}
            />
          )}
        </div>
      )}

      {/* Tab 4: Live Announcements Feed */}
      {tab === 'announcements' && (
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <Heading as="h2" size="heading" uppercase={false}>
                Official Broadcast Feed
              </Heading>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Instant alerts pushed to Discord, Telegram, and your in-app notification center.
              </p>
            </div>
          </div>

          {announcements.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center">
              <p className="text-xs text-[var(--color-ink-muted)]">
                No broadcasts published yet. Organizers will post key updates, checkpoints, and deadlines here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[length:var(--text-micro)] font-bold uppercase tracking-wider ${
                          ann.type === 'deadline'
                            ? 'bg-[var(--color-critical)]/10 text-[var(--color-critical)]'
                            : ann.type === 'warning'
                              ? 'bg-[var(--color-caution)]/10 text-[var(--color-caution)]'
                              : ann.type === 'winner'
                                ? 'bg-[var(--color-archive)]/10 text-[var(--color-archive)]'
                                : 'bg-[var(--color-paper-soft)] text-[var(--color-ink)]'
                        }`}
                      >
                        {ann.type}
                      </span>
                      <h3 className="font-semibold text-sm text-[var(--color-ink)]">
                        {ann.title}
                      </h3>
                    </div>

                    <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-line">
                    {ann.body}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)]/50 pt-2 text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                    <span>Broadcast by {ann.author?.name || 'Organizing Committee'}</span>
                    {ann.webhookDispatched && (
                      <span className="text-[var(--color-positive)] font-medium">
                        ✓ Dispatched to Discord &amp; Telegram
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
