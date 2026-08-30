import { ButtonLink } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

/**
 * WHAT IF? — signature experience 01 (CONTENT_SPEC.md §1.1). Type-only, no
 * stock photography. The only motion is a one-time rise+fade on the
 * headline; everything else on the page after this renders in its final
 * state immediately.
 */
export function Hero({ homepage }: { homepage: Homepage }) {
  return (
    <div className="flex min-h-[90vh] flex-col justify-center px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-[1280px]">
        <h1 className="animate-rise-fade whitespace-pre-line font-[family-name:var(--font-display)] text-[length:var(--text-display)] uppercase leading-[0.95] tracking-[-0.02em]">
          {homepage.heroHeadline}
        </h1>
        <p
          className="animate-rise-fade mt-6 max-w-[52ch] text-[length:var(--text-heading)] text-[var(--color-ink-soft)]"
          style={{ animationDelay: '0.15s' }}
        >
          {homepage.heroSubhead}
        </p>
        <div className="animate-rise-fade mt-10 flex flex-wrap gap-4" style={{ animationDelay: '0.3s' }}>
          <ButtonLink href="/signup" size="lg">
            {homepage.heroPrimaryCta}
          </ButtonLink>
          {homepage.heroSecondaryCta && (
            <ButtonLink href="/programs" variant="secondary" size="lg">
              {homepage.heroSecondaryCta}
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  )
}
