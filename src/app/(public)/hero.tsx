import Link from 'next/link'
import { ButtonLink } from '@/components/ui'
import { Reveal, RevealHeading } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

export function Hero({ homepage }: { homepage: Homepage }) {
  return (
    <div className="relative min-h-[95vh] flex flex-col justify-center overflow-hidden bg-[var(--color-ink)]">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--color-ink)]/70 mix-blend-multiply z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-ink)] via-[var(--color-ink)]/80 to-transparent z-10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[var(--color-signal)]/20 via-transparent to-transparent z-10 mix-blend-color-dodge"></div>
        <img 
          src="/images/hero_bg.jpg" 
          alt="Knest Infrastructure" 
          className="w-full h-full object-cover object-center opacity-70 scale-105 motion-safe:animate-[pulse_10s_ease-in-out_infinite_alternate]"
        />
      </div>
      
      {/* Tailwind's `container` sets a different max-width at each breakpoint
          (…1280 at xl, 1536 at 2xl), while the header, footer and every
          Section are a flat 1280. From 1536px up the hero was therefore 256px
          wider than the chrome around it, putting its headline 128px left of
          the logo directly above it — measured 40 vs 168 at 1536, and 232 vs
          360 at 1920. The flat measure is what the rest of the page uses. */}
      <div className="relative z-20 mx-auto w-full max-w-[1280px] px-6 md:px-10">
        <div className="max-w-4xl">
          <RevealHeading 
            size="title" 
            className="text-white text-5xl md:text-6xl lg:text-[72px] font-semibold tracking-tight leading-[1.1] md:leading-[1.05] drop-shadow-xl max-w-4xl"
          >
            {homepage.heroHeadline}
          </RevealHeading>
          
          {homepage.heroSubhead && (
            <Reveal delay={0.4}>
              <p className="mt-8 max-w-2xl text-lg md:text-xl text-[var(--color-paper-soft)] font-light leading-relaxed">
                {homepage.heroSubhead}
              </p>
            </Reveal>
          )}

          <Reveal delay={0.6} className="mt-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <ButtonLink href="/signup">
              <span>{homepage.heroPrimaryCta}</span>
              <svg className="ml-1 w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </ButtonLink>
            
            {homepage.heroSecondaryCta && (
              <ButtonLink 
                href="/programs" 
                variant="secondary"
                className="border-white/30 text-white hover:bg-white hover:text-[var(--color-ink)]"
              >
                {homepage.heroSecondaryCta}
              </ButtonLink>
            )}
          </Reveal>
        </div>
      </div>
    </div>
  )
}
