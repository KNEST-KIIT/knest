import Link from 'next/link'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-all duration-300 ease-out overflow-hidden ring-offset-2 ring-offset-[var(--color-paper)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] ' +
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[var(--color-signal)] to-[var(--color-signal-deep)] text-white shadow-[0_2px_10px_rgba(122,31,43,0.2)] hover:shadow-[0_4px_16px_rgba(122,31,43,0.4)] hover:-translate-y-0.5 border border-[var(--color-signal-deep)]/50 after:absolute after:inset-0 after:bg-white/20 after:opacity-0 hover:after:opacity-100 after:transition-opacity',
  secondary:
    'backdrop-blur-md border border-[var(--color-ink-muted)]/20 bg-black/5 text-[var(--color-ink)] hover:border-[var(--color-ink)]/50 hover:bg-black/10 hover:shadow-sm hover:-translate-y-0.5',
  ghost: 'text-[var(--color-ink)] hover:bg-black/5',
  danger: 'bg-gradient-to-b from-[var(--color-critical)] to-red-800 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs rounded-[var(--radius-md)]',
  md: 'h-11 px-6 text-sm rounded-[var(--radius-md)]',
  lg: 'h-12 px-8 text-base rounded-[var(--radius-md)]',
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
