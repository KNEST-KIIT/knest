'use client'

import { ButtonLink, Heading } from '@/components/ui'
import { Button } from '@/components/ui/button'

/**
 * The shared body for every route-segment error.tsx, rendering
 * CONTENT_SPEC.md §9's 500 copy rather than Next's generic error screen —
 * unmet everywhere through Phase 6 since no route had an error.tsx at all.
 *
 * The spec's "We've been told about it" is deliberately not shown: nothing
 * reports errors yet (KN-21), so the sentence would be untrue. Restore it when
 * error reporting exists and has been shown to receive an induced error (Q-03).
 */
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <Heading as="h1" size="title">
        Something went wrong on our end.
      </Heading>
      <p className="mt-3 text-[var(--color-ink-soft)]">
        Not your fault. Please try again in a moment.
      </p>
      <div className="mt-8 flex gap-4">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </div>
  )
}
