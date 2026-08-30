import Link from 'next/link'
import { Heading } from '@/components/ui'
import { STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { listPrograms } from '@/server/content/programs'

/**
 * THE KNEST JOURNEY — signature experience 03 (CONTENT_SPEC.md §1.6).
 * "Six-stage progression" in the spec's prose, built here against the real
 * seven-value stage taxonomy every filter on the site already uses
 * (STAGE_OPTIONS) rather than a second, narrower vocabulary invented just
 * for this section — a stage with no programs yet says so honestly instead
 * of being silently dropped.
 */
export async function TheJourney() {
  const allPrograms = await listPrograms({})
  const stagePrograms = STAGE_OPTIONS.map((stage) => ({
    stage,
    programs: allPrograms.filter((program) => program.stage?.includes(stage.value)),
  }))

  return (
    <div>
      <Heading as="h2" size="display">
        From question to venture.
      </Heading>
      <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
        Nobody goes from idea to company in one leap. Here&rsquo;s the path, and where KNEST meets
        you on it.
      </p>

      <div className="mt-10 -mx-6 flex gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-7">
        {stagePrograms.map(({ stage, programs }) => (
          <Link
            key={stage.value}
            href={`/programs?stage=${stage.value}`}
            className="group flex w-[220px] shrink-0 flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-5 transition-colors hover:border-[var(--color-ink)] md:w-auto"
          >
            <p className="font-[family-name:var(--font-display)] text-[length:var(--text-small)] uppercase tracking-[0.1em] text-[var(--color-signal)]">
              {stage.label}
            </p>
            {programs.length === 0 ? (
              <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                Programs for this stage are being built.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {programs.slice(0, 3).map((program) => (
                  <li key={program.id} className="text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {program.title}
                  </li>
                ))}
              </ul>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
