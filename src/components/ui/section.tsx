import { cn } from '@/lib/cn'
import { Heading } from './heading'

/** Page-section rhythm: 128px desktop, 72px mobile, set in one place. */
export function Section({
  className,
  children,
  inverted,
  id,
  measure = 'full',
}: {
  className?: string
  children: React.ReactNode
  inverted?: boolean
  id?: string
  /**
   * `prose` narrows the *content* to a reading measure while the section
   * itself stays full-bleed and keeps the page's left edge.
   *
   * Two homepage sections were doing this by passing `mx-auto max-w-[68ch]`
   * as `className`, which lands on the <section> element — so the band
   * itself became 68ch wide and centred, and its text started 281px further
   * right than every other section on the page (measured at 1920px: 552 vs
   * 320). The page's left margin visibly wandered as you scrolled. An
   * `inverted` section written that way would also have rendered its dark
   * ground as a narrow box floating mid-page instead of a band across it.
   */
  measure?: 'full' | 'prose'
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
      {/*
        The gutter belongs inside the measure, not outside it. With `px-6
        md:px-10` on the <section>, the 1280px box was centred inside the
        already-padded area, so above 1440px a Section's content sat 40px
        left of the header, hero, journey and footer — all of which pad
        inside a flat 1280. Measured at 1920px: 320 against 360.
      */}
      <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">
        <div className={cn(measure === 'prose' && 'max-w-[68ch]')}>{children}</div>
      </div>
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
