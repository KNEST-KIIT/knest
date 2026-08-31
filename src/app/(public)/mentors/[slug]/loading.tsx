import { Container, Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <Container size="reading" className="py-16">
      <div className="flex items-start gap-6">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-2 h-5 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-8 h-24 w-full" />
    </Container>
  )
}
