'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FIELD = 'h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2 text-[length:var(--text-small)]'

export function CreateLab() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const f = new FormData(form)
    setPending(true)
    setError(null)
    const res = await fetch('/api/admin/labs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.get('name'), department: f.get('department'), capacity: Number(f.get('capacity')) }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    if (!res?.ok) {
      setError(data?.error ?? 'That did not go through. Try again.')
      return
    }
    form.reset()
    router.push(`/dashboard/lab-staff/${data.slug}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-[length:var(--text-small)]">
        Lab name
        <input name="name" required minLength={2} maxLength={100} className={`${FIELD} min-w-[16rem]`} />
      </label>
      <label className="flex flex-col text-[length:var(--text-small)]">
        Department
        <input name="department" maxLength={100} className={FIELD} />
      </label>
      <label className="flex flex-col text-[length:var(--text-small)]">
        People at a time
        <input name="capacity" type="number" min={1} max={500} defaultValue={1} required className={`${FIELD} w-28`} />
      </label>
      <button type="submit" disabled={pending} className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white">
        {pending ? 'Creating…' : 'Create lab'}
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </form>
  )
}
