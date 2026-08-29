import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmptyState, LinkCard, Tag } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import { formatDate } from '@/lib/dates'
import { getProgramBySlug, listProgramCohortsWithStartups } from '@/server/content/programs'
import { ApplyCta } from './apply-cta'
import { ProgramStatusBadge } from '../program-status-badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const program = await getProgramBySlug(slug)
  if (!program) return {}

  return {
    title: program.seo?.title || program.title,
    description: program.seo?.description || program.tagline,
  }
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const program = await getProgramBySlug(slug)
  if (!program) notFound()

  const cohortsWithStartups = await listProgramCohortsWithStartups(program.id)
  const allStartups = cohortsWithStartups.flatMap((c) => c.startups)
  const mentors = (program.mentors ?? []).filter((m) => typeof m === 'object')
  const faqs = program.faqs ?? []

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-10">
      <div className="max-w-[68ch]">
        <div className="flex items-center gap-3">
          <ProgramStatusBadge status={program.applicationStatus} />
          {program.applicationDeadline && program.applicationStatus === 'open' && (
            <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              Closes {formatDate(program.applicationDeadline)}
            </span>
          )}
        </div>

        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[length:var(--text-display)] font-extrabold uppercase leading-[0.95]">
          {program.title}
        </h1>
        <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{program.tagline}</p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {program.duration && <span>{program.duration}</span>}
          {program.cohortSize && <span>Cohort of {program.cohortSize}</span>}
          {program.nextCohortStart && <span>Starts {formatDate(program.nextCohortStart)}</span>}
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-12">
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
              Who this is for
            </h2>
            <RichText data={program.whoItsFor} className="mt-4" />
          </section>

          {program.whatYoullBuild && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                What you&rsquo;ll build
              </h2>
              <RichText data={program.whatYoullBuild} className="mt-4" />
            </section>
          )}

          {program.whatYoullGet && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                What you&rsquo;ll get
              </h2>
              <RichText data={program.whatYoullGet} className="mt-4" />
            </section>
          )}

          {program.timeline && program.timeline.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                How it runs
              </h2>
              <ol className="mt-4 flex flex-col gap-4">
                {program.timeline.map((phase, i) => (
                  <li key={i} className="border-l-2 border-[var(--color-signal)] pl-4">
                    <p className="font-medium">
                      {phase.label}
                      {phase.duration && (
                        <span className="ml-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                          {phase.duration}
                        </span>
                      )}
                    </p>
                    {phase.description && (
                      <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                        {phase.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {mentors.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                Who you&rsquo;ll meet
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {mentors.map((mentor) => (
                  <Tag key={mentor.id} tone="archive">
                    {mentor.name}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          {allStartups.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                Startups from this program
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {allStartups.map((startup) => (
                  <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
                    <p className="font-medium">{startup.name}</p>
                    <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                      {startup.tagline}
                    </p>
                  </LinkCard>
                ))}
              </div>
            </section>
          )}

          {program.requirements && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                What we ask of you
              </h2>
              <RichText data={program.requirements} className="mt-4" />
            </section>
          )}

          {faqs.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase">
                Questions
              </h2>
              <div className="mt-4 flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                {faqs.map((faq, i) => (
                  <details key={i} className="group py-4">
                    <summary className="cursor-pointer list-none font-medium marker:content-none">
                      {faq.question}
                    </summary>
                    <RichText data={faq.answer} className="mt-3 text-[length:var(--text-small)]" />
                  </details>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-extrabold uppercase">
              Ready?
            </h2>
            <div className="mt-4 max-w-[360px] lg:hidden">
              <ApplyCta program={program} />
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-raised)]">
            <ApplyCta program={program} />
          </div>
        </aside>
      </div>
    </div>
  )
}
