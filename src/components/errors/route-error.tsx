'use client'

import { ButtonLink, Heading } from '@/components/ui'
import { Button } from '@/components/ui/button'

/**
 * The shared body for every route-segment error.tsx, rendering
 * CONTENT_SPEC.md §9's 500 copy rather than Next's generic error screen —
 * unmet everywhere through Phase 6 since no route had an error.tsx at all.
 */
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <Heading as="h1" size="title">
        Something went wrong on our end.
      </Heading>
      <p className="mt-3 text-[var(--color-ink-soft)]">
        Not your fault. We&rsquo;ve been told about it — try again in a moment.
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
