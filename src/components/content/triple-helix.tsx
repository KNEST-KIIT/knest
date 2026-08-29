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
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.label}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 text-center"
          >
            <p className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase leading-tight">
              {pillar.label}
            </p>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{pillar.role}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        Three pillars reinforcing each other — KNEST&rsquo;s own framing, after Etzkowitz &amp;
        Leydesdorff&rsquo;s Triple Helix model (1995).
      </p>
    </div>
  )
}
