'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function RefreshStatus() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') startTransition(() => router.refresh()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router, startTransition])
  return <Button variant="secondary" size="sm" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'Checking…' : 'Refresh status'}</Button>
}
