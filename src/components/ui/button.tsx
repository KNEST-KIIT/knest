import Link from 'next/link'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/**
 * Press feedback is done in CSS, not Motion.
 *
 * A button press is a 120ms scale on a single element with no state to
 * coordinate — shipping a JS animation runtime to every button in the app to
 * express that would be a worse trade than the effect is worth, and `active:`
 * works on a server component, which keeps `ButtonLink` usable in the header,
 * the footer and every page shell without a client boundary. The global
 * prefers-reduced-motion rule in globals.css already neutralises it.
 */
const base =
  'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow,transform] ' +
  'duration-[var(--duration-fast)] ease-[var(--ease-standard)] ' +
  'active:scale-[0.98] active:duration-[var(--duration-instant)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ' +
  'aria-busy:cursor-progress aria-busy:active:scale-100'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-signal)] text-white hover:bg-[var(--color-signal-deep)] ' +
    'shadow-[var(--shadow-flat)] hover:shadow-[var(--shadow-raised)]',
  secondary:
    'border border-[var(--color-ink)] text-[var(--color-ink)] ' +
    'hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)]',
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

/**
 * The in-flight state.
 *
 * The label stays in the DOM at zero opacity rather than being replaced, so
 * the button does not change width mid-submit — a button that resizes as you
 * click it is the reason "did that register?" happens. `aria-busy` and the
 * `sr-only` status carry the same information to a screen reader that the
 * spinner carries visually.
 */
function Pending({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </span>
      <span className="sr-only">{label}</span>
    </>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  pending = false,
  pendingLabel = 'Working…',
  className,
  children,
  ...props
}: CommonProps & {
  /** Disables the button, shows a spinner, and keeps the label's width. */
  pending?: boolean
  pendingLabel?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      aria-busy={pending || undefined}
      disabled={pending || props.disabled}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-2', pending && 'invisible')}>{children}</span>
      {pending && <Pending label={pendingLabel} />}
    </button>
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
