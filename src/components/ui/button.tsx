import Link from 'next/link'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-colors duration-200 motion-reduce:transition-none ring-offset-2 ring-offset-[var(--color-paper)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'group'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-signal)] text-white hover:bg-[var(--color-signal-deep)] ' +
    'border border-[var(--color-signal-deep)] shadow-sm',
  secondary:
    'border border-[var(--color-line-strong)] bg-white text-[var(--color-ink)] ' +
    'hover:bg-[var(--color-paper-soft)] shadow-sm',
  ghost: 'text-[var(--color-ink)] hover:bg-black/5 hover:text-[var(--color-signal)]',
  danger: 'bg-[var(--color-critical)] text-white hover:brightness-90 shadow-sm',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-[44px] h-11 px-4 text-xs rounded-[var(--radius-sm)]',
  md: 'min-h-[44px] h-11 px-6 text-sm rounded-[var(--radius-sm)]',
  lg: 'min-h-[48px] h-12 px-8 text-base rounded-[var(--radius-sm)]',
}

type CommonProps = { variant?: Variant; size?: Size; fullWidth?: boolean }

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    />
  )
}

/** Same visual language for navigation. A link that looks like a button must still be a link. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...props
}: CommonProps & React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    />
  )
}
