import { HomeLink } from '@/components/layout/home-link'
import { SkipLink } from '@/components/layout/skip-link'
import { requireUser } from '@/server/auth/guards'

/**
 * No global nav (UX_WIREFRAMES.md §6): this flow has exactly one exit, and a
 * nav bar only invites leaving before reaching it. Wordmark, institutional affiliation,
 * and spacious adaptive container.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/onboarding')

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper)]">
        <header className="border-b border-[var(--color-line)] bg-white/80 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <HomeLink className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-bold tracking-tight text-[var(--color-ink)]">
              <span className="size-2 rounded-full bg-[var(--color-signal)]" />
              KNEST
            </HomeLink>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-ink-muted)]">
              Incubation Setup
            </span>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 sm:px-6 pb-24 pt-8 md:pt-12">
          {children}
        </main>
      </div>
    </>
  )
}
