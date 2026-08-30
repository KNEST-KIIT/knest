import Link from 'next/link'
import { Heading } from '@/components/ui'
import { TripleHelix } from '@/components/content/triple-helix'
import { listPartners } from '@/server/content/partners'

/**
 * THE ECOSYSTEM — signature experience 04 (CONTENT_SPEC.md §1.8). The real
 * Triple Helix diagram (shared with /ecosystem, not a duplicate) plus a
 * light pull of partners — Partners has no `featured` field (noted in
 * 7-9.8), so this shows the first few published partners rather than
 * inventing one.
 */
export async function TheEcosystem() {
  const partners = await listPartners(6)

  return (
    <div>
      <Heading as="h2" size="display">
        Nobody builds alone.
      </Heading>
      <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
        KNEST connects students, founders, mentors, researchers, industry partners and investors
        across KIIT. Your idea is one introduction away from someone who can help.
      </p>

      <div className="mt-10">
        <TripleHelix />
      </div>

      {partners.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          {partners.map((partner) => (
            <span key={partner.id} className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              {partner.name}
            </span>
          ))}
        </div>
      )}

      <Link
        href="/ecosystem"
        className="mt-6 -mb-3 inline-flex h-11 items-center text-[length:var(--text-small)] font-medium text-[var(--color-signal)] hover:underline"
      >
        See the full ecosystem →
      </Link>
    </div>
  )
}
