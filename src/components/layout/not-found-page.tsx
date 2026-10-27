import type { Metadata } from 'next'
import { ButtonLink, Heading } from '@/components/ui'
import { siteUrl } from '@/lib/site-url'

// global-not-found bypasses every route layout, so it must provide its own
// metadata base for the generated Open Graph image and other relative URLs.
export const metadata: Metadata = {
  title: 'Page not found',
  metadataBase: new URL(siteUrl()),
}

/**
 * The 404 for any URL no route matches (CONTENT_SPEC section 9). Before this
 * existed visitors got Next's default English-only error page, with none of
 * KNEST's styling and no way back.
 */
export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-65 flex-col items-center justify-center px-6 text-center">
      <Heading as="h1" size="title" uppercase>
        This page doesn&rsquo;t exist.
      </Heading>
      <p className="mt-3 text-[var(--color-ink-soft)]">It may have moved, or the link may be wrong.</p>
      <div className="mt-8 flex gap-4">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Search
        </ButtonLink>
      </div>
    </section>
  )
}
