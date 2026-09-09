'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/applications', label: 'Applications' },
  { href: '/dashboard/events', label: 'Events' },
]

/**
 * The member area had three pages and no way between them: `/dashboard/events`
 * had zero inbound links anywhere in the app, and `/dashboard/applications`
 * was reachable only from a founder's accepted-program card. Both pages were
 * built, guarded and reachable only by typing the URL.
 */
export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Dashboard"
      className="border-b border-[var(--color-line)] bg-[var(--color-paper)]"
    >
      <div className="mx-auto flex w-full max-w-[1280px] gap-6 overflow-x-auto px-6 md:px-10">
        {TABS.map((tab) => {
          // Exact match for the index tab, prefix for the rest — otherwise
          // "Overview" would read as current on every page below it.
          const active = tab.href === '/dashboard' ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 py-4 text-[length:var(--text-small)] font-medium transition-colors',
                active
                  ? 'border-[var(--color-signal)] text-[var(--color-ink)]'
                  : 'border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
