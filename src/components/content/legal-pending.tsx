import Link from 'next/link'
import { Heading } from '@/components/ui'

/**
 * The privacy notice and the terms are KIIT's to write and approve (HD-06). Until a named KIIT
 * owner approves them, these pages say exactly that and nothing more: no invented policy, no
 * promise the platform has not been verified to keep.
 *
 * A reviewable outline appears only when LEGAL_DRAFT_PREVIEW=true (a non-production preview),
 * under a banner on every section, so that KIIT's reviewer can see the structure.
 */

type Kind = 'privacy' | 'terms'

const TITLES: Record<Kind, string> = { privacy: 'Privacy notice', terms: 'Terms of use' }

const PRIVACY_OUTLINE = [
  'Who we are and how to contact us',
  'What we collect and why (account details, onboarding answers, applications and uploaded documents, event registrations, notifications, usage events, security counters)',
  'Who can see it (KNEST staff by role)',
  'Where it is stored and how it is protected',
  'How long we keep it',
  'Your choices and rights, and how to exercise them',
  'Children and minors',
  'Cookies (one sign-in cookie, one anonymous analytics cookie)',
  'Changes to this notice',
]

const TERMS_OUTLINE = [
  'Who may use KNEST and how accounts work',
  'Applications and what an applicant is asked to confirm',
  'Content you submit and who owns it',
  'Acceptable use',
  'Lab booking rules, when lab booking opens',
  'Accounts at graduation',
  'Governing law and jurisdiction',
  'Changes to these terms',
]

export function LegalPending({ kind, preview }: { kind: Kind; preview: boolean }) {
  const outline = kind === 'privacy' ? PRIVACY_OUTLINE : TERMS_OUTLINE
  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
      <Heading as="h1" size="display">
        {TITLES[kind]}
      </Heading>
      <p className="mt-6 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">
        This {kind === 'privacy' ? 'notice' : 'document'} is being finalised with KIIT and has not been published yet.
      </p>
      <p className="mt-4 text-[var(--color-ink-soft)]">
        Until it is, please do not enter personal details you are not comfortable sharing. If you have a question about how your information
        will be handled, <Link href="/contact" className="font-semibold text-[var(--color-signal)] underline underline-offset-4">send us a message</Link>.
      </p>

      {preview && (
        <section aria-label="Draft outline for review" className="mt-12 border-t border-[var(--color-line)] pt-8">
          <p className="inline-block rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Draft, not approved
          </p>
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            Outline for the reviewer only. It is not the policy and must not be relied on. Text for each heading is to be supplied by KIIT.
          </p>
          <ol className="mt-6 list-decimal space-y-3 pl-6 text-[var(--color-ink-soft)]">
            {outline.map((item) => (
              <li key={item}>
                {item} <span className="text-xs font-semibold uppercase text-[var(--color-critical)]">Draft: not approved</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
