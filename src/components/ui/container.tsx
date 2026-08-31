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
  /**
   * `narrow` is for constrained layouts that are still a page — a filtered
   * index, a two-column form. `reading` is the long-form measure: a single
   * column of prose someone reads top to bottom.
   *
   * `reading` was not a size here, so the six long-form pages that needed one
   * each wrote `mx-auto w-full max-w-[720px] px-6 py-16 md:px-10` inline
   * instead — the same hand-copied string this component was extracted to
   * delete, re-grown at a fourth measure and one gutter step short of the
   * rest of the app. They now go through here, so the value lives in one
   * place and the `lg` gutter step applies to them too.
   */
  size?: 'default' | 'narrow' | 'reading'
}) {
  const measure = {
    default: 'max-w-[1280px]',
    narrow: 'max-w-[880px]',
    reading: 'max-w-[720px]',
  }[size]

  return (
    <div className={cn('mx-auto w-full px-6 md:px-10 lg:px-12', measure, className)}>
      {children}
    </div>
  )
}
