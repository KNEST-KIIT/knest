import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-2/3" />
        <div className="mt-8 flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
