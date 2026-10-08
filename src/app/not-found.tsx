import type { Metadata } from 'next'
import { ButtonLink, Heading } from '@/components/ui'

export const metadata: Metadata = { title: 'Page not found' }

/**
 * The 404 for any URL no route matches (CONTENT_SPEC section 9). Before this
 * existed visitors got Next's default English-only error page, with none of
 * KNEST's styling and no way back.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
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
    </main>
  )
}
