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
        'relative rounded-none border border-[var(--color-line)] bg-white p-6 md:p-8',
        'transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]',
        'hover:border-[var(--color-ink)]/20 hover:shadow-[0_12px_32px_-12px_rgba(13,19,33,0.05)]',
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
        'group relative flex flex-col rounded-none border border-[var(--color-line)] bg-white p-6 md:p-8',
        'transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]',
        'hover:border-[var(--color-signal)]/40 hover:bg-gradient-to-b hover:from-[var(--color-paper)]/40 hover:to-white hover:shadow-[0_24px_48px_-12px_rgba(13,19,33,0.1),0_0_0_1px_rgba(122,31,43,0.1)] hover:-translate-y-1',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-signal)]',
        'after:absolute after:inset-0 after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-700',
        'after:bg-[radial-gradient(circle_at_50%_0%,rgba(122,31,43,0.04)_0%,transparent_70%)] after:pointer-events-none',
        className,
      )}
    >
      {children}
      <Link
        href={href}
        className="absolute inset-0 focus:outline-none"
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
