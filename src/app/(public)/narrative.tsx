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
export function Narrative({ homepage }: { homepage: Homepage }) {
  const problemParagraphs = (homepage.problemBody ?? '').split(/\n{2,}/).filter(Boolean)
  const personLines = (homepage.personLines ?? []).map((l) => l.line).filter(Boolean)

  return (
    <>
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

      {personLines.length > 0 && (
        <Section className="bg-[var(--color-paper-soft)] border-b border-[var(--color-line)]">
          <div className="max-w-3xl">
              <Heading as="h2" size="display" uppercase className="whitespace-pre-line">
                {homepage.personHeading}
              </Heading>
            <div className="mt-8 space-y-2 text-lg leading-relaxed text-[var(--color-ink-soft)]">
              {personLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </Section>
      )}

      {homepage.knestBody && (
        <Section className="border-b border-[var(--color-line)]">
          <div className="max-w-3xl">
              <Heading as="h2" size="display" uppercase className="whitespace-pre-line">
                {homepage.knestHeading}
              </Heading>
            <p className="mt-8 text-lg leading-relaxed text-[var(--color-ink-soft)]">{homepage.knestBody}</p>
          </div>
        </Section>
      )}
    </>
  )
}
