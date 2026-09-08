import Link from 'next/link'
import { SkipLink } from '@/components/layout/skip-link'
import { requireStaff } from '@/server/auth/guards'

/**
 * A custom shell for operational views that don't fit inside Payload's own
 * admin app (applications live in the app schema, not cms — spec §32).
 * Deliberately not styled to look identical to Payload's admin: pretending to
 * be seamlessly integrated would be more misleading than an honest "you're in
 * a different part of the admin area" with a link back to the CMS.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaff()

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper-soft)]">
        <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-paper)] px-6 py-4">
          {/* Every link in this shell was a 22-24px target. The negative
              inline margin keeps the text where it was while the hit area
              grows to the 44px the rest of the app is built to. */}
          <div className="flex items-center gap-4">
            <Link
              href="/admin/applications"
              className="-mx-2 flex h-11 items-center rounded-[var(--radius-sm)] px-2 font-[family-name:var(--font-display)] text-base uppercase tracking-[0.12em]"
            >
              KNEST Admin
            </Link>
            <nav aria-label="Admin" className="flex gap-1 text-[length:var(--text-small)]">
              <Link href="/admin/applications" className="flex h-11 items-center rounded-[var(--radius-sm)] px-2">
                Applications
              </Link>
              <Link href="/admin/analytics" className="flex h-11 items-center rounded-[var(--radius-sm)] px-2">
                Analytics
              </Link>
            </nav>
          </div>
          <Link
            href="/admin"
            className="-mr-2 flex h-11 items-center rounded-[var(--radius-sm)] px-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]"
          >
            Full admin (content, programs, startups) →
          </Link>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1100px] px-6 py-10">
          {children}
        </main>
      </div>
    </>
  )
}
