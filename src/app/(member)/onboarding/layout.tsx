import Link from 'next/link'
import { KnestWordmark } from '@/components/brand'
import { SkipLink } from '@/components/layout/skip-link'
import { requireUser } from '@/server/auth/guards'

/**
 * No global nav (UX_WIREFRAMES.md §6): this flow has exactly one exit, and a
 * nav bar only invites leaving before reaching it. Just the wordmark and
 * whatever progress indicator the step itself renders.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/onboarding')

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper)]">
        <header className="border-b border-[var(--color-line)] px-6 py-4">
          <Link
            href="/"
            aria-label="KNEST — home"
            className="inline-block text-[21px] transition-opacity duration-[var(--duration-instant)] hover:opacity-70"
          >
            <KnestWordmark />
          </Link>
        </header>
        <main id="main" className="mx-auto w-full max-w-[640px] px-6 pb-32 pt-10 md:pb-16">
          {children}
        </main>
      </div>
    </>
  )
}
