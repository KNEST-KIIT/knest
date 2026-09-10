'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ButtonLink, Logo } from '@/components/ui'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/programs', label: 'Programs' },
  { href: '/startups', label: 'Startups' },
  { href: '/ecosystem', label: 'Ecosystem' },
  { href: '/events', label: 'Events' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
]

export function SiteHeader({ signedIn = false, unreadCount = 0 }: { signedIn?: boolean; unreadCount?: number }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // The header only gains its border once the page has moved, so the hero
  // meets the top of the viewport with nothing drawn across it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // While the mobile panel is open it is the only thing on screen, so the page
  // behind it must not scroll and Escape must close it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-all duration-500',
          scrolled || open
            ? 'border-b border-[var(--color-line)]/40 bg-[var(--color-paper)]/95 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.04)]'
            : 'border-b border-transparent bg-gradient-to-b from-[var(--color-paper)] via-[var(--color-paper)]/80 to-transparent backdrop-blur-md',
        )}
      >
        <div className="flex h-[4.5rem] w-full items-center justify-between px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16">
          {/* Left: Brand Logo & Navigation balanced together */}
          <div className="flex items-center gap-6 lg:gap-8 xl:gap-10 shrink-0">
            <Link
              href="/"
              className="flex items-center group focus-visible:outline-[var(--color-signal)] shrink-0"
              aria-label="KNEST Home"
            >
              <Logo size="md" />
            </Link>

            <nav aria-label="Main" className="hidden items-center gap-3.5 lg:gap-4.5 xl:gap-6 2xl:gap-7 lg:flex">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex items-center h-9 px-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'text-[var(--color-ink)] font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-[var(--color-signal)]'
                        : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: Log In and Start Building CTA */}
          <div className="hidden items-center gap-3 sm:gap-4 lg:flex shrink-0">
            {signedIn ? (
              <div className="relative shrink-0">
                <ButtonLink
                  href="/dashboard"
                  size="sm"
                  aria-label={unreadCount > 0 ? `Dashboard — ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : undefined}
                >
                  Dashboard
                </ButtonLink>
                {unreadCount > 0 && (
                  <span
                    aria-hidden
                    className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-signal)] text-[9px] font-medium text-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center h-9 px-3 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors rounded-lg hover:bg-black/[0.04] whitespace-nowrap shrink-0"
                >
                  Log in
                </Link>
                <ButtonLink href="/signup" size="sm" className="whitespace-nowrap shrink-0">
                  Start building
                </ButtonLink>
              </>
            )}
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="-mr-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--color-ink)] hover:bg-black/[0.04] transition-colors lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden className="flex w-6 flex-col gap-1.5">
              <span
                className={cn(
                  'h-0.5 w-full bg-[var(--color-ink)] transition-transform',
                  open && 'translate-y-2 rotate-45',
                )}
              />
              <span
                className={cn('h-0.5 w-full bg-[var(--color-ink)] transition-opacity', open && 'opacity-0')}
              />
              <span
                className={cn(
                  'h-0.5 w-full bg-[var(--color-ink)] transition-transform',
                  open && '-translate-y-2 -rotate-45',
                )}
              />
            </span>
          </button>
        </div>
      </header>

      {/* Deliberately a sibling of <header>, not a child. The header carries
          a backdrop-filter, and a backdrop-filter establishes a containing
          block for fixed-position descendants — so inside it this panel
          resolved `top-[4.5rem] bottom-0` against the 73px-tall header and
          rendered 0px high. Tapping the menu opened nothing at all. */}
      {open && (
        <div
          ref={panelRef}
          id="mobile-nav"
          className="fixed inset-x-0 bottom-0 top-[4.5rem] z-50 flex flex-col bg-[var(--color-paper)] lg:hidden"
        >
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 py-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-[var(--color-line)] py-4 font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {/* Pinned inside the safe area so it clears the home indicator. */}
          <div className="flex flex-col gap-3 border-t border-[var(--color-line)] px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {signedIn ? (
              <ButtonLink
                href="/dashboard"
                size="lg"
                fullWidth
                aria-label={unreadCount > 0 ? `Dashboard — ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : undefined}
              >
                Dashboard{unreadCount > 0 && ` (${unreadCount > 9 ? '9+' : unreadCount})`}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/signup" size="lg" fullWidth>
                  Start building
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg" fullWidth>
                  Log in
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
