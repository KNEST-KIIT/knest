import { cn } from '@/lib/cn'

/**
 * The page measure and gutters, in one place.
 *
 * `mx-auto w-full max-w-[1280px] px-6 md:px-10` had been hand-copied to ten
 * call sites, which is how the header and the detail pages had already
 * drifted to different vertical padding while claiming to share a layout.
 * Every full-width surface in the app now runs through this instead.
 *
 * The gutter steps up once more at `lg` than it used to: at 1280px the page
 * is exactly as wide as its own maximum, so without that step the content
 * runs to within 40px of the window edge at the precise width the layout was
 * designed for.
 */
export function Container({
  children,
  className,
  size = 'default',
}: {
  children: React.ReactNode
  className?: string
  /** `narrow` is for reading — long-form and single-column forms. */
  size?: 'default' | 'narrow'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-6 md:px-10 lg:px-12',
        size === 'narrow' ? 'max-w-[880px]' : 'max-w-[1280px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
