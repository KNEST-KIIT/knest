import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-6 h-11 w-full max-w-[400px]" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  )
}
