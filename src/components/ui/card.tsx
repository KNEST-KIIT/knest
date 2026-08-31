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
        'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-raised)]',
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
        'group relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)]/60',
        'bg-white/60 backdrop-blur-md p-6 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
        'hover:-translate-y-1.5 hover:border-[var(--color-archive)]/80 hover:bg-white hover:shadow-[0_20px_40px_-15px_rgba(13,19,33,0.1)] hover:ring-1 hover:ring-[var(--color-archive)]/20',
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
