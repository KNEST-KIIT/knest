import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-12 w-3/4" />
      <Skeleton className="mt-4 h-6 w-1/2" />
      <Skeleton className="mt-10 h-64 w-full" />
    </div>
  )
}
