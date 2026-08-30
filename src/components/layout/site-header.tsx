'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { KnestWordmark } from '@/components/brand'
import { ButtonLink, Container } from '@/components/ui'
import { cn } from '@/lib/cn'
import { duration, ease, spring, stagger } from '@/lib/motion'

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
        'sticky top-0 z-50 transition-colors duration-[var(--duration-base)] ease-[var(--ease-standard)]',
        scrolled || open
          ? 'border-b border-[var(--color-line)] bg-[var(--color-paper)]'
          : 'border-b border-transparent bg-[var(--color-paper)]/80 backdrop-blur',
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          aria-label="KNEST — home"
          className="-mx-2 flex h-11 items-center rounded-[var(--radius-sm)] px-2 text-[22px] transition-opacity duration-[var(--duration-instant)] hover:opacity-70"
        >
          <KnestWordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-[var(--radius-sm)] px-3 py-2 text-[length:var(--text-small)]',
                  'transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-signal)]',
                  active && 'text-[var(--color-signal)]',
                )}
              >
                {item.label}
                {/*
                  One underline shared across the whole nav: `layoutId` makes
                  Motion animate the single element from where it was to
                  where it now is, so navigating tells you which way you
                  moved along the nav instead of the marker just blinking to
                  a new spot. Under prefers-reduced-motion this becomes an
                  instant move, which is exactly the right fallback.
                */}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--color-signal)]"
                    transition={spring.smooth}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/search"
            aria-label="Search"
            className={cn(
              'flex size-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-ink-soft)]',
              'transition-colors duration-[var(--duration-instant)]',
              'hover:bg-[var(--color-paper-soft)] hover:text-[var(--color-signal)]',
            )}
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.75">
              <circle cx="8.5" cy="8.5" r="6" />
              <path d="M17 17l-4-4" strokeLinecap="round" />
            </svg>
          </Link>
          {signedIn ? (
            <div className="relative ml-2">
              <ButtonLink
                href="/dashboard"
                size="sm"
                aria-label={unreadCount > 0 ? `Dashboard — ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : undefined}
              >
                Dashboard
              </ButtonLink>
              {/* The badge is news. It arrives rather than simply being there. */}
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={spring.snappy}
                    className={cn(
                      'absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full',
                      'bg-[var(--color-critical)] text-[9px] font-semibold text-white',
                      'ring-2 ring-[var(--color-paper)]',
                    )}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-[var(--radius-sm)] px-3 py-2 text-[length:var(--text-small)] transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-signal)]"
              >
                Log in
              </Link>
              <ButtonLink href="/signup" size="sm" className="ml-1">
                Start building
              </ButtonLink>
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
          {/*
            The three bars become the X they are replaced by, rather than one
            icon swapping for another — the transform is the explanation that
            the button toggles a single thing.
          */}
          <span aria-hidden className="relative flex h-4 w-6 flex-col justify-between">
            <motion.span
              className="h-0.5 w-full rounded-full bg-[var(--color-ink)]"
              animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              transition={spring.snappy}
            />
            <motion.span
              className="h-0.5 w-full rounded-full bg-[var(--color-ink)]"
              animate={open ? { opacity: 0, scaleX: 0.4 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: duration.instant, ease: ease.standard }}
            />
            <motion.span
              className="h-0.5 w-full rounded-full bg-[var(--color-ink)]"
              animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              transition={spring.snappy}
            />
          </span>
        </button>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id="mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: duration.fast, ease: ease.exit } }}
            transition={{ duration: duration.base, ease: ease.entrance }}
            className="fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col bg-[var(--color-paper)] lg:hidden"
          >
            <motion.nav
              aria-label="Main"
              className="flex flex-1 flex-col overflow-y-auto px-6 py-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: stagger.tight, delayChildren: 0.06 } } }}
            >
              {[{ href: '/search', label: 'Search' }, ...NAV].map((item) => (
                <motion.div
                  key={item.href}
                  variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
                >
                  <Link
                    href={item.href}
                    aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between border-b border-[var(--color-line)] py-4',
                      'font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase',
                      pathname.startsWith(item.href) && 'text-[var(--color-signal)]',
                    )}
                  >
                    {item.label}
                    <svg aria-hidden viewBox="0 0 16 16" className="size-4 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </motion.div>
              ))}
            </motion.nav>
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
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
