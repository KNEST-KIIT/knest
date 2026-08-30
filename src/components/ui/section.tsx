import { cn } from '@/lib/cn'
import { Container } from './container'
import { Heading } from './heading'

/** Page-section rhythm: 128px desktop, 72px mobile, set in one place. */
export function Section({
  className,
  children,
  inverted,
  id,
}: {
  className?: string
  children: React.ReactNode
  inverted?: boolean
  id?: string
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
      <Container>{children}</Container>
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
