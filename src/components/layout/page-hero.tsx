import Image from 'next/image'
import { Heading } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * One page header for every public page below the homepage.
 *
 * It replaces four hand-written variants that had drifted apart: /startups,
 * /events, /resources and /ecosystem each opened with a raw `<img>` in a
 * fixed 40vh black band, labelled `alt="Hero"` (announced as "Hero" by a
 * screen reader — a decorative image should be silent) and sitting *above*
 * the h1, so the page's title and its first sentence were pushed under the
 * fold on a laptop. /programs, /mentors, /invest, /about and /search had no
 * header treatment at all. Same site, five openings.
 *
 * Now the photograph sits behind the title rather than above it: one screen,
 * one message, and the pages without a photograph keep the identical
 * structure on parchment. The image is decorative in every case — the
 * heading carries the meaning — so its alt text is empty by design.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  image,
  actions,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  /** A path under /public. Decorative: it sets mood behind the words, and never carries information of its own. */
  image?: string
  actions?: React.ReactNode
  className?: string
}) {
  const onDark = Boolean(image)

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        onDark ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)]',
        className,
      )}
    >
      {image && (
        <div aria-hidden className="absolute inset-0">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-ink)] via-[var(--color-ink)]/85 to-[var(--color-ink)]/40" />
        </div>
      )}

      <div
        className={cn(
          'relative mx-auto w-full max-w-[1280px] px-6 md:px-10',
          // Extra top padding clears the sticky header, which sits over the
          // page transparently until the first scroll.
          onDark ? 'py-24 md:py-32' : 'pb-2 pt-14 md:pb-3 md:pt-20',
        )}
      >
        {eyebrow && (
          <p
            className={cn(
              'text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.2em]',
              onDark ? 'text-[var(--color-paper)]/70' : 'text-[var(--color-ink-muted)]',
            )}
          >
            {eyebrow}
          </p>
        )}

        <Heading as="h1" size="display" className={cn(eyebrow && 'mt-4', 'max-w-[20ch]')}>
          {title}
        </Heading>

        {lede && (
          <div
            className={cn(
              'mt-5 max-w-[58ch] text-[length:var(--text-body)] leading-relaxed',
              onDark ? 'text-[var(--color-paper)]/85' : 'text-[var(--color-ink-soft)]',
            )}
          >
            {lede}
          </div>
        )}

        {actions && <div className="mt-8 flex flex-wrap items-center gap-4">{actions}</div>}
      </div>
    </section>
  )
}

/**
 * The loading placeholder for `PageHero`, so a route's `loading.tsx` reserves
 * the same block the real header occupies. Without it every listing page
 * jumped by a full hero's height the moment its data resolved.
 */
export function PageHeroSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={cn(
        'w-full px-6 md:px-10',
        dark ? 'bg-[var(--color-ink)] py-24 md:py-32' : 'bg-[var(--color-paper)] pb-2 pt-14 md:pb-3 md:pt-20',
      )}
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <div
          className={cn(
            'h-3 w-24 rounded-[var(--radius-sm)]',
            dark ? 'bg-white/20' : 'bg-[var(--color-paper-soft)]',
          )}
        />
        <div
          className={cn(
            'mt-6 h-12 w-2/3 max-w-[520px] rounded-[var(--radius-sm)] md:h-16',
            dark ? 'bg-white/20' : 'bg-[var(--color-paper-soft)]',
          )}
        />
        <div
          className={cn(
            'mt-5 h-4 w-full max-w-[520px] rounded-[var(--radius-sm)]',
            dark ? 'bg-white/15' : 'bg-[var(--color-paper-soft)]',
          )}
        />
      </div>
    </div>
  )
}
