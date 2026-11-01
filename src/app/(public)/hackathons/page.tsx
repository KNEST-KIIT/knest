import type { Metadata } from 'next'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { listPublicHackathons } from '@/server/hackathons/actions'
import { HackathonCountdown } from './countdown'

export const metadata: Metadata = {
  title: 'Hackathons · KNEST Innovation Ecosystem',
  description:
    'End-to-end hackathon arena for KIIT student builders, founders, and engineers. Form teams, reserve campus maker labs, and compete for incubation grants.',
}

export default async function HackathonsPage() {
  const hackathons = await listPublicHackathons()

  return (
    <Section>
      {/* Editorial Hero */}
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="rounded-full bg-[var(--color-signal-wash)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-signal)]">
            Campus 15B Builder Arena
          </span>
          <span className="text-xs text-[var(--color-ink-muted)]">· Innovation Competitions</span>
        </div>

        <Heading as="h1" size="display">
          Hackathons &amp; Innovation Sprints
        </Heading>

        <p className="max-w-2xl text-[var(--text-body)] text-[var(--color-ink-soft)] leading-relaxed">
          High-density prototype tournaments connecting KIIT student engineers with seed capital,
          campus fabrication labs, and national founder networks. Build from problem statement to
          production in 48 hours.
        </p>
      </div>

      {/* Differentiator Highlights Banner */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xs">
          <span className="font-mono text-xs font-bold text-[var(--color-signal)]">01 / HARDWARE</span>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
            Campus Maker Labs Fast-Track
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-relaxed">
            Reserve electronics benches, 3D printers, and IoT test kits on Campus 15B directly with your hackathon badge.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xs">
          <span className="font-mono text-xs font-bold text-[var(--color-archive)]">02 / SQUAD ASSEMBLY</span>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
            Frictionless Team Assembly
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-relaxed">
            Instant 6-character team codes and cross-discipline squad assembly across KIIT schools.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xs">
          <span className="font-mono text-xs font-bold text-[var(--color-positive)]">03 / REAL EVALUATION</span>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
            Transparent Rubric Judging
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-relaxed">
            Scored on technicality, usability, and execution by incubation committee chairs and EIR mentors.
          </p>
        </div>
      </div>

      {/* Active & Upcoming Hackathons */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Active Tournaments &amp; Sprints
            </Heading>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              Register individually or assemble your squad.
            </p>
          </div>
        </div>

        {hackathons.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-soft)]/40 p-10 text-center">
            <span className="text-2xl">⚡</span>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              Next Cohort Hackathon Opening Soon
            </h3>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)] max-w-md mx-auto">
              The next KNEST semester sprint is being prepared by the incubation council. Keep your
              student profile updated to be eligible for instant team formation.
            </p>
            <div className="mt-4">
              <ButtonLink href="/dashboard" size="sm" variant="secondary">
                View Your Dashboard →
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {hackathons.map((h) => {
              const deadline =
                h.status === 'open' ? h.registrationsCloseAt : h.submissionsCloseAt
              const deadlineLabel =
                h.status === 'open' ? 'Registrations Close' : 'Submissions Close'

              return (
                <div
                  key={h.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-signal)]/60 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-positive-wash)] px-2.5 py-0.5 text-[length:var(--text-micro)] font-bold text-[var(--color-positive)]">
                        <span className="size-1.5 rounded-full bg-[var(--color-positive)] animate-pulse" />
                        {h.status.toUpperCase()}
                      </span>
                      {h.prizePoolSummary && (
                        <span className="font-mono text-xs font-bold text-[var(--color-signal)]">
                          🏆 {h.prizePoolSummary}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                      {h.title}
                    </h3>

                    {h.tagline && (
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)] line-clamp-2">
                        {h.tagline}
                      </p>
                    )}

                    {/* Tracks Badges */}
                    {h.tracks && h.tracks.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {h.tracks.slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-soft)]/60 px-2 py-0.5 text-[length:var(--text-micro)] font-medium text-[var(--color-ink-muted)]"
                          >
                            {t.name}
                          </span>
                        ))}
                        {h.tracks.length > 3 && (
                          <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)] self-center">
                            +{h.tracks.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 border-t border-[var(--color-line)]/60 pt-4 flex flex-col gap-4">
                    {deadline && (
                      <HackathonCountdown targetDate={deadline} label={deadlineLabel} />
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-ink-muted)]">
                        Teams: {h.minTeamSize === h.maxTeamSize ? `${h.minTeamSize} members` : `${h.minTeamSize}–${h.maxTeamSize} hackers`}
                      </span>
                      <ButtonLink href={`/hackathons/${h.slug}`} size="sm">
                        Enter Arena →
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Section>
  )
}
