import { Container, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <Container size="reading" className="py-16">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-14 w-1/2" />
      <Skeleton className="mt-4 h-8 w-2/3" />
      <Skeleton className="mt-10 h-32 w-full" />
    </Container>
  )
}
