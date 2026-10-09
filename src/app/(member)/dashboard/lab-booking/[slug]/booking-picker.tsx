'use client'

import { useCallback, useEffect, useState } from 'react'
import { TurnstileWidget } from '@/components/security/turnstile-widget'
import { Button } from '@/components/ui/button'
import { daysAgo } from '@/lib/clock'
import { timeLabel, todayIst } from '@/lib/lab-format'

type Slot = { startsAt: string; endsAt: string; free: boolean }

/**
 * Pick a date, then one slot or several consecutive ones, say what you will do, and send the request.
 * The server checks every rule again; this only helps a person choose.
 */
export function BookingPicker({
  slug,
  capacity,
  maxConsecutive,
  horizonDays,
  turnstileSiteKey,
}: {
  slug: string
  capacity: number
  maxConsecutive: number
  horizonDays: number
  turnstileSiteKey: string
}) {
  const today = todayIst()
  const latest = todayIst(daysAgo(-horizonDays))
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaPending = Boolean(turnstileSiteKey) && !captchaToken

  const load = useCallback(
    async (forDate: string) => {
      if (!forDate) return
      setLoading(true)
      setSelected([])
      const res = await fetch(`/api/labs/${slug}/availability?date=${forDate}`).catch(() => null)
      const data = await res?.json().catch(() => null)
      setLoading(false)
      if (!res?.ok) {
        setSlots(null)
        setMessage({ kind: 'error', text: data?.error ?? 'We couldn’t load the times. Try again.' })
        return
      }
      setMessage(null)
      setSlots(data.slots)
    },
    [slug],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads availability when the date changes
    void load(date)
  }, [date, load])

  function toggle(index: number) {
    setMessage(null)
    setSelected((current) => {
      if (current.includes(index)) {
        // Un-picking an end of the run shortens it; un-picking a middle slot starts over.
        const atEnd = index === Math.min(...current) || index === Math.max(...current)
        return atEnd ? current.filter((i) => i !== index) : []
      }
      if (current.length === 0) return [index]
      const next = [...current, index].sort((a, b) => a - b)
      const contiguous = next.every((value, i) => i === 0 || value === next[i - 1]! + 1)
      if (!contiguous || next.length > maxConsecutive) return [index]
      return next
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slots || selected.length === 0) {
      setMessage({ kind: 'error', text: 'Pick a time first.' })
      return
    }
    const first = slots[Math.min(...selected)]!
    const last = slots[Math.max(...selected)]!
    const form = new FormData(event.currentTarget)
    setPending(true)
    setMessage(null)
    const res = await fetch(`/api/labs/${slug}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startsAt: first.startsAt,
        endsAt: last.endsAt,
        purpose: form.get('purpose'),
        headcount: Number(form.get('headcount')),
        equipment: form.get('equipment'),
        turnstileToken: captchaToken,
      }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    setCaptchaToken(null)
    setCaptchaReset((n) => n + 1)
    if (!res?.ok) {
      setMessage({ kind: 'error', text: data?.error ?? 'That did not go through. Try again.' })
      if (data?.code === 'conflict') void load(date)
      return
    }
    setMessage({ kind: 'ok', text: 'Request sent. The lab head will reply, and you will see the answer on this page and by email.' })
    setSelected([])
    void load(date)
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 py-2 text-base'
  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div>
        <label htmlFor="date" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
          Date
        </label>
        <input id="date" type="date" min={today} max={latest} value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1 max-w-[14rem]`} />
      </div>

      <div aria-live="polite">
        {loading && <p className="text-[var(--color-ink-muted)]">Loading times…</p>}
        {!loading && date && slots && slots.length === 0 && <p className="text-[var(--color-ink-muted)]">Nothing can be booked on that day: the lab is closed, or it is too soon or too far ahead.</p>}
        {!loading && slots && slots.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">Times (India Standard Time). You can pick up to {maxConsecutive} in a row.</legend>
            <ul className="mt-2 flex flex-wrap gap-2">
              {slots.map((slot, i) => {
                const on = selected.includes(i)
                return (
                  <li key={slot.startsAt}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!slot.free}
                      onClick={() => toggle(i)}
                      className={`min-h-11 rounded-[var(--radius-sm)] border px-3 py-2 text-[length:var(--text-small)] font-medium ${on ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white' : 'border-[var(--color-line-strong)] bg-white'} ${!slot.free ? 'cursor-not-allowed opacity-60 line-through' : ''}`}
                    >
                      {timeLabel(slot.startsAt)}–{timeLabel(slot.endsAt)}
                      {!slot.free && <span className="sr-only"> (taken)</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">A struck-through time is already taken.</p>
          </fieldset>
        )}
      </div>

      {selected.length > 0 && slots && (
        <p>
          <strong>Your request:</strong> {timeLabel(slots[Math.min(...selected)]!.startsAt)}–{timeLabel(slots[Math.max(...selected)]!.endsAt)} IST
        </p>
      )}

      <div>
        <label htmlFor="purpose" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
          What will you do?
        </label>
        <textarea id="purpose" name="purpose" required minLength={5} maxLength={500} rows={3} className={`${field} mt-1`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="headcount" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
            How many people? (up to {capacity})
          </label>
          <input id="headcount" name="headcount" type="number" min={1} max={capacity} defaultValue={1} required className={`${field} mt-1`} />
        </div>
        <div>
          <label htmlFor="equipment" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
            Equipment you need <span className="font-normal normal-case">(optional)</span>
          </label>
          <input id="equipment" name="equipment" maxLength={300} className={`${field} mt-1`} />
        </div>
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-[var(--color-critical)]' : 'font-semibold text-[var(--color-ink)]'}`}>
          {message.text}
        </p>
      )}

      <TurnstileWidget siteKey={turnstileSiteKey} action="lab-booking" onToken={setCaptchaToken} resetSignal={captchaReset} />

      <div>
        <Button type="submit" size="lg" disabled={pending || captchaPending || selected.length === 0} aria-busy={pending}>
          {pending ? 'Sending…' : 'Send request'}
        </Button>
      </div>
    </form>
  )
}
