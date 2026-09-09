import type { Metadata } from 'next'
import { NotFoundBody } from '@/components/errors/not-found-body'

export const metadata: Metadata = { title: 'Page not found' }

/**
 * A `notFound()` from a public page — a startup slug that has been renamed, a
 * resource that was unpublished — renders here, inside the public layout, so
 * the visitor keeps the header, the search and the footer they were using
 * rather than being dropped onto a bare page.
 *
 * Known limitation, measured rather than assumed: Next 16 serves this body
 * with a **200**, not a 404, for a `notFound()` raised under this segment.
 * Verified by removing this file (the root not-found renders, still 200) and
 * by removing the route's `loading.tsx` to rule out its Suspense boundary
 * (still 200) — the public layout is dynamic, so the response has begun
 * before the page decides. A visitor sees the right page; a crawler sees a
 * soft 404. Fixing it means changing how the public layout resolves, which is
 * a bigger change than the 404 page itself and is not attempted here.
 */
export default function PublicNotFound() {
  return <NotFoundBody />
}
