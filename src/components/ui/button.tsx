import Link from 'next/link'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--color-signal)] text-white hover:bg-[var(--color-signal-deep)]',
  secondary:
    'border border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)]',
  ghost: 'text-[var(--color-ink)] hover:bg-[var(--color-paper-soft)]',
  danger: 'bg-[var(--color-critical)] text-white hover:opacity-90',
}

// Every size clears the 44px minimum touch target on its primary axis.
const sizes: Record<Size, string> = {
  sm: 'h-11 px-4 text-[length:var(--text-small)] rounded-[var(--radius-sm)]',
  md: 'h-12 px-6 text-[length:var(--text-body)] rounded-[var(--radius-md)]',
  lg: 'h-14 px-8 text-[length:var(--text-body)] rounded-[var(--radius-md)]',
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
