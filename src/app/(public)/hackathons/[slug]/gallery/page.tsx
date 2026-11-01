import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ButtonLink, Heading, Section } from '@/components/ui'
import {
  getHackathonBySlug,
  listGallerySubmissions,
} from '@/server/hackathons/actions'
import { HackathonVoteButton } from './vote-button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const hackathon = await getHackathonBySlug(slug)
  if (!hackathon) return { title: 'Gallery Not Found' }

  return {
    title: `Project Showcase Gallery · ${hackathon.title}`,
    description: `Browse projects, demos, and code repositories built during ${hackathon.title}.`,
  }
}

export default async function HackathonGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const hackathon = await getHackathonBySlug(slug)
  if (!hackathon) notFound()

  const submissions = await listGallerySubmissions(hackathon.id)

  return (
    <Section>
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)] mb-4">
        <ButtonLink href={`/hackathons/${hackathon.slug}`} variant="secondary" size="sm">
          ← Back to Hackathon
        </ButtonLink>
        <span>/</span>
        <span className="font-semibold text-[var(--color-ink)]">Project Showcase</span>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="rounded-full bg-[var(--color-signal-wash)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-signal)]">
            Public Showcase
          </span>
          <Heading as="h1" size="display" className="mt-2">
            {hackathon.title} Gallery
          </Heading>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)] max-w-xl">
            Explore live prototypes, code repositories, and pitches created during this sprint.
            {hackathon.communityVotingEnabled && ' Vote for your favorite project below.'}
          </p>
        </div>

        <span className="text-xs font-medium text-[var(--color-ink-muted)]">
          {submissions.length} project{submissions.length === 1 ? '' : 's'} submitted
        </span>
      </div>

      {submissions.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-[var(--color-line)] bg-white p-12 text-center">
          <p className="text-xs text-[var(--color-ink-muted)]">
            Submissions are still in progress. Once hackers lock their projects and the gallery opens,
            they will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {submissions.map((sub) => {
            const hasVoted = false // Will be hydrated or checked via vote button

            return (
              <div
                key={sub.id}
                className="group flex flex-col justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-xs transition-all hover:border-[var(--color-signal)]/60 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                      {sub.projectTitle}
                    </h3>

                    <HackathonVoteButton
                      hackathonId={hackathon.id}
                      submissionId={sub.id}
                      initialCount={sub.communityVotes.length}
                      initialVoted={hasVoted}
                      enabled={hackathon.communityVotingEnabled}
                    />
                  </div>

                  <p className="mt-1 text-xs font-medium text-[var(--color-ink-soft)] line-clamp-2">
                    {sub.tagline}
                  </p>

                  {sub.description && (
                    <p className="mt-3 text-xs text-[var(--color-ink-muted)] line-clamp-3 leading-relaxed">
                      {sub.description}
                    </p>
                  )}

                  {/* Tech stack */}
                  {sub.techStack && sub.techStack.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {sub.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded bg-[var(--color-paper-soft)] px-2 py-0.5 text-[length:var(--text-micro)] font-mono text-[var(--color-ink-muted)]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Team Members */}
                  <div className="mt-4 border-t border-[var(--color-line)]/60 pt-3">
                    <span className="text-[length:var(--text-micro)] font-semibold text-[var(--color-ink)]">
                      {sub.team.name}
                    </span>
                    <p className="mt-0.5 text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                      Built by{' '}
                      {sub.team.members.map((m) => m.user.name || 'Member').join(', ')}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-[var(--color-line)]/60 pt-4 flex flex-wrap items-center gap-3 text-xs">
                  {sub.repoUrl && (
                    <a
                      href={sub.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--color-signal)] hover:underline"
                    >
                      GitHub Repo ↗
                    </a>
                  )}
                  {sub.demoUrl && (
                    <a
                      href={sub.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--color-signal)] hover:underline"
                    >
                      Live Demo ↗
                    </a>
                  )}
                  {sub.videoUrl && (
                    <a
                      href={sub.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--color-signal)] hover:underline"
                    >
                      Watch Demo ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
