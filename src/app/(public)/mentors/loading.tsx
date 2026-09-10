import { PageHeaderSkeleton } from '@/components/layout/page-header'
import { Section, Skeleton, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Section padding="top">
        <Skeleton className="h-5 w-32" />
        <div className="mt-6">
          <SkeletonGrid />
        </div>
      </Section>
    </>
  )
}
