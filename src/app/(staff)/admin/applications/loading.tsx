import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="overflow-hidden">
      <Skeleton className="h-10 w-48 max-w-full" />
      <Skeleton className="mt-6 h-[var(--control-height-lg)] w-full max-w-xs" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  )
}
