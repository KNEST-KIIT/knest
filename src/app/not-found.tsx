import type { Metadata } from 'next'
import Link from 'next/link'
import { NotFoundBody } from '@/components/errors/not-found-body'
import { SkipLink } from '@/components/layout/skip-link'

export const metadata: Metadata = { title: 'Page not found' }

/**
 * The catch-all for a URL that matches no route at all. It renders outside
 * every route group, so it carries its own minimal chrome rather than the
 * public header and footer — see `(public)/not-found.tsx` for the in-site
 * version a `notFound()` on a real page gets.
 */
export default function NotFound() {
  return (
    <>
      <SkipLink />
      <div className="min-h-dvh bg-[var(--color-paper)]">
        <header className="border-b border-[var(--color-line)] px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-base uppercase tracking-[0.12em]"
          >
            KNEST
          </Link>
        </header>
        <main id="main">
          <NotFoundBody />
        </main>
      </div>
    </>
  )
}
