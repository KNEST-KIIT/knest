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
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-500',
        scrolled || open
          ? 'border-b border-[var(--color-line)]/40 bg-[var(--color-paper)]/95 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.04)]'
          : 'border-b border-transparent bg-gradient-to-b from-[var(--color-paper)] via-[var(--color-paper)]/80 to-transparent backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1280px] items-center justify-between px-6 md:px-10">
        {/* The link carries the accessible name so a screen reader hears the
            destination ("KNEST — home") rather than the asset ("KNEST Logo"),
            and `h-11` brings a 40px target up to the 44px the rest of the
            header uses. `items-baseline` did nothing here — the link holds a
            single image, which has no baseline to align to. */}
        <Link href="/" aria-label="KNEST — home" className="flex h-11 items-center gap-2">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // `py-1` gave a 40px-tall target. `h-11` states the same
                  // 44px the header's own icon and menu buttons already use.
                  'flex h-11 items-center border-b-2 text-[length:var(--text-small)] font-medium transition-colors',
                  active
                    ? 'border-[var(--color-signal)] text-[var(--color-ink)]'
                    : 'border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)]',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/search"
            aria-label="Search"
            className="flex size-11 items-center justify-center text-[var(--color-ink-soft)] hover:text-[var(--color-signal)]"
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.75">
              <circle cx="8.5" cy="8.5" r="6" />
              <path d="M17 17l-4-4" strokeLinecap="round" />
            </svg>
          </Link>
          {signedIn ? (
            <div className="relative">
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
              <ButtonLink href="/signup" size="sm">
                Start building
              </ButtonLink>
              <Link
                href="/login"
                className="flex h-11 items-center rounded-[var(--radius-sm)] px-2 text-[length:var(--text-small)]"
              >
                Log in
              </Link>
            </>
          )}
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="-mr-2 flex size-11 items-center justify-center lg:hidden"
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

      {open && (
        <div
          ref={panelRef}
          id="mobile-nav"
          className="fixed inset-x-0 bottom-0 top-[4.5rem] z-50 flex flex-col bg-[var(--color-paper)] lg:hidden"
        >
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 py-6 md:px-10">
            <Link
              href="/search"
              className="border-b border-[var(--color-line)] py-4 font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold"
            >
              Search
            </Link>
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
          <div className="flex flex-col gap-3 border-t border-[var(--color-line)] px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10">
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
    </header>
  )
}
