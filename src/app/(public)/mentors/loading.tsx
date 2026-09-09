import { PageHeroSkeleton } from '@/components/layout/page-hero'
import { Section, Skeleton, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeroSkeleton />
      <Section padding="top">
        <Skeleton className="h-5 w-32" />
        <div className="mt-6">
          <SkeletonGrid />
        </div>
      </Section>
    </>
  )
}
