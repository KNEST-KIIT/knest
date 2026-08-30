import { cn } from '@/lib/cn'

/**
 * A loading placeholder matching final layout, not a spinner over blank
 * space (the rule UX_WIREFRAMES.md states everywhere but no route actually
 * implemented through Phase 6 — every async page loaded straight to content
 * with nothing shown in between). Compose these into each route's loading.tsx
 * to approximate that route's real shape.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)]', className)} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-2/3" />
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
