import Link from 'next/link'
import { SkipLink } from '@/components/layout/skip-link'

/**
 * Single centred column, no marketing sidebar (UX_WIREFRAMES.md §5).
 *
 * By the time someone reaches signup or login the decision to try KNEST is
 * already made — a hero image or feature list here is noise competing with
 * the one thing that matters: getting them into an account.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        className="flex min-h-dvh items-center justify-center bg-[var(--color-paper-soft)] px-6 py-16"
      >
        <div className="w-full max-w-[420px]">
          <Link
            href="/"
            className="mb-8 block text-center font-[family-name:var(--font-display)] text-lg font-extrabold uppercase tracking-[0.12em]"
          >
            KNEST
          </Link>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-raised)]">
            {children}
          </div>
        </div>
      </main>
    </>
  )
}
