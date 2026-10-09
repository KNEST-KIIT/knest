'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { minuteLabel, WEEKDAYS } from '@/lib/lab-format'

const BUTTON = 'h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] font-medium'
const FIELD = 'h-10 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2 text-[length:var(--text-small)]'

/** One small helper for every control here: POST JSON, show the server's own message on failure, refresh on success. */
function useCall() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  async function call(path: string, body: unknown): Promise<boolean> {
    setPending(true)
    setError(null)
    setDone(false)
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    if (!res?.ok) {
      setError(data?.error ?? 'That did not go through. Try again.')
      return false
    }
    setDone(true)
    router.refresh()
    return true
  }
  return { pending, error, done, call }
}

const Error_ = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="text-xs text-[var(--color-critical)]">
      {text}
    </p>
  ) : null

// ---------------------------------------------------------------------------------------------- queue

export function DecisionControls({ id, staff, requiresAssistant }: { id: string; staff: { userId: string; label: string }[]; requiresAssistant: boolean }) {
  const { pending, error, call } = useCall()
  const [mode, setMode] = useState<'none' | 'reject' | 'propose'>('none')
  const endpoint = `/api/labs/bookings/${id}/decide`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[length:var(--text-small)]">
          Assistant{requiresAssistant ? '' : ' (optional)'}
          <select id={`assistant-${id}`} className={FIELD} defaultValue="">
            <option value="">None</option>
            {staff.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BUTTON}
          disabled={pending}
          onClick={() => {
            const assistant = (document.getElementById(`assistant-${id}`) as HTMLSelectElement).value || null
            void call(endpoint, { action: 'approve', assistantUserId: assistant })
          }}
        >
          Approve
        </button>
        <button type="button" className={BUTTON} onClick={() => setMode(mode === 'reject' ? 'none' : 'reject')} aria-expanded={mode === 'reject'}>
          Decline…
        </button>
        <button type="button" className={BUTTON} onClick={() => setMode(mode === 'propose' ? 'none' : 'propose')} aria-expanded={mode === 'propose'}>
          Suggest another time…
        </button>
      </div>

      {mode === 'reject' && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const note = String(new FormData(e.currentTarget).get('note') ?? '')
            void call(endpoint, { action: 'reject', note })
          }}
        >
          <label className="flex flex-col text-[length:var(--text-small)]">
            Reason (the person will read this)
            <input name="note" required minLength={3} maxLength={500} className={`${FIELD} min-w-[18rem]`} />
          </label>
          <button type="submit" className={BUTTON} disabled={pending}>
            Send decision
          </button>
        </form>
      )}

      {mode === 'propose' && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            // The picker is read as India time, whatever the browser's own zone is.
            const toIso = (v: FormDataEntryValue | null) => new Date(`${String(v)}:00+05:30`).toISOString()
            void call(endpoint, { action: 'propose', startsAt: toIso(f.get('start')), endsAt: toIso(f.get('end')), note: String(f.get('note') ?? '') })
          }}
        >
          <label className="flex flex-col text-[length:var(--text-small)]">
            New start (IST)
            <input name="start" type="datetime-local" required className={FIELD} />
          </label>
          <label className="flex flex-col text-[length:var(--text-small)]">
            New end (IST)
            <input name="end" type="datetime-local" required className={FIELD} />
          </label>
          <label className="flex flex-col text-[length:var(--text-small)]">
            Note (optional)
            <input name="note" maxLength={500} className={FIELD} />
          </label>
          <button type="submit" className={BUTTON} disabled={pending}>
            Send suggestion
          </button>
        </form>
      )}
      <Error_ text={error} />
    </div>
  )
}

export function AttendanceControls({ id }: { id: string }) {
  const { pending, error, call } = useCall()
  const [noShow, setNoShow] = useState(false)
  const endpoint = `/api/labs/bookings/${id}/attendance`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} disabled={pending} onClick={() => call(endpoint, { outcome: 'attended' })}>
          Mark attended
        </button>
        <button type="button" className={BUTTON} onClick={() => setNoShow(!noShow)} aria-expanded={noShow}>
          Mark no-show…
        </button>
      </div>
      {noShow && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void call(endpoint, { outcome: 'no_show', reason: String(new FormData(e.currentTarget).get('reason') ?? '') })
          }}
        >
          <label className="flex flex-col text-[length:var(--text-small)]">
            Reason
            <input name="reason" required minLength={3} maxLength={300} className={`${FIELD} min-w-[16rem]`} />
          </label>
          <button type="submit" className={BUTTON} disabled={pending}>
            Record no-show
          </button>
        </form>
      )}
      <p className="text-xs text-[var(--color-ink-muted)]">Recorded by hand and labelled as manual.</p>
      <Error_ text={error} />
    </div>
  )
}

export function CancelControls({ id }: { id: string }) {
  const { pending, error, call } = useCall()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={BUTTON} onClick={() => setOpen(!open)} aria-expanded={open}>
        Cancel this booking…
      </button>
      {open && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void call(`/api/labs/bookings/${id}/cancel`, { note: String(new FormData(e.currentTarget).get('note') ?? '') })
          }}
        >
          <label className="flex flex-col text-[length:var(--text-small)]">
            Reason (the person will read this)
            <input name="note" required minLength={3} maxLength={500} className={`${FIELD} min-w-[18rem]`} />
          </label>
          <button type="submit" className={BUTTON} disabled={pending}>
            Cancel and tell them
          </button>
        </form>
      )}
      <Error_ text={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------- settings

export type SettingsValues = {
  name: string
  department: string
  description: string
  capacity: number
  slotMinutes: number
  maxConsecutiveSlots: number
  minLeadMinutes: number
  maxHorizonDays: number
  maxOpenRequests: number
  maxHoursPerWeek: number
  cancelCutoffMinutes: number
  eligibility: 'verified' | 'onboarded'
  requiresAssistant: boolean
}

const NUMBER_FIELDS: { key: keyof SettingsValues; label: string; hint?: string }[] = [
  { key: 'capacity', label: 'People at a time' },
  { key: 'slotMinutes', label: 'Block length (minutes)' },
  { key: 'maxConsecutiveSlots', label: 'Most blocks in a row' },
  { key: 'minLeadMinutes', label: 'Minimum notice (minutes)' },
  { key: 'maxHorizonDays', label: 'Book up to (days ahead)' },
  { key: 'maxOpenRequests', label: 'Requests waiting, per person' },
  { key: 'maxHoursPerWeek', label: 'Hours per week, per person' },
  { key: 'cancelCutoffMinutes', label: 'Cancel up to (minutes before)' },
]

export function SettingsForm({ slug, values, isAdmin, isActive }: { slug: string; values: SettingsValues; isAdmin: boolean; isActive: boolean }) {
  const { pending, error, done, call } = useCall()
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const settings: Record<string, unknown> = {
          name: f.get('name'),
          department: f.get('department'),
          description: String(f.get('description') ?? '') || null,
          eligibility: f.get('eligibility'),
          requiresAssistant: f.get('requiresAssistant') === 'on',
        }
        for (const field of NUMBER_FIELDS) settings[field.key] = Number(f.get(field.key))
        void call(`/api/labs/${slug}/manage`, { action: 'update', settings: isAdmin ? { ...settings, isActive: f.get('isActive') === 'on' } : settings })
      }}
    >
      <p className="rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)] p-3 text-[length:var(--text-small)]">
        These are the rules this lab applies. The starting values are recommendations and not an approved policy: set what your lab actually needs.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col text-[length:var(--text-small)]">
          Name
          <input name="name" defaultValue={values.name} required minLength={2} maxLength={100} className={FIELD} />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          Department
          <input name="department" defaultValue={values.department} maxLength={100} className={FIELD} />
        </label>
      </div>
      <label className="flex flex-col text-[length:var(--text-small)]">
        About this lab
        <textarea name="description" defaultValue={values.description} maxLength={2000} rows={3} className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white p-2" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NUMBER_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col text-[length:var(--text-small)]">
            {f.label}
            <input name={f.key} type="number" min={0} defaultValue={values[f.key] as number} required className={FIELD} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-[length:var(--text-small)]">
          Who can book
          <select name="eligibility" defaultValue={values.eligibility} className={FIELD}>
            <option value="onboarded">Members who finished their profile</option>
            <option value="verified">Any member with a verified email</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[length:var(--text-small)]">
          <input type="checkbox" name="requiresAssistant" defaultChecked={values.requiresAssistant} /> An assistant must be assigned to approve
        </label>
        {isAdmin && (
          <label className="flex items-center gap-2 text-[length:var(--text-small)]">
            <input type="checkbox" name="isActive" defaultChecked={isActive} /> Open for booking
          </label>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className={BUTTON} disabled={pending}>
          Save settings
        </button>
        {done && <span role="status" className="text-sm font-semibold">Saved.</span>}
      </div>
      <Error_ text={error} />
    </form>
  )
}

// ---------------------------------------------------------------------------------------------- hours

type Window = { weekday: number; opensMinute: number; closesMinute: number }
const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function HoursEditor({ slug, initial }: { slug: string; initial: Window[] }) {
  const { pending, error, done, call } = useCall()
  const [windows, setWindows] = useState<Window[]>(initial)
  const update = (i: number, patch: Partial<Window>) => setWindows((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  return (
    <div className="flex flex-col gap-3">
      {windows.length === 0 && <p className="text-[var(--color-ink-muted)]">No opening hours yet, so nothing can be booked.</p>}
      <ul className="flex flex-col gap-2">
        {windows.map((w, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <select aria-label="Day" value={w.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })} className={FIELD}>
              {WEEKDAYS.map((d, n) => (
                <option key={d} value={n}>
                  {d}
                </option>
              ))}
            </select>
            <input aria-label="Opens" type="time" value={minuteLabel(w.opensMinute)} onChange={(e) => update(i, { opensMinute: toMinutes(e.target.value) })} className={FIELD} />
            <span>to</span>
            <input aria-label="Closes" type="time" value={w.closesMinute === 1440 ? '23:59' : minuteLabel(w.closesMinute)} onChange={(e) => update(i, { closesMinute: toMinutes(e.target.value) })} className={FIELD} />
            <button type="button" className={BUTTON} onClick={() => setWindows((all) => all.filter((_, idx) => idx !== i))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON} onClick={() => setWindows((w) => [...w, { weekday: 1, opensMinute: 9 * 60, closesMinute: 17 * 60 }])}>
          Add a window
        </button>
        <button type="button" className={BUTTON} disabled={pending} onClick={() => call(`/api/labs/${slug}/manage`, { action: 'hours', windows })}>
          Save opening hours
        </button>
        {done && <span role="status" className="text-sm font-semibold">Saved.</span>}
      </div>
      <p className="text-xs text-[var(--color-ink-muted)]">Times are India Standard Time. Bookings already made are not changed; cancel any that no longer fit.</p>
      <Error_ text={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------- closed dates

export function BlackoutManager({ slug, blackouts }: { slug: string; blackouts: { id: string; startsOn: string; endsOn: string; reason: string }[] }) {
  const { pending, error, call } = useCall()
  return (
    <div className="flex flex-col gap-3">
      {blackouts.length === 0 ? (
        <p className="text-[var(--color-ink-muted)]">No closed dates.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blackouts.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 text-[length:var(--text-small)]">
              <span>
                {b.startsOn === b.endsOn ? b.startsOn : `${b.startsOn} to ${b.endsOn}`}
                {b.reason ? `: ${b.reason}` : ''}
              </span>
              <button type="button" className={BUTTON} disabled={pending} onClick={() => call(`/api/labs/${slug}/manage`, { action: 'blackout-remove', blackoutId: b.id })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          void call(`/api/labs/${slug}/manage`, { action: 'blackout-add', blackout: { startsOn: f.get('from'), endsOn: f.get('to') || f.get('from'), reason: f.get('reason') } })
        }}
      >
        <label className="flex flex-col text-[length:var(--text-small)]">
          From
          <input name="from" type="date" required className={FIELD} />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          To (optional)
          <input name="to" type="date" className={FIELD} />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          Reason
          <input name="reason" maxLength={200} className={FIELD} />
        </label>
        <button type="submit" className={BUTTON} disabled={pending}>
          Close these dates
        </button>
      </form>
      <Error_ text={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------- staff

export function StaffManager({ slug, staff, isAdmin }: { slug: string; staff: { id: string; role: string; label: string }[]; isAdmin: boolean }) {
  const { pending, error, call } = useCall()
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 text-[length:var(--text-small)]">
            <span>
              {s.label} <strong>({s.role})</strong>
            </span>
            {(isAdmin || s.role !== 'head') && (
              <button type="button" className={BUTTON} disabled={pending} onClick={() => call(`/api/labs/${slug}/manage`, { action: 'staff-remove', staffId: s.id })}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          void call(`/api/labs/${slug}/manage`, { action: 'staff-add', staff: { email: f.get('email'), role: f.get('role') } })
        }}
      >
        <label className="flex flex-col text-[length:var(--text-small)]">
          Their email address
          <input name="email" type="email" required className={`${FIELD} min-w-[16rem]`} />
        </label>
        <label className="flex flex-col text-[length:var(--text-small)]">
          Role
          <select name="role" className={FIELD} defaultValue="assistant">
            <option value="assistant">Assistant</option>
            {isAdmin && <option value="head">Head</option>}
          </select>
        </label>
        <button type="submit" className={BUTTON} disabled={pending}>
          Add
        </button>
      </form>
      <p className="text-xs text-[var(--color-ink-muted)]">They need a KNEST account with a verified email first.</p>
      <Error_ text={error} />
    </div>
  )
}
