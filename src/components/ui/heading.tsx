import { cn } from '@/lib/cn'

/**
 * The one heading primitive, in three sizes matching the three tiers already
 * in use across the app (display/title/heading).
 *
 * Re-brand note (second pass): Fraunces (the display face, replacing the
 * grotesque from the first re-brand pass) is a serif built for editorial
 * weight, not poster heaviness — 700 is its heaviest loaded cut, and
 * negative tracking that suited a condensed grotesque reads cramped on a
 * serif with real letterforms, so tracking is neutral-to-loose here instead
 * of tight. `uppercase` still defaults to `false` — mixed case is what
 * makes a serif display face read editorial rather than like a crest.
 */

const SIZES = {
  hero: 'text-[length:var(--text-hero)] font-semibold leading-[1.02] tracking-[-0.01em]',
  display: 'text-[length:var(--text-display)] font-semibold leading-[1.05]',
  title: 'text-[length:var(--text-title)] font-medium leading-tight',
  heading: 'text-[length:var(--text-heading)] font-medium leading-snug',
} as const

export function Heading({
  as: Tag = 'h2',
  size = 'title',
  uppercase = false,
  className,
  style,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  size?: keyof typeof SIZES
  uppercase?: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <Tag
      style={style}
      className={cn(
        'font-[family-name:var(--font-display)]',
        SIZES[size],
        uppercase && 'uppercase',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
