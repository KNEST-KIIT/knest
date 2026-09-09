import Link from 'next/link'
import { ButtonLink, Heading } from '@/components/ui'

/**
 * CONTENT_SPEC.md §9 specifies a 404 page — heading, body, and a "go home ·
 * search" pair. No route ever implemented it, so until now every bad link,
 * every renamed slug and every `notFound()` call in the five detail pages
 * landed on Next's built-in black-on-white "404 | This page could not be
 * found", which carries no nav, no search, and nothing that looks like KNEST.
 *
 * Shared between the root `not-found.tsx` (unmatched URLs anywhere) and the
 * public one (a `notFound()` inside the public segment, which keeps the site
 * header and footer around it).
 */
export function NotFoundBody() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-[560px] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
        404
      </p>
      <Heading as="h1" size="title" className="mt-4">
        This page doesn&rsquo;t exist.
      </Heading>
      <p className="mt-4 text-[var(--color-ink-soft)]">
        It may have moved, or the link may be wrong. Neither is your fault.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Search KNEST
        </ButtonLink>
      </div>

      <p className="mt-10 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        Or start from{' '}
        <Link href="/programs" className="underline underline-offset-2">
          programs
        </Link>
        ,{' '}
        <Link href="/events" className="underline underline-offset-2">
          events
        </Link>
        , or{' '}
        <Link href="/resources" className="underline underline-offset-2">
          resources
        </Link>
        .
      </p>
    </div>
  )
}
