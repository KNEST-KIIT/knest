import { cn } from '@/lib/cn'

/**
 * The one heading primitive, in three sizes matching the three tiers already
 * in use across the app (display/title/heading).
 *
 * Re-brand note: the old Anton-based version defaulted to `uppercase` and
 * carried no font-weight utility, because Anton ships one fixed weight that
 * already reads as maximally heavy — requesting a heavier weight on top of
 * it just triggers faux-bold distortion. Bricolage Grotesque (the new
 * display face) is a real variable font with four loaded weights, so this
 * now carries actual weight per tier instead of leaning on a single-weight
 * face's built-in heaviness, and `uppercase` defaults to `false` — mixed
 * case is the new identity's actual look; the four call sites that already
 * asked for `uppercase={false}` explicitly under the old default are
 * unaffected either way.
 */

const SIZES = {
  hero: 'text-[length:var(--text-hero)] font-extrabold leading-[0.94] tracking-[-0.03em]',
  display: 'text-[length:var(--text-display)] font-extrabold leading-[0.98] tracking-[-0.02em]',
  title: 'text-[length:var(--text-title)] font-bold leading-tight tracking-[-0.01em]',
  heading: 'text-[length:var(--text-heading)] font-semibold leading-tight',
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
