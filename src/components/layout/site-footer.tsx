import Link from 'next/link'
import { Logo } from '@/components/ui'

const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { href: '/programs', label: 'Programs' },
      { href: '/startups', label: 'Startups' },
      { href: '/stories', label: 'Stories' },
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
      { href: '/faq', label: 'Questions' },
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
    <footer className="bg-[var(--color-ink)] text-[var(--color-paper)] relative overflow-hidden border-t border-white/10 pt-16 pb-10">
      {/* Subtle top brand glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[var(--color-signal)]/50 to-transparent pointer-events-none" />

      {/* Massive Integrated Architectural Watermark (Kept in same place, but much more subtle and faint) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden pointer-events-none select-none z-0">
        <span className="text-[15vw] font-black font-[family-name:var(--font-display)] tracking-tighter leading-none text-white/[0.016] whitespace-nowrap">
          KIIT KNEST
        </span>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 md:px-10">
        {/* Main Footer Grid - Ultra-clear high-contrast typography */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 pb-12">
          {/* Brand Column (Spans 5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <Link href="/" className="inline-block transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-[var(--color-signal)]">
              <Logo inverted size="md" />
            </Link>

            <p className="mt-6 max-w-[40ch] text-base text-[var(--color-paper)]/90 font-normal leading-relaxed">
              KIIT&rsquo;s university-wide innovation and entrepreneurship ecosystem. Providing the infrastructure, capital, and network for builders at every stage.
            </p>

            <div className="mt-6 inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-[var(--color-signal)] animate-pulse" />
              <span className="text-xs font-semibold text-white tracking-wide">Campus Labs are Open</span>
            </div>
          </div>

          {/* Links Columns (Spans 7 cols on lg) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                  {column.heading}
                </h2>
                <ul className="flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-paper)]/90 hover:text-white font-medium transition-colors relative group inline-block"
                      >
                        {link.label}
                        <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[var(--color-signal)] transition-all duration-300 group-hover:w-full" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/45 font-light">
          <p>&copy; {new Date().getFullYear()} KNEST, KIIT University. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
