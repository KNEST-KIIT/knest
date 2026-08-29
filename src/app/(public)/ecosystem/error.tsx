'use client'

import { RouteError } from '@/components/errors/route-error'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} />
}
