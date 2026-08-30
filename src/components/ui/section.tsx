import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'
import { Container } from './container'
import { Heading } from './heading'

/**
 * Page-section rhythm: 128px desktop, 72px mobile, set in one place.
 *
 * `reveal` is opt-in rather than the default. A scroll reveal is worth
 * having where a page is a sequence of beats a reader moves through — the
 * homepage narrative, the long-form pages — and is wrong in the two places
 * Section is otherwise used: a loading skeleton would fade itself in only to
 * be replaced a moment later, and a dashboard is a place someone is trying
 * to read quickly, not a story.
 */
export function Section({
  className,
  children,
  inverted,
  id,
  reveal = false,
  measure = 'full',
  centered = false,
}: {
  className?: string
  children: React.ReactNode
  inverted?: boolean
  id?: string
  reveal?: boolean
  /**
   * `prose` narrows the *content* to a reading measure while the section
   * itself stays full-bleed. Three homepage sections were doing this by
   * passing `mx-auto max-w-[68ch]` as `className`, which lands on the
   * <section> element — so the narrow one that is also `inverted` rendered
   * its dark ground as a 68ch-wide box floating in the middle of the page
   * instead of a band across it, and the other two pulled their text into
   * the centre of the window while every other section on the page stayed
   * aligned to the container's left edge. The page's left margin visibly
   * wandered as you scrolled.
   */
  measure?: 'full' | 'prose'
  /** Centres a `prose` column and its text. For a deliberate set-piece, not a default. */
  centered?: boolean
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-[72px] md:py-32',
        inverted && 'bg-[var(--color-ink)] text-[var(--color-paper)]',
        className,
      )}
    >
      <Container>
        <div
          className={cn(
            measure === 'prose' && 'max-w-[68ch]',
            centered && 'mx-auto text-center',
          )}
        >
          {reveal ? <Reveal>{children}</Reveal> : children}
        </div>
      </Container>
    </section>
  )
}

/** @deprecated Use `Heading size="display"` — kept as a thin alias so existing call sites keep working while they migrate. */
export function SectionHeading({
  children,
  as = 'h2',
  className,
}: {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <Heading as={as} size="display" className={className}>
      {children}
    </Heading>
  )
}

/** Body copy is capped at 68ch: longer measures cost the reader their place. */
export function Prose({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('max-w-[68ch] text-[length:var(--text-body)] leading-relaxed', className)}>
      {children}
    </div>
  )
}
