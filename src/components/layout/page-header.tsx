import { Heading } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  kicker?: string
  title: string
  description: string
  imageSrc?: string
  imageAlt?: string
  badgeText?: string
  className?: string
  children?: React.ReactNode
}

export function PageHeader({
  kicker,
  title,
  description,
  imageSrc,
  imageAlt = '',
  badgeText,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'relative w-full border-b border-[var(--color-line)] bg-[var(--color-paper)] overflow-hidden',
        className,
      )}
    >
      <div className="mx-auto flex flex-col lg:flex-row w-full max-w-[1280px]">
        {/* Left Editorial Text */}
        <div className="flex-1 px-6 md:px-10 py-8 md:py-10 flex flex-col justify-center">
          <div className="border-l-4 border-[var(--color-signal)] pl-6 md:pl-8">
            {kicker && (
              <p className="text-[length:var(--text-micro)] uppercase tracking-[0.25em] font-bold text-[var(--color-signal)]">
                {kicker}
              </p>
            )}
            <Heading
              as="h1"
              size="display"
              className="mt-1 text-[var(--color-ink)] text-3xl lg:text-4xl font-bold tracking-tight leading-[1.08]"
            >
              {title}
            </Heading>
            <p className="mt-3 max-w-[56ch] text-base md:text-lg text-[var(--color-ink-soft)] font-light leading-relaxed">
              {description}
            </p>
            {badgeText && (
              <div className="mt-4 inline-flex items-center gap-2 border border-[var(--color-line)] bg-[var(--color-paper-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                <span className="size-1.5 rounded-full bg-[var(--color-signal)]" />
                {badgeText}
              </div>
            )}
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>

        {/* Right Architectural Visual Block (if present) */}
        {imageSrc && (
          <div className="w-full lg:w-[420px] xl:w-[480px] h-[220px] lg:h-auto border-t lg:border-t-0 lg:border-l border-[var(--color-line)] relative overflow-hidden self-stretch">
            <div className="absolute inset-0 bg-[var(--color-signal)]/10 mix-blend-multiply z-10" />
            <img
              src={imageSrc}
              alt={imageAlt}
              className="w-full h-full object-cover object-center grayscale hover:grayscale-0 transition-all duration-700 ease-out"
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The loading placeholder for `PageHeader`, so a route's `loading.tsx`
 * reserves the same block the real header occupies instead of letting the
 * page jump by a header's height once data resolves.
 */
export function PageHeaderSkeleton({ withImage = false }: { withImage?: boolean }) {
  return (
    <div className="relative w-full overflow-hidden border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col lg:flex-row">
        <div className="flex flex-1 flex-col justify-center px-6 py-8 md:px-10 md:py-10">
          <div className="border-l-4 border-[var(--color-signal)] pl-6 md:pl-8">
            <div className="h-3 w-24 rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)]" />
            <div className="mt-3 h-9 w-2/3 max-w-[440px] rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)]" />
            <div className="mt-4 h-4 w-full max-w-[480px] rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)]" />
          </div>
        </div>
        {withImage && (
          <div className="h-[220px] w-full border-t border-[var(--color-line)] bg-[var(--color-paper-soft)] lg:h-auto lg:w-[420px] lg:border-l lg:border-t-0 xl:w-[480px]" />
        )}
      </div>
    </div>
  )
}
