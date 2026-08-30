import { ButtonLink, Heading } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

/**
 * WHAT IF? — signature experience 01 (CONTENT_SPEC.md §1.1). Type-only, no
 * stock photography, no decorative gradient wash — the restraint is the
 * point, and it's also what keeps this from reading like a generic SaaS
 * hero. The only motion is a one-time rise+fade on the headline; everything
 * else on the page after this renders in its final state immediately.
 */
export function Hero({ homepage }: { homepage: Homepage }) {
  return (
    <div className="flex min-h-[90vh] flex-col justify-center px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-[1280px]">
        <p className="animate-rise-fade flex items-center gap-3 text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.18em] text-[var(--color-signal)]">
          <span aria-hidden className="h-px w-8 bg-[var(--color-signal)]" />
          KIIT&rsquo;s innovation ecosystem
        </p>

        <Heading
          as="h1"
          size="hero"
          className="animate-rise-fade mt-5 whitespace-pre-line"
          style={{ animationDelay: '0.08s' }}
        >
          {homepage.heroHeadline}
        </Heading>
        <p
          className="animate-rise-fade mt-6 max-w-[52ch] text-[length:var(--text-heading)] text-[var(--color-ink-soft)]"
          style={{ animationDelay: '0.18s' }}
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
