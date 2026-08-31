const PILLARS = [
  { label: 'KIIT University', role: 'Policy and infrastructure' },
  { label: 'Schools of KIIT', role: 'Innovation and research' },
  { label: 'Corporate partners', role: 'Market access and capital' },
] as const

/**
 * KNEST's own framing of how it works — Etzkowitz & Leydesdorff's Triple
 * Helix model (1995), sourced from KNEST's official pitch deck
 * (CONTENT_SPEC.md §0), not an invented graphic. Static, no chart library.
 */
export function TripleHelix() {
  return (
    <div className="relative">
      <div className="flex flex-col gap-4">
        {PILLARS.map((pillar, i) => (
          <div
            key={pillar.label}
            className="group relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white p-6 md:p-8 flex items-center gap-6 shadow-sm hover:shadow-xl hover:-translate-x-1 transition-all duration-300 cursor-default"
          >
            {/* Animated gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-signal-wash)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* Index circle */}
            <div className="relative z-10 flex justify-center items-center w-12 h-12 rounded-full bg-[var(--color-paper-soft)] text-[var(--color-ink-soft)] font-[family-name:var(--font-display)] text-xl border border-[var(--color-line)] group-hover:border-[var(--color-signal)] group-hover:text-[var(--color-signal)] transition-colors duration-300 flex-shrink-0">
              {i+1}
            </div>
            
            <div className="relative z-10 flex-1">
              <p className="font-[family-name:var(--font-display)] text-xl md:text-2xl font-bold text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors duration-300">
                {pillar.label}
              </p>
              <p className="mt-2 text-sm md:text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
                {pillar.role}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-[var(--color-ink-muted)] text-center md:text-left font-light max-w-sm mx-auto md:mx-0">
        Three pillars reinforcing each other — KNEST&rsquo;s own framing, after Etzkowitz &amp;
        Leydesdorff&rsquo;s Triple Helix model (1995).
      </p>
    </div>
  )
}
