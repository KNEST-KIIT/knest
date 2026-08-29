import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-1 w-full" />
      <Skeleton className="mt-8 h-10 w-2/3" />
      <Skeleton className="mt-6 h-32 w-full" />
    </div>
  )
}
