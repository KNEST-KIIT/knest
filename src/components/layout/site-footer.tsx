import Link from 'next/link'

const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { href: '/programs', label: 'Programs' },
      { href: '/startups', label: 'Startups' },
      { href: '/events', label: 'Events' },
      { href: '/resources', label: 'Resources' },
      { href: '/ecosystem', label: 'Ecosystem' },
    ],
  },
  {
    heading: 'KNEST',
    links: [
      { href: '/about', label: 'About' },
      { href: '/ecosystem#infrastructure', label: 'Infrastructure' },
      { href: '/ecosystem#partners', label: 'Partners' },
      { href: '/mentors', label: 'Mentors' },
      { href: '/about#contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Get involved',
    links: [
      { href: '/programs', label: 'Apply' },
      { href: '/mentors#become-a-mentor', label: 'Become a mentor' },
      { href: '/about#partner', label: 'Partner with us' },
      { href: '/invest', label: 'Invest' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-[var(--color-ink)] text-[var(--color-paper)]">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-signal)] font-[family-name:var(--font-display)] text-sm font-extrabold text-white"
              >
                K
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.01em]">
                KNEST
              </span>
            </div>
            <p className="mt-4 max-w-[32ch] text-[length:var(--text-small)] text-white/60">
              KIIT&rsquo;s innovation and entrepreneurship ecosystem.
              <br />
              KIIT University, Bhubaneswar, Odisha.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-white/55">
                {column.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[length:var(--text-small)] text-white/75 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-[length:var(--text-small)] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} KNEST, KIIT University.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
