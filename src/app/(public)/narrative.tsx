import { Heading, Section } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

/**
 * The three prose sections from CONTENT_SPEC section 1 (the problem, the person,
 * what KNEST is), rendered from the homepage global.
 *
 * This replaces the "Conversion Sequence / Friction / Mindset / Engine" block,
 * which carried unapproved institutional claims (capital and grants, hardware
 * labs, a floor-area figure, a pledge section). It states no fact about
 * KNEST beyond what the global holds. The homepage restructure (information
 * architecture) is a later, separately approved phase.
 */
export function ProblemSection({ homepage }: { homepage: Homepage }) {
  const problemParagraphs = (homepage.problemBody ?? '').split(/\n{2,}/).filter(Boolean)
  return (
    <Section className="border-b border-[var(--color-line)]">
      <div className="max-w-3xl">
        <Heading as="h2" size="display" uppercase className="whitespace-pre-line">
          {homepage.problemHeading}
        </Heading>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-[var(--color-ink-soft)]">
          {problemParagraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </Section>
  )
}

export function PersonSection({ homepage }: { homepage: Homepage }) {
  const personLines = (homepage.personLines ?? []).map((l) => l.line).filter(Boolean)
  if (personLines.length === 0 && !homepage.personHeading) return null
  return (
    <Section className="bg-[var(--color-paper-soft)] border-b border-[var(--color-line)]">
      <div className="max-w-3xl">
        <Heading as="h2" size="display" uppercase className="whitespace-pre-line">
          {homepage.personHeading}
        </Heading>
        {personLines.length > 0 && (
          <div className="mt-8 space-y-2 text-lg leading-relaxed text-[var(--color-ink-soft)]">
            {personLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

export function KnestSection({ homepage }: { homepage: Homepage }) {
  if (!homepage.knestHeading && !homepage.knestBody) return null
  return (
    <Section className="border-b border-[var(--color-line)]">
      <div className="max-w-3xl">
        <Heading as="h2" size="display" uppercase className="whitespace-pre-line">
          {homepage.knestHeading}
        </Heading>
        {homepage.knestBody && (
          <p className="mt-8 text-lg leading-relaxed text-[var(--color-ink-soft)]">{homepage.knestBody}</p>
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
