import Link from 'next/link'
import { Reveal, RevealHeading } from '@/components/ui'
import { TripleHelix } from '@/components/content/triple-helix'
import { listPartners } from '@/server/content/partners'
import { motion } from 'framer-motion'

export async function TheEcosystem() {
  const partners = await listPartners(6)

  return (
    <section className="relative py-32 px-6 md:px-10 mx-auto max-w-7xl">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-paper-soft)] to-transparent opacity-50 pointer-events-none -z-10 rounded-[var(--radius-xl)]"></div>
      
      <div className="text-center md:text-left flex flex-col md:flex-row gap-12 md:gap-24 items-center">
        <div className="flex-1 max-w-xl">
          <RevealHeading size="display" className="tracking-tighter">
            Nobody builds alone.
          </RevealHeading>
          <Reveal delay={0.2}>
            <p className="mt-6 text-[length:var(--text-title)] text-[var(--color-ink-soft)] font-light leading-relaxed">
              KNEST connects students, founders, mentors, researchers, industry partners and investors
              across KIIT. Your idea is one introduction away from someone who can help.
            </p>
          </Reveal>
          
          <Reveal delay={0.4}>
            <Link
              href="/ecosystem"
              className="mt-10 inline-flex items-center px-8 py-4 rounded-full bg-[var(--color-ink)] text-white hover:bg-[var(--color-signal)] transition-colors duration-300 font-medium text-[length:var(--text-small)]"
            >
              See the full ecosystem
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </Reveal>
        </div>

        <div className="flex-1 w-full relative">
          <Reveal delay={0.6}>
            <div className="relative z-10 scale-90 md:scale-100 origin-center">
              <TripleHelix />
            </div>
          </Reveal>
        </div>
      </div>

      {partners.length > 0 && (
        <Reveal delay={0.8} className="mt-24 pt-12 border-t border-[var(--color-line)]">
          <p className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)] uppercase tracking-widest font-semibold mb-8 text-center md:text-left">Selected Partners</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-12 gap-y-8">
            {partners.map((partner) => (
              <span key={partner.id} className="text-[length:var(--text-body)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors duration-300 font-medium">
                {partner.name}
              </span>
            ))}
          </div>
        </Reveal>
      )}
    </section>
  )
}
