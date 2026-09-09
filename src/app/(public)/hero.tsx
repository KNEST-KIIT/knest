import Link from 'next/link'
import { ButtonLink } from '@/components/ui'
import { Reveal, RevealHeading } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

export function Hero({ homepage }: { homepage: Homepage }) {
  return (
    <div className="relative w-full flex flex-col lg:flex-row overflow-hidden bg-[var(--color-paper)] border-b border-[var(--color-line)]">
      {/* Editorial Split: Left Content */}
      <div className="relative z-20 w-full lg:w-3/5 flex flex-col px-6 md:px-12 lg:px-20 pt-[20px] lg:pt-[22px] pb-8 lg:pb-10 justify-start">
        <div className="max-w-2xl border-l-4 border-[var(--color-signal)] pl-6 md:pl-8 pt-0 pb-1">
          <RevealHeading 
            size="display" 
            className="text-[var(--color-ink)] text-4xl lg:text-[50px] font-bold tracking-tight leading-[1.05]"
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

          <Reveal delay={0.6} className="mt-7 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <ButtonLink href="/signup" size="lg" className="rounded-none font-bold uppercase tracking-widest text-xs px-6">
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
      <div className="relative w-full h-[320px] lg:h-auto lg:w-2/5 z-10 border-t lg:border-t-0 lg:border-l border-[var(--color-line)] self-stretch">
        <div className="absolute inset-0 bg-[var(--color-signal)]/10 mix-blend-multiply z-10"></div>
        <img 
          src="/images/hero_bg_modern.jpg" 
          alt="Knest Infrastructure" 
          className="w-full h-full object-cover object-center grayscale hover:grayscale-0 transition-all duration-1000 ease-out"
        />
      </div>
    </div>
  )
}

