import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { requireOnboardedUser } from '@/server/auth/guards'
import { getHackathonBySlug, getMyJudgeQueue } from '@/server/hackathons/actions'
import { JudgeScorecard } from './judge-scorecard'

export const metadata: Metadata = {
  title: 'Judge Evaluation Console · KNEST',
}

export default async function JudgeConsolePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await requireOnboardedUser(`/dashboard/judging/${slug}`)

  const hackathon = await getHackathonBySlug(slug)
  if (!hackathon) notFound()

  const assignments = await getMyJudgeQueue(hackathon.id)

  return (
    <Section>
      <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)] mb-4">
        <ButtonLink href={`/hackathons/${hackathon.slug}`} variant="secondary" size="sm">
          ← Back to Hackathon
        </ButtonLink>
        <span>/</span>
        <span className="font-semibold text-[var(--color-ink)]">Judge Console</span>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--color-signal-wash)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-signal)]">
            Jury Evaluation Portal
          </span>
          <span className="text-xs text-[var(--color-ink-muted)]">· Phase: {hackathon.status}</span>
        </div>

        <Heading as="h1" size="display">
          {hackathon.title} — Judging Queue
        </Heading>

        <p className="max-w-xl text-xs text-[var(--color-ink-soft)] leading-relaxed">
          Score each project across the weighted rubric criteria. Your evaluations are averaged
          with other committee judges to compute the final placement leaderboard.
        </p>
      </div>

      <JudgeScorecard
        hackathonId={hackathon.id}
        criteria={hackathon.judgingCriteria}
        assignments={assignments}
      />
    </Section>
  )
}
