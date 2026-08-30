import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Heading } from './heading'

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6',
        'shadow-[var(--shadow-flat)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A card whose whole surface is one link.
 *
 * The anchor covers the card via a stretched pseudo-element rather than
 * wrapping the content, so headings and tags stay outside the link text and
 * screen-reader users hear a meaningful label instead of the entire card read
 * as one run-on link.
 */
export function LinkCard({
  href,
  label,
  className,
  children,
}: {
  href: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)]',
        'bg-white p-6',
        // Deliberately restrained: the border darkens and the card gains one
        // step of elevation. No translate and no scale — a card that jumps
        // under the pointer is the default "startup landing page" tic, and
        // on a grid of them it makes the whole page twitch as you read it.
        'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
        'shadow-[var(--shadow-flat)] hover:border-[var(--color-ink)] hover:shadow-[var(--shadow-raised)]',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2',
        'focus-within:outline-[var(--color-signal)]',
        className,
      )}
    >
      {children}
      <Link
        href={href}
        className="absolute inset-0 rounded-[var(--radius-lg)] focus:outline-none"
      >
        <span className="sr-only">{label}</span>
      </Link>
    </div>
  )
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <Heading as="h3" size="heading" uppercase={false}>
      {children}
    </Heading>
  )
}
