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
              // `h-11` centres a 26px wordmark in a 44px target, which put
              // the glyphs 9px below the "Explore"/"KNEST"/"Get involved"
              // headings starting at the top of the same grid row — the four
              // columns of the footer began at four different heights. The
              // negative margins pull the box back so the target stays 44px
              // and the type lines up with its neighbours in both axes.
              className="-mx-2 -mt-2 inline-flex h-11 items-center px-2 text-[26px] transition-opacity duration-[var(--duration-instant)] hover:opacity-70"
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
              {/*
                These were 18px-tall targets — the whole of the site's
                secondary navigation sitting under both the 44px bar the rest
                of the app is built to and WCAG 2.5.8's 24px floor. (The
                Privacy/Terms row below already had the fix; these three
                columns were missed.) Each link is now a 44px row and the
                list's gap comes out, so the text keeps roughly the rhythm it
                had while the target grows around it. `-mx-2 px-2` widens the
                target and gives the focus ring something to sit on without
                moving the text off the column edge — the same trick the
                wordmark above uses.
              */}
              <ul className="mt-2 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="-mx-2 flex min-h-11 items-center rounded-[var(--radius-sm)] px-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)] transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-signal)]"
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
