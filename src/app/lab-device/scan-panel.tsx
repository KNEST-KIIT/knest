'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { STEP_MS, type Action } from '@/lib/lab-qr/constants'
import { makeLabCode, scanStudentPass, type StaffScanProblem } from '@/lib/lab-qr/client/flows'
import { loadRosterEntries, type RosterEntry } from '@/lib/lab-qr/client/session'
import { formRequest } from '@/lib/form-request'
import { nowMs } from '@/lib/clock'
import { useDevice } from './device-context'
import { buttonClass, cardClass, inputClass, Notice, primaryButtonClass, QrImage, ScanInput } from './parts'

const PROBLEMS: Record<StaffScanProblem, string> = {
  'not-a-pass': 'That is not a lab pass.',
  'not-on-roster': 'That pass is for a booking that is not on your list. It may be assigned to another assistant, or your list is out of date.',
  'unknown-student-key': 'This device does not know that student’s key yet. Refresh the list while online, then scan again.',
  forged: 'That pass did not verify. Do not accept it. Ask the student to open their pass again.',
  expired: 'That pass has expired. Ask the student to show the code that is on their screen now.',
  'wrong-action': 'The student chose the other action. Match the check in / check out setting above, or ask them to switch.',
}

const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })

type Logged = { at: number; tone: 'good' | 'warn' | 'bad'; text: string }

export function ScanPanel() {
  const { store, userId, device, outbox, syncNow, probeOffline, online, outboxVersion } = useDevice()
  const [roster, setRoster] = useState<RosterEntry[] | null>(null)
  const [source, setSource] = useState<'network' | 'cache' | 'none'>('none')
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [mode, setMode] = useState<Action>('in')
  const [log, setLog] = useState<Logged[]>([])
  const [labId, setLabId] = useState<string | null>(null)
  const [deskToken, setDeskToken] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [results, setResults] = useState<{ verified: number; held: number; rejected: number }>({ verified: 0, held: 0, rejected: 0 })

  const reload = useCallback(async () => {
    const loaded = await loadRosterEntries(store, userId, fetch)
    setRoster(loaded.entries)
    setSource(loaded.source)
    setExpiresAt(loaded.expiresAt)
    setLabId((current) => current ?? loaded.entries[0]?.labId ?? null)
  }, [store, userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the cache and the network on mount
    void reload()
  }, [reload, online])

  useEffect(() => {
    void outbox.status().then((s) => {
      const answered = s.results.map((r) => r.result!)
      setResults({
        verified: answered.filter((r) => r.verified).length,
        held: answered.filter((r) => r.status === 'review').length,
        rejected: answered.filter((r) => r.status === 'rejected').length,
      })
    })
  }, [outbox, outboxVersion])

  const labs = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of roster ?? []) seen.set(e.labId, e.labName)
    return [...seen].map(([id, name]) => ({ id, name }))
  }, [roster])

  // the lab desk code rotates like a pass does
  useEffect(() => {
    if (!labId) return
    let cancelled = false
    const make = async () => {
      const now = nowMs()
      const next = await makeLabCode(device, labId, mode, now)
      if (cancelled) return
      setDeskToken(next)
      setSecondsLeft(Math.max(1, Math.ceil((STEP_MS - (now % STEP_MS)) / 1000)))
    }
    void make()
    const timer = window.setInterval(() => {
      const left = Math.ceil((STEP_MS - (nowMs() % STEP_MS)) / 1000)
      setSecondsLeft(left)
      if (left >= 29) void make()
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [device, labId, mode])

  const push = (entry: Omit<Logged, 'at'>) => setLog((l) => [{ at: nowMs(), ...entry }, ...l].slice(0, 8))

  async function onPass(text: string) {
    const at = nowMs()
    const offline = await probeOffline()
    const res = await scanStudentPass({ scanned: text, roster: roster ?? [], expectedAction: mode, device, outbox, nowMs: at, offline })
    if (!res.ok) {
      push({ tone: 'bad', text: PROBLEMS[res.problem] })
      return
    }
    push({
      tone: 'good',
      text: `${res.booking.studentName}: pass accepted for ${mode === 'in' ? 'check in' : 'check out'}. Check their ID card matches this name. ${offline ? 'Saved on this device, not sent yet.' : 'Sending.'}`,
    })
    await syncNow()
  }

  if (roster === null) return <p role="status">Loading your list.</p>

  const stale = expiresAt !== null && expiresAt - nowMs() < 0

  return (
    <div className="space-y-6">
      <section className={cardClass} aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="text-[length:var(--text-heading)] font-medium">
          Scan a student pass
        </h2>
        <fieldset className="mt-3">
          <legend className="text-[length:var(--text-small)] font-semibold">Recording</legend>
          <div className="mt-2 flex gap-3">
            {(['in', 'out'] as const).map((a) => (
              <label key={a} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-4">
                <input type="radio" name="mode" value={a} checked={mode === a} onChange={() => setMode(a)} />
                {a === 'in' ? 'Check in' : 'Check out'}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <ScanInput id="student-pass" label="Or paste a pass text" help="Use this if a student cannot show the code, for example a cracked screen. It is checked exactly like a scan." cameraLabel="Camera view for scanning a student pass" onCode={(text) => void onPass(text)} />
        </div>
        <ul className="mt-4 space-y-2" aria-label="Recent scans">
          {log.length === 0 && <li className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Scans you make appear here.</li>}
          {log.map((entry) => (
            <li key={entry.at}>
              <Notice tone={entry.tone}>{entry.text}</Notice>
            </li>
          ))}
        </ul>
        {(results.verified > 0 || results.held > 0 || results.rejected > 0) && (
          <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Answered by the server so far on this device: {results.verified} verified, {results.held} held for review, {results.rejected} not counted.
          </p>
        )}
      </section>

      <section className={cardClass} aria-labelledby="desk-heading">
        <h2 id="desk-heading" className="text-[length:var(--text-heading)] font-medium">
          Lab desk code
        </h2>
        <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">Students scan this after you have scanned their pass. Keep it facing the student, not on a shared wall.</p>
        {labs.length === 0 ? (
          <p className="mt-3">No bookings to staff in the next day.</p>
        ) : (
          <>
            {labs.length > 1 && (
              <div className="mt-3">
                <label htmlFor="desk-lab" className="block text-[length:var(--text-small)] font-semibold">
                  Lab
                </label>
                <select id="desk-lab" className={inputClass} value={labId ?? ''} onChange={(e) => setLabId(e.target.value)}>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4">{deskToken ? <QrImage text={deskToken} label={`Lab desk code for ${mode === 'in' ? 'check in' : 'check out'}. Students scan this.`} /> : null}</div>
            <p className="mt-2 text-center text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              Showing the {mode === 'in' ? 'check in' : 'check out'} code. Changes in {secondsLeft} seconds.
            </p>
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Desk code as text</summary>
              <textarea readOnly rows={4} value={deskToken} aria-label="Lab desk code text" className={`${inputClass} mt-2 py-2 font-mono`} />
            </details>
          </>
        )}
      </section>

      <section className={cardClass} aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-[length:var(--text-heading)] font-medium">
          Your list
        </h2>
        {source === 'cache' && <div className="mt-2"><Notice tone="warn">Showing the list saved on this device{expiresAt ? ` (kept until ${day.format(new Date(expiresAt))} ${clock.format(new Date(expiresAt))})` : ''}. It refreshes when you are online.</Notice></div>}
        {stale && <div className="mt-2"><Notice tone="bad">This saved list has expired. Connect to load a new one.</Notice></div>}
        {roster.length === 0 ? (
          <p className="mt-3 text-[var(--color-ink-soft)]">
            No approved bookings for you in the next day.{source === 'none' && !online ? ' Connect once to load your list.' : ''}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)]">
            {roster.map((entry) => (
              <li key={entry.bookingId} className="py-3">
                <p className="font-semibold">{entry.studentName}</p>
                <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {entry.labName}, {day.format(new Date(entry.startsAt))} {clock.format(new Date(entry.startsAt))} to {clock.format(new Date(entry.endsAt))}
                </p>
                <p className="mt-1 text-[length:var(--text-small)]">
                  Check in: {entry.checks.in === 'verified' ? 'verified' : entry.checks.in === 'partial' ? 'recorded by one side' : 'not yet'}. Check out: {entry.checks.out === 'verified' ? 'verified' : entry.checks.out === 'partial' ? 'recorded by one side' : 'not yet'}.
                  {entry.checks.reviewPending ? ' A scan is waiting for the lab head.' : ''}
                </p>
                {entry.studentKeys.length === 0 && <p className="text-[length:var(--text-small)] text-[var(--color-caution)]">This student has not set up this pass on a phone yet. They can still be recorded by hand below.</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <button type="button" className={buttonClass} onClick={() => void reload()}>
            Refresh list
          </button>
        </div>
      </section>

      <ManualRecord roster={roster} online={online} onDone={reload} />
    </div>
  )
}

/** Recording by hand: always available, never hidden, and labelled as manual in the record and the reports. */
function ManualRecord({ roster, online, onDone }: { roster: RosterEntry[]; online: boolean; onDone: () => Promise<void> }) {
  const [booking, setBooking] = useState('')
  const [outcome, setOutcome] = useState<'attended' | 'no_show'>('attended')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!booking) return
    setPending(true)
    setMessage(null)
    const res = await formRequest(`/api/labs/bookings/${booking}/attendance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome, reason }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setPending(false)
    if (!res.ok) {
      setMessage({ tone: 'bad', text: body.error ?? 'That did not go through. Try again.' })
      return
    }
    setMessage({ tone: 'good', text: 'Recorded by hand. It shows as manual, not QR-verified, in reports.' })
    setReason('')
    await onDone()
  }

  return (
    <section className={cardClass} aria-labelledby="manual-heading">
      <h2 id="manual-heading" className="text-[length:var(--text-heading)] font-medium">
        Record by hand
      </h2>
      <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        Use this when scanning is not possible. It is stored with your reason and reported as manual, separately from verified scans. It needs a connection.
      </p>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <div>
          <label htmlFor="manual-booking" className="block text-[length:var(--text-small)] font-semibold">
            Booking
          </label>
          <select id="manual-booking" required className={inputClass} value={booking} onChange={(e) => setBooking(e.target.value)}>
            <option value="">Choose a booking</option>
            {roster.map((r) => (
              <option key={r.bookingId} value={r.bookingId}>
                {r.studentName}, {r.labName}, {clock.format(new Date(r.startsAt))}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="text-[length:var(--text-small)] font-semibold">Outcome</legend>
          <div className="mt-2 flex gap-3">
            <label className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-4">
              <input type="radio" name="outcome" checked={outcome === 'attended'} onChange={() => setOutcome('attended')} /> Attended
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-4">
              <input type="radio" name="outcome" checked={outcome === 'no_show'} onChange={() => setOutcome('no_show')} /> No show
            </label>
          </div>
        </fieldset>
        <div>
          <label htmlFor="manual-reason" className="block text-[length:var(--text-small)] font-semibold">
            Why is this recorded by hand?
          </label>
          <input id="manual-reason" required minLength={3} maxLength={200} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="submit" className={primaryButtonClass} disabled={pending || !online} aria-busy={pending}>
          {pending ? 'Saving' : 'Record attendance'}
        </button>
        {!online && <Notice tone="warn">You are offline. Recording by hand needs a connection.</Notice>}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </form>
    </section>
  )
}
