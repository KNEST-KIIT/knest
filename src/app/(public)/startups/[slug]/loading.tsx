import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-10">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-4 h-14 w-3/4" />
      <Skeleton className="mt-4 h-6 w-1/2" />
      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
