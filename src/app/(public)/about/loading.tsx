import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-14 w-1/2" />
      <Skeleton className="mt-4 h-8 w-2/3" />
      <Skeleton className="mt-10 h-32 w-full" />
    </div>
  )
}
