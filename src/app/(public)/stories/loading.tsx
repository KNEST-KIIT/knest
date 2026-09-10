import { PageHeaderSkeleton } from '@/components/layout/page-header'
import { Section, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton withImage />
      <Section padding="top">
        <SkeletonGrid />
      </Section>
    </>
  )
}
