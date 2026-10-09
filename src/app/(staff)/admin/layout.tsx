import Link from 'next/link'
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
]

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  const labs = isLabBookingEnabled()
  const items = NAV.filter((item) => (item.area === null || canAccessArea(staff.staffRole, item.area)) && (item.href !== '/admin/labs' || labs))

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper-soft)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/admin/overview" className="font-[family-name:var(--font-display)] text-base uppercase tracking-[0.12em]">
              KNEST Admin
            </Link>
            <nav aria-label="Admin" className="flex flex-wrap gap-4 text-[length:var(--text-small)]">
              {items.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
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
