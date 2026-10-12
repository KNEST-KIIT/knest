'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formRequest } from '@/lib/form-request'

const FIELD = 'h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2 text-[length:var(--text-small)]'
const BUTTON = 'h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] font-medium'

type Row = { id: string; name: string; parentId: string | null; depth: number }

/** The department hierarchy: add, rename, move and remove. Every change is an audited edit of data, never a deploy. */
export function DepartmentManager({ departments }: { departments: Row[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(body: unknown): Promise<boolean> {
    setPending(true)
    setError(null)
    const res = await formRequest('/api/admin/lab-departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    if (!res?.ok) {
      setError(data?.error ?? 'That did not go through. Try again.')
      return false
    }
    router.refresh()
    return true
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          const f = new FormData(form)
          const ok = await call({ action: 'create', department: { name: f.get('name'), parentId: String(f.get('parentId') ?? '') || null } })
          if (ok) form.reset()
        }}
      >
        <label className="flex flex-col text-[length:var(--text-small)]">
          Department name
          <input name="name" required minLength={2} maxLength={100} className={`${FIELD} min-w-[14rem]`} />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          Sits under
          <select name="parentId" defaultValue="" className={FIELD}>
            <option value="">Top level</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {'— '.repeat(d.depth)}
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={BUTTON} disabled={pending}>
          Add department
        </button>
      </form>

      {departments.length === 0 ? (
        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">No departments yet. Add the first one above, then place labs in it from each lab&rsquo;s settings.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2" style={{ paddingInlineStart: `${1 + d.depth * 1.5}rem` }}>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = new FormData(e.currentTarget)
                  void call({ action: 'update', id: d.id, department: { name: f.get('name'), parentId: String(f.get('parentId') ?? '') || null } })
                }}
              >
                <label className="sr-only" htmlFor={`name-${d.id}`}>
                  Name of {d.name}
                </label>
                <input id={`name-${d.id}`} name="name" defaultValue={d.name} required minLength={2} maxLength={100} className={FIELD} />
                <label className="sr-only" htmlFor={`parent-${d.id}`}>
                  Parent of {d.name}
                </label>
                <select id={`parent-${d.id}`} name="parentId" defaultValue={d.parentId ?? ''} className={FIELD}>
                  <option value="">Top level</option>
                  {departments
                    .filter((o) => o.id !== d.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <button type="submit" className={BUTTON} disabled={pending}>
                  Save
                </button>
              </form>
              <button
                type="button"
                className={BUTTON}
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Remove ${d.name}? Its sub-departments become top level and its labs become unplaced. No lab or booking is deleted.`)) void call({ action: 'delete', id: d.id })
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </div>
  )
}
