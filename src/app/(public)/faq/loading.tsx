import { PageHeroSkeleton } from '@/components/layout/page-hero'
import { Section, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeroSkeleton />
      <Section padding="top">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 flex max-w-[68ch] flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Section>
    </>
  )
}
