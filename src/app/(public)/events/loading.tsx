import { Section, Skeleton, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-1/2 max-w-[400px]" />
      <Skeleton className="mt-4 h-5 w-1/2 max-w-[350px]" />
      <div className="mt-10 flex gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-32" />
        ))}
      </div>
      <div className="mt-10">
        <SkeletonGrid />
      </div>
    </Section>
  )
}
