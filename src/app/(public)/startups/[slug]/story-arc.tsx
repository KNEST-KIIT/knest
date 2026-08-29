import { Heading } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import type { Startup } from '@/payload/payload-types'

const STAGE_LABELS: Record<string, string> = {
  problem: 'The problem',
  idea: 'The idea',
  experiment: 'The experiment',
  product: 'The product',
  progress: 'Where it stands now',
}

/**
 * Renders only the story stages a startup has actually populated, in stage
 * order — never all five as empty placeholders. A startup still at
 * "product" has no honest "progress" entry yet (spec §46).
 */
export function StoryArc({ story }: { story: Startup['story'] }) {
  const stages = story ?? []
  if (stages.length === 0) return null

  return (
    <div className="flex flex-col gap-10">
      {stages.map((entry, i) => (
        <section key={entry.id ?? i}>
          <p className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
            {STAGE_LABELS[entry.stage] ?? entry.stage}
          </p>
          <Heading as="h2" size="heading" className="mt-2">
            {entry.heading}
          </Heading>
          <RichText data={entry.body} className="mt-4" />
        </section>
      ))}
    </div>
  )
}
