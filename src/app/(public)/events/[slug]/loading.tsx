import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-10">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-14 w-3/4" />
      <Skeleton className="mt-4 h-6 w-1/2" />
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}
