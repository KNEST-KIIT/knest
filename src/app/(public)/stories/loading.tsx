import { PageHeroSkeleton } from '@/components/layout/page-hero'
import { Section, SkeletonGrid } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeroSkeleton dark />
      <Section padding="top">
        <SkeletonGrid />
      </Section>
    </>
  )
}
