'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SingleSelect } from '@/components/ui'

/**
 * The primary entry: "I need help with →", not a browsable grid of photos.
 * A single-select, not the multi-filter bar the other listings use — the
 * interaction here is deliberately narrower (pick one need, see who can
 * help), matching the collection's own "I need help with…" design intent.
 *
 * The options are passed in rather than taken from the taxonomy, so the list
 * only ever offers areas a real mentor actually covers. Offering all nine
 * against an empty or half-built directory sends most visitors to a dead end
 * and makes the network look absent rather than young.
 */
export function NeedSelect({ options }: { options: { value: string; label: string }[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('expertise')

  if (options.length === 0) return null

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === selected) params.delete('expertise')
    else params.set('expertise', value)
    const query = params.toString()
    router.push(query ? `/mentors?${query}` : '/mentors')
  }

  return (
    <div>
      <p className="text-[length:var(--text-small)] font-medium">I need help with</p>
      <div className="mt-3">
        <SingleSelect options={options} value={selected} onChange={select} />
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => select(selected)}
          className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
        >
          Show everyone
        </button>
      )}
    </div>
  )
}
