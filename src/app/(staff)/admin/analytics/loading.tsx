import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-8 h-32 w-full" />
      <Skeleton className="mt-10 h-48 w-full" />
    </div>
  )
}
