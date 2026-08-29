import { cn } from '@/lib/cn'

/**
 * A circular photo with an initials fallback — needed the moment any page
 * shows a person (mentor cards, founder attribution, event speakers, the
 * dashboard's "welcome back"). Nothing like this existed through Phase 6;
 * each of those surfaces would otherwise have hand-rolled the same
 * img-or-fallback branch independently.
 */

const SIZES = {
  sm: 'size-8 text-[length:var(--text-micro)]',
  md: 'size-12 text-[length:var(--text-small)]',
  lg: 'size-20 text-[length:var(--text-heading)]',
} as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar sources are arbitrary CMS/upload URLs, not statically known at build time
      <img
        src={src}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-[var(--color-archive-soft)] font-medium text-[var(--color-archive)]',
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
