import Link from 'next/link'
import { SkipLink } from '@/components/layout/skip-link'
import { requireUser } from '@/server/auth/guards'

/**
 * A minimal focused shell, not the full site nav — same reasoning as
 * onboarding (UX_WIREFRAMES.md §6/§9): a task this specific shouldn't offer
 * a dozen ways to wander off before finishing it.
 */
export default async function ApplyLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper)]">
        <header className="border-b border-[var(--color-line)] px-6 py-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-base font-extrabold uppercase tracking-[0.12em]">
            KNEST
          </Link>
        </header>
        <main id="main" className="mx-auto w-full max-w-[720px] px-6 pb-32 pt-10 md:pb-16">
          {children}
        </main>
      </div>
    </>
  )
}
