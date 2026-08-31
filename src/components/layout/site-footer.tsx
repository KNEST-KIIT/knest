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
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.01em]">
                KNEST
              </span>
              <span aria-hidden className="text-[length:var(--text-micro)] uppercase tracking-[0.16em] text-white/55">
                KIIT
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
              {/* These were 18px-tall targets — the whole of the site's
                  secondary navigation, under both the 44px bar the rest of
                  the app is built to and WCAG 2.5.8's 24px floor. Each link
                  is now a 44px row and the list gap comes out, so the text
                  keeps roughly the rhythm it had while the target grows
                  around it. `-mx-2 px-2` widens it and gives the focus ring
                  something to sit on without moving the text off the column
                  edge. */}
              <ul className="mt-1 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="-mx-2 flex min-h-11 items-center rounded-[var(--radius-sm)] px-2 text-[length:var(--text-small)] text-white/75 transition-colors hover:text-white"
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
          {/* `-my-3 py-3` grows the hit area to 44px without changing where
              the text sits, so the row keeps its rhythm and these stop being
              22px-tall targets on a phone. */}
          <div className="-my-3 flex gap-6">
            <Link href="/privacy" className="flex items-center py-3 hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="flex items-center py-3 hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
