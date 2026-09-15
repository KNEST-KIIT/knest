import Link from 'next/link'
import { ButtonLink } from '@/components/ui'
import { Reveal, RevealHeading } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

export function Hero({ homepage }: { homepage: Homepage }) {
  return (
    <div className="relative w-full flex flex-col lg:flex-row overflow-hidden bg-[var(--color-paper)] border-b border-[var(--color-line)]">
      {/* Editorial Split: Left Content */}
      <div className="relative z-20 w-full lg:w-3/5 flex flex-col px-6 md:px-12 lg:px-20 pt-[20px] lg:pt-[22px] pb-8 lg:pb-10 justify-start">
        <div className="max-w-2xl border-l-4 border-[var(--color-signal)] pl-6 md:pl-10 pt-0 pb-1">
          <RevealHeading 
            size="hero" 
            className="text-[var(--color-ink)] text-5xl lg:text-[64px] font-bold tracking-tight leading-[1.05]"
          >
            {homepage.heroHeadline}
          </RevealHeading>
          
          {homepage.heroSubhead && (
            <Reveal delay={0.4}>
              <p className="mt-5 max-w-lg text-base lg:text-lg text-[var(--color-ink-soft)] font-light leading-relaxed">
                {homepage.heroSubhead}
              </p>
            </Reveal>
          )}

          <Reveal delay={0.6} className="mt-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <ButtonLink href="/signup" size="lg" className="rounded-none font-bold uppercase tracking-[0.15em] text-xs px-8">
              {homepage.heroPrimaryCta}
            </ButtonLink>
            
            {homepage.heroSecondaryCta && (
              <ButtonLink 
                href="/programs" 
                variant="ghost"
                size="lg"
                className="rounded-none font-bold uppercase tracking-widest text-sm border-b-2 border-transparent hover:border-[var(--color-signal)] hover:bg-transparent px-0"
              >
                {homepage.heroSecondaryCta}
              </ButtonLink>
            )}
          </Reveal>
        </div>
      </div>

      {/* Editorial Split: Right Image */}
      <div className="relative w-full h-[320px] lg:h-auto lg:w-2/5 z-10 border-t lg:border-t-0 lg:border-l border-[var(--color-line)] self-stretch overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-signal-deep)]/20 to-[var(--color-archive)]/10 mix-blend-multiply z-10 transition-opacity duration-1000 group-hover:opacity-50"></div>
        <div className="absolute inset-0 bg-black/5 z-10"></div>
        <img 
          src="/images/hero_bg_modern.jpg" 
          alt="Knest Infrastructure" 
          className="w-full h-full object-cover object-center grayscale opacity-90 transition-all duration-[2000ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-100"
        />
      </div>
    </div>
  )
}

