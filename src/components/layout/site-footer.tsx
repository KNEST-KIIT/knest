import Link from 'next/link'
import { KnestWordmark } from '@/components/brand'
import { Container } from '@/components/ui'

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
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-paper-soft)]">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">
          <div>
            <Link
              href="/"
              aria-label="KNEST — home"
              className="-mx-2 inline-flex h-11 items-center px-2 text-[26px] transition-opacity duration-[var(--duration-instant)] hover:opacity-70"
            >
              <KnestWordmark />
            </Link>
            <p className="mt-5 max-w-[32ch] text-[length:var(--text-small)] leading-relaxed text-[var(--color-ink-soft)]">
              KIIT&rsquo;s innovation and entrepreneurship ecosystem.
              <br />
              KIIT University, Bhubaneswar, Odisha.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {column.heading}
              </h2>
              <ul className="mt-5 flex flex-col gap-3.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[length:var(--text-small)] text-[var(--color-ink-soft)] transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-signal)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} KNEST, KIIT University.</p>
          {/* `-my-3 py-3` grows the hit area to 44px without changing where
              the text sits, so the row keeps its rhythm and the link stops
              being a 22px-tall target on a phone. */}
          <div className="-my-3 flex gap-6">
            <Link
              href="/privacy"
              className="flex items-center py-3 transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-signal)]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="flex items-center py-3 transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-signal)]"
            >
              Terms
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  )
}
