import { Section, Skeleton, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-1/2 max-w-[400px]" />
      <Skeleton className="mt-4 h-5 w-full max-w-[500px]" />
      <Skeleton className="mt-10 h-12 w-full max-w-[480px]" />
      <div className="mt-10">
        <SkeletonGrid />
      </div>
    </Section>
  )
}
