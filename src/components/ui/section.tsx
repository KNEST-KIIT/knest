import { cn } from '@/lib/cn'
import { Heading } from './heading'

/**
 * Page-section rhythm: 128px desktop, 72px mobile, set in one place.
 *
 * Vertical spacing is a `padding` prop rather than something a caller
 * overrides through `className`, because `cn` is a plain join with no
 * tailwind-merge behind it: passing `py-16` would leave *both* `py-16` and
 * `py-[72px]` on the element and let whichever Tailwind happened to emit
 * last decide the layout. A named prop cannot half-apply.
 *
 * - `default` — the standard rhythm between sections of a page.
 * - `tight` — stacked content sections that would otherwise drift apart.
 * - `top` — the first section under a `PageHeader`, which already carries its
 *   own generous space above.
 * - `none` — the caller is doing its own spacing.
 */
const PADDING = {
  // `default` is the base branch's tightened rhythm, kept as the standard;
  // the other steps are scaled to sit under it rather than under the
  // 72px/128px one it replaced.
  default: 'py-10 md:py-16',
  tight: 'py-8 md:py-12',
  top: 'pb-10 pt-6 md:pb-16 md:pt-8',
  none: '',
} as const

export function Section({
  className,
  children,
  inverted,
  id,
  padding = 'default',
}: {
  className?: string
  children: React.ReactNode
  inverted?: boolean
  id?: string
  padding?: keyof typeof PADDING
}) {
  return (
    <section
      id={id}
      className={cn(
        'px-6 md:px-10',
        PADDING[padding],
        inverted && 'bg-[var(--color-ink)] text-[var(--color-paper)]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1280px]">{children}</div>
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
