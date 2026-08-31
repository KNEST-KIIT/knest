import { Container, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <Container size="reading" className="py-16">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-12 w-3/4" />
      <Skeleton className="mt-4 h-6 w-1/2" />
      <Skeleton className="mt-10 h-64 w-full" />
    </Container>
  )
}
