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
        'rounded-none border border-[var(--color-line)] bg-white p-6 md:p-8 transition-colors duration-200',
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
        'group relative flex flex-col rounded-none border border-[var(--color-line)] bg-white p-6 md:p-8 transition-all duration-300',
        'hover:border-[var(--color-signal)] hover:shadow-[0_16px_32px_-12px_rgba(13,19,33,0.08)]',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-signal)]',
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
