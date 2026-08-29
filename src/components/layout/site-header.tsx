'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ButtonLink } from '@/components/ui'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/programs', label: 'Programs' },
  { href: '/startups', label: 'Startups' },
  { href: '/ecosystem', label: 'Ecosystem' },
  { href: '/events', label: 'Events' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
]

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
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
        'sticky top-0 z-50 transition-colors duration-200',
        scrolled || open
          ? 'border-b border-[var(--color-line)] bg-[var(--color-paper)]'
          : 'border-b border-transparent bg-[var(--color-paper)]/80 backdrop-blur',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg uppercase tracking-[0.12em]"
        >
          KNEST
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
              className={cn(
                'text-[length:var(--text-small)] transition-colors hover:text-[var(--color-signal)]',
                pathname.startsWith(item.href) && 'text-[var(--color-signal)]',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {signedIn ? (
            <ButtonLink href="/dashboard" size="sm">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/signup" size="sm">
                Start building
              </ButtonLink>
              <Link href="/login" className="text-[length:var(--text-small)]">
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
          className="fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col bg-[var(--color-paper)] lg:hidden"
        >
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 py-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-[var(--color-line)] py-4 font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {/* Pinned inside the safe area so it clears the home indicator. */}
          <div className="flex flex-col gap-3 border-t border-[var(--color-line)] px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {signedIn ? (
              <ButtonLink href="/dashboard" size="lg" fullWidth>
                Dashboard
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
