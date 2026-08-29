import { cn } from '@/lib/cn'

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
        'px-6 py-[72px] md:px-10 md:py-32',
        inverted && 'bg-[var(--color-ink)] text-[var(--color-paper)]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1280px]">{children}</div>
    </section>
  )
}

export function SectionHeading({
  children,
  as: Tag = 'h2',
  className,
}: {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <Tag
      className={cn(
        'font-[family-name:var(--font-display)] text-[length:var(--text-display)]',
        'font-extrabold uppercase leading-[0.95] tracking-[-0.02em]',
        className,
      )}
    >
      {children}
    </Tag>
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
