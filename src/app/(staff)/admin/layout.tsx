import Link from 'next/link'
import { LogoutButton } from '@/components/layout/logout-button'
import { SkipLink } from '@/components/layout/skip-link'
import { requireStaff } from '@/server/auth/guards'
import { canAccessArea, type AdminArea } from '@/server/auth/roles'
import { isLabBookingEnabled } from '@/server/features'

/**
 * A custom shell for operational views that don't fit inside Payload's own
 * admin app (applications live in the app schema, not cms — spec §32).
 * Deliberately not styled to look identical to Payload's admin: pretending to
 * be seamlessly integrated would be more misleading than an honest "you're in
 * a different part of the admin area" with a link back to the CMS.
 *
 * The navigation lists only what this role may open; a screen it cannot open is not shown.
 */
const NAV: { href: string; label: string; area: AdminArea | null }[] = [
  { href: '/admin/overview', label: 'Overview', area: null },
  { href: '/admin/applications', label: 'Applications', area: 'applications' },
  { href: '/admin/enquiries', label: 'Enquiries', area: 'enquiries' },
  { href: '/admin/members', label: 'Members', area: 'users' },
  { href: '/admin/labs', label: 'Labs', area: 'infrastructure' },
  { href: '/admin/audit', label: 'Audit trail', area: 'audit' },
  { href: '/admin/analytics', label: 'Analytics', area: 'analytics' },
  { href: '/admin/mail', label: 'Mail', area: 'mail' },
]

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  const labs = isLabBookingEnabled()
  const items = NAV.filter((item) => (item.area === null || canAccessArea(staff.staffRole, item.area)) && (item.href !== '/admin/labs' || labs))
  const managesContent = (['content', 'programs', 'startups', 'mentors', 'infrastructure'] as const).some((area) => canAccessArea(staff.staffRole, area))

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper-soft)]">
        <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-1.5 sm:px-6 sm:py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-6">
            <Link href="/admin/overview" className="inline-flex min-h-[44px] items-center font-[family-name:var(--font-display)] text-sm sm:text-base uppercase tracking-[0.12em] font-semibold">
              KNEST Admin
            </Link>
            <nav aria-label="Admin" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-[length:var(--text-small)] sm:gap-4">
              {items.map((item) => (
                <Link key={item.href} href={item.href} className="inline-flex min-h-[44px] items-center text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:underline">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
            <Link href="/dashboard/account" className="inline-flex min-h-[44px] items-center text-xs sm:text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Account</Link>
            {managesContent && <Link href="/admin" className="inline-flex min-h-[44px] items-center text-xs sm:text-[length:var(--text-small)] text-[var(--color-ink-muted)] hover:underline">
              Content management →
            </Link>}
            <LogoutButton className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-xs sm:text-[length:var(--text-small)] font-medium" />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl px-6 py-10">
          {children}
        </main>
      </div>
    </>
  )
}
