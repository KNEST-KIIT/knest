import { Section, Skeleton, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-1/2 max-w-50" />
      <Skeleton className="mt-4 h-5 w-1/2 max-w-43.75" />
      <div className="mt-10 max-w-52.5">
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="mt-10">
        <SkeletonGrid />
      </div>
    </Section>
  )
}
