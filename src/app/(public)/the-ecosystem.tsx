import Link from 'next/link'
import { Reveal, RevealHeading } from '@/components/ui'
import { TripleHelix } from '@/components/content/triple-helix'
import { motion } from 'framer-motion'

export async function TheEcosystem() {
  return (
    <section className="relative pt-10 md:pt-14 pb-8 md:pb-10 px-6 md:px-10 mx-auto max-w-7xl">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-paper-soft)] to-transparent opacity-50 pointer-events-none -z-10 rounded-[var(--radius-xl)]"></div>
      
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <p className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)] mb-2">
          Institutional Framework
        </p>
        <RevealHeading size="display" className="tracking-tight text-3xl md:text-5xl font-bold text-[var(--color-ink)]">
          Nobody builds alone.
        </RevealHeading>
        <Reveal delay={0.2}>
          <p className="mt-3 text-base md:text-lg text-[var(--color-ink-soft)] font-light leading-relaxed">
            KNEST connects students, founders, mentors, researchers, industry partners, and investors
            across KIIT. Your idea is one introduction away from someone who can scale it.
          </p>
        </Reveal>
        
        <Reveal delay={0.3} className="mt-6">
          <Link
            href="/ecosystem"
            className="inline-flex items-center gap-2 border border-[var(--color-signal)] bg-[var(--color-signal)] px-6 py-2.5 font-bold uppercase tracking-widest text-xs text-white hover:bg-[var(--color-signal-deep)] transition-colors"
          >
            Explore Complete Ecosystem Architecture →
          </Link>
        </Reveal>
      </div>

      {/* Massive Full-Width Triple Helix Interactive Stage */}
      <div className="w-full relative">
        <Reveal delay={0.4}>
          <TripleHelix />
        </Reveal>
      </div>
    </section>
  )
}
