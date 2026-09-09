import { Heading } from '@/components/ui'

/** One date, shown on both legal pages, so they can never disagree about when they were last looked at. */
export const LEGAL_LAST_REVIEWED = 'September 2026'

/**
 * The shared shell for /privacy and /terms: a heading, then body copy at a
 * readable measure with consistent spacing. Kept here rather than in
 * components/ui because it is specific to these two pages — a third legal
 * page would be the moment to promote it.
 */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first-of-type:mt-10">
      <Heading as="h2" size="heading">
        {title}
      </Heading>
      <div className="mt-4 flex flex-col gap-4 text-[var(--color-ink-soft)] [&_li]:pl-1 [&_strong]:text-[var(--color-ink)] [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-3 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

export function LegalContact({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-14 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8">
      <Heading as="h2" size="heading">
        Contact
      </Heading>
      <div className="mt-3 flex flex-col gap-4 text-[var(--color-ink-soft)]">{children}</div>
    </div>
  )
}
