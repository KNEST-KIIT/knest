import { Section, Skeleton, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-1/2 max-w-[400px]" />
      <Skeleton className="mt-4 h-5 w-full max-w-[500px]" />
      <div className="mt-16">
        <Skeleton className="h-8 w-64" />
        <div className="mt-6">
          <SkeletonGrid />
        </div>
      </div>
    </Section>
  )
}
