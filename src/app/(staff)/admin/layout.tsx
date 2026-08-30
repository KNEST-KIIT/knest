import Link from 'next/link'
import { KnestWordmark } from '@/components/brand'
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
          <div className="flex items-center gap-6">
            <Link
              href="/admin/applications"
              aria-label="KNEST admin — applications"
              className="flex items-center gap-2.5 transition-opacity duration-[var(--duration-instant)] hover:opacity-70"
            >
              <span className="text-[21px]">
                <KnestWordmark />
              </span>
              {/* The wordmark says which product; this says which part of it.
                  Separated so the mark is never redrawn with a suffix baked in. */}
              <span
                aria-hidden
                className="rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)] px-2 py-0.5 text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]"
              >
                Admin
              </span>
            </Link>
            <nav aria-label="Admin" className="flex gap-4 text-[length:var(--text-small)]">
              <Link href="/admin/applications">Applications</Link>
              <Link href="/admin/analytics">Analytics</Link>
            </nav>
          </div>
          <Link href="/admin" className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
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
