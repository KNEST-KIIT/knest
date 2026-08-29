import { Section, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-1/3 max-w-[300px]" />
      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </Section>
  )
}
