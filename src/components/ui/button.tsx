import Link from 'next/link'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden ring-offset-2 ring-offset-[var(--color-paper)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ' +
  'group'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[var(--color-signal)] to-[var(--color-signal-deep)] text-white ' +
    'shadow-[0_2px_10px_rgba(122,31,43,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] ' +
    'hover:shadow-[0_12px_24px_rgba(122,31,43,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:-translate-y-0.5 ' +
    'border border-[var(--color-signal-deep)] ' +
    'after:content-[\'\'] after:absolute after:inset-0 after:bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.1)_20%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.1)_80%,transparent)] ' +
    'after:-translate-x-[150%] hover:after:translate-x-[150%] after:transition-transform after:duration-[1.5s] after:ease-in-out',
  secondary:
    'backdrop-blur-md border border-[var(--color-ink-muted)]/20 bg-white/50 text-[var(--color-ink)] ' +
    'shadow-[0_2px_8px_rgba(13,19,33,0.02)] ' +
    'hover:border-[var(--color-ink)]/30 hover:bg-white/80 hover:shadow-[0_8px_20px_rgba(13,19,33,0.08)] hover:-translate-y-0.5 ' +
    'after:content-[\'\'] after:absolute after:inset-0 after:bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.4)_20%,rgba(255,255,255,0.8)_50%,rgba(255,255,255,0.4)_80%,transparent)] ' +
    'after:-translate-x-[150%] hover:after:translate-x-[150%] after:transition-transform after:duration-[1.5s] after:ease-in-out',
  ghost: 'text-[var(--color-ink)] hover:bg-black/5 hover:text-[var(--color-signal)] transition-colors duration-300',
  danger: 'bg-gradient-to-b from-[var(--color-critical)] to-red-800 text-white shadow-[0_2px_10px_rgba(185,28,28,0.2)] hover:shadow-[0_8px_24px_rgba(185,28,28,0.4)] hover:-translate-y-0.5',
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
