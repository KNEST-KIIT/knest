'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { EXPERTISE_OPTIONS } from '@/payload/fields/taxonomy'
import { SingleSelect } from '@/components/ui'

/**
 * The primary entry: "I need help with →", not a browsable grid of photos.
 * A single-select, not the multi-filter bar /programs and /startups use —
 * the interaction here is deliberately narrower (pick one need, see who can
 * help), matching the collection's own "I need help with…" design intent.
 */
export function NeedSelect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('expertise')

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === selected) params.delete('expertise')
    else params.set('expertise', value)
    router.push(`/mentors?${params.toString()}`)
  }

  return (
    <div>
      <p className="text-[length:var(--text-small)] font-medium">I need help with</p>
      <div className="mt-3">
        <SingleSelect options={[...EXPERTISE_OPTIONS]} value={selected} onChange={select} />
      </div>
    </div>
  )
}
