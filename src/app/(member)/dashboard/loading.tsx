import { Section, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-2/3 max-w-[420px]" />
      <Skeleton className="mt-8 h-40 w-full max-w-[560px]" />
    </Section>
  )
}
