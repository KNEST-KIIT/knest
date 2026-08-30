import { ButtonLink, Heading } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

/**
 * WHAT IF? — signature experience 01 (CONTENT_SPEC.md §1.1). Type-only, no
 * stock photography. The only motion is a one-time rise+fade on the
 * headline; everything else on the page after this renders in its final
 * state immediately.
 */
export function Hero({ homepage }: { homepage: Homepage }) {
  return (
    <div className="relative flex min-h-[90vh] flex-col justify-center overflow-hidden px-6 py-24 md:px-10">
      {/* A quiet field of color behind the type — not an image, an
          atmosphere. Purely decorative, so it's aria-hidden. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 15% 20%, var(--color-signal-wash) 0%, transparent 60%), radial-gradient(50% 45% at 100% 0%, var(--color-archive-soft) 0%, transparent 55%)',
        }}
      />

      <div className="mx-auto w-full max-w-[1280px]">
        <span className="animate-rise-fade inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white/70 px-3.5 py-1.5 text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.1em] text-[var(--color-signal-deep)] backdrop-blur-sm">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-signal)]" />
          KIIT&rsquo;s innovation ecosystem
        </span>

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
