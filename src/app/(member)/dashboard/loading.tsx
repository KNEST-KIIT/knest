import { Section, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <Section>
      <Skeleton className="h-10 w-2/3 max-w-52.5" />
      <Skeleton className="mt-8 h-40 w-full max-w-70" />
    </Section>
  )
}
