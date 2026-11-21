import { Heading, Section } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

/**
 * The three prose sections from CONTENT_SPEC section 1 (the problem, the person,
 * what KNEST is), rendered from the homepage global.
 *
 * Designed with an institutional-modern editorial rhythm: clear visual hierarchy,
 * emotional pacing for the thesis, and structured card treatments that elevate the
 * narrative beyond flat plain text while preserving exact copy fidelity.
 */

function ArrowRightIcon({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function SparkleIcon({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

export function ProblemSection({ homepage }: { homepage: Homepage }) {
  const problemParagraphs = (homepage.problemBody ?? '').split(/\n{2,}/).filter(Boolean)
  const firstPara = problemParagraphs[0]
  const pivotPara = problemParagraphs[1]
  const conclusionPara = problemParagraphs.slice(2).join('\n\n')

  return (
    <Section className="border-b border-[var(--color-line)] py-10 md:py-14 bg-white">
      <div className="max-w-4xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)]">
            01 &mdash; The Friction
          </span>
        </div>

        <Heading as="h2" size="display" uppercase className="whitespace-pre-line text-3xl sm:text-4xl lg:text-5xl text-[var(--color-ink)] font-bold tracking-tight leading-[1.1]">
          {homepage.problemHeading}
        </Heading>

        <div className="mt-8 space-y-6">
          {firstPara && (
            <p className="text-lg sm:text-xl font-normal leading-relaxed text-[var(--color-ink)]">
              {firstPara}
            </p>
          )}

          {pivotPara && (
            <div className="inline-block border-y border-[var(--color-signal)]/30 py-2.5 my-2">
              <p className="font-[family-name:var(--font-display)] text-xl sm:text-2xl italic font-semibold text-[var(--color-signal)] tracking-wide">
                &ldquo;{pivotPara}&rdquo;
              </p>
            </div>
          )}

          {conclusionPara ? (
            <div className="relative border-l-4 border-[var(--color-signal)] bg-[var(--color-paper-soft)]/50 p-5 sm:p-6 rounded-r-[var(--radius-sm)] shadow-xs">
              <p className="text-base sm:text-lg font-medium leading-relaxed text-[var(--color-ink)]">
                {conclusionPara}
              </p>
            </div>
          ) : (
            problemParagraphs.slice(1).map((p) => (
              <p key={p} className="text-base sm:text-lg leading-relaxed text-[var(--color-ink-soft)]">
                {p}
              </p>
            ))
          )}
        </div>
      </div>
    </Section>
  )
}

export function PersonSection({ homepage }: { homepage: Homepage }) {
  const personLines = (homepage.personLines ?? []).map((l) => l.line).filter(Boolean)
  if (personLines.length === 0 && !homepage.personHeading) return null

  // Categorize lines: "Maybe..." introspective observations vs concluding punchlines
  const maybeLines = personLines.filter((l) => l.toLowerCase().startsWith('maybe'))
  const otherLines = personLines.filter((l) => !l.toLowerCase().startsWith('maybe'))

  return (
    <Section className="bg-[var(--color-paper-soft)] border-b border-[var(--color-line)] py-10 md:py-14">
      <div className="max-w-4xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)]">
            02 &mdash; The Mindset
          </span>
        </div>

        <Heading as="h2" size="display" uppercase className="whitespace-pre-line text-3xl sm:text-4xl lg:text-5xl text-[var(--color-ink)] font-bold tracking-tight leading-[1.1]">
          {homepage.personHeading}
        </Heading>

        {personLines.length > 0 && (
          <div className="mt-8 space-y-5">
            {maybeLines.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {maybeLines.map((line, idx) => (
                  <div
                    key={line}
                    className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-4 shadow-2xs transition-colors hover:border-[var(--color-signal)]"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)] text-xs font-mono font-bold text-[var(--color-signal)]">
                      0{idx + 1}
                    </span>
                    <p className="text-sm sm:text-base font-medium text-[var(--color-ink)] leading-snug pt-0.5">
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {otherLines.length > 0 && (
              <div className="mt-4 border border-[var(--color-signal)] bg-white p-5 sm:p-6 rounded-[var(--radius-sm)] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  {otherLines.map((line) => (
                    <p key={line} className="font-[family-name:var(--font-display)] text-lg sm:text-xl font-bold text-[var(--color-ink)]">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-signal)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                  <span>Zero Barriers</span>
                  <ArrowRightIcon className="size-3.5" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

export function KnestSection({ homepage }: { homepage: Homepage }) {
  if (!homepage.knestHeading && !homepage.knestBody) return null

  const PILLARS = [
    { title: 'Cohort Programs', desc: 'Pre-incubation to launch.' },
    { title: 'Domain Mentors', desc: 'Active founder clinics.' },
    { title: 'Maker Workspace', desc: 'Rapid prototyping labs.' },
    { title: 'Industry Access', desc: 'Direct corporate conduits.' },
  ]

  return (
    <Section className="border-b border-[var(--color-line)] py-10 md:py-14 bg-white">
      <div className="max-w-4xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)]">
            03 &mdash; The Nexus
          </span>
        </div>

        <Heading as="h2" size="display" uppercase className="whitespace-pre-line text-3xl sm:text-4xl lg:text-5xl text-[var(--color-ink)] font-bold tracking-tight leading-[1.1]">
          {homepage.knestHeading}
        </Heading>

        {homepage.knestBody && (
          <div className="mt-8 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-paper-soft)]/40 p-6 sm:p-8 shadow-xs">
            <p className="text-base sm:text-lg font-normal leading-relaxed text-[var(--color-ink)]">
              {homepage.knestBody}
            </p>

            <div className="mt-6 pt-6 border-t border-[var(--color-line)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-3">
                Core Ecosystem Infrastructure
              </p>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {PILLARS.map((item) => (
                  <div key={item.title} className="rounded-[var(--radius-sm)] bg-white p-3 border border-[var(--color-line)]">
                    <p className="text-xs font-bold text-[var(--color-ink)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[var(--color-signal)]">
              <SparkleIcon className="size-4" />
              <span>Open to every student &mdash; at every stage &mdash; across all KIIT departments.</span>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

export function Narrative({ homepage }: { homepage: Homepage }) {
  return (
    <>
      <ProblemSection homepage={homepage} />
      <PersonSection homepage={homepage} />
      <KnestSection homepage={homepage} />
    </>
  )
}
