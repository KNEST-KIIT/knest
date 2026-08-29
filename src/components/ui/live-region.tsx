'use client'

/**
 * A visually-hidden aria-live announcer. UX_WIREFRAMES.md §3 and §13 both
 * specify announced result counts and save indicators — a written
 * requirement that had no shared implementation through Phase 6, so every
 * call site either built its own or (more often) skipped it. One primitive,
 * reused at each of those call sites.
 */
export function LiveRegion({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {message}
    </span>
  )
}
