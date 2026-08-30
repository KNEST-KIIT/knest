import { cn } from '@/lib/cn'

/**
 * The one heading primitive, in four sizes: `hero` for the single largest
 * headline on a page, then display/title/heading for the three tiers already
 * in use across the app (surveyed from actual call sites when this was
 * built: 2/18/12 instances respectively). Every display
 * heading in the app should render through this rather than hand-copying the
 * className string, which had drifted to 35 independent instances by Phase
 * 5-6.
 *
 * Deliberately carries no font-weight utility: Anton (the display face) loads
 * a single weight (400) that already reads as maximally heavy by design.
 * Requesting `font-bold`/`font-extrabold` on top asks the browser to
 * synthesize a weight with no matching font file — most browsers "faux-bold"
 * that by thickening strokes algorithmically, which visibly distorts an
 * already-heavy poster face. The old className strings had drifted into
 * doing exactly this in 24 of 35 places.
 */

const SIZES = {
  /* The page's one largest thing. `--text-hero` had been declared in
     tokens.css since the type scale was written and referenced by nothing,
     so the homepage headline rendered at the same size as every section
     heading below it and the hero had no size advantage over the page it
     opens. */
  hero: 'text-[length:var(--text-hero)] leading-[0.9] tracking-[-0.03em]',
  display: 'text-[length:var(--text-display)] leading-[0.95] tracking-[-0.02em]',
  title: 'text-[length:var(--text-title)] leading-tight',
  heading: 'text-[length:var(--text-heading)] leading-tight',
} as const

export function Heading({
  as: Tag = 'h2',
  size = 'title',
  uppercase = true,
  className,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  size?: keyof typeof SIZES
  uppercase?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tag
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
