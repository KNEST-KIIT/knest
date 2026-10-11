'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { nowMs } from '@/lib/clock'
import { STEP_MS, type Action } from '@/lib/lab-qr/constants'
import { makePass, scanLabCode, type StudentScanProblem } from '@/lib/lab-qr/client/flows'
import { loadPassEntries, type PassEntry } from '@/lib/lab-qr/client/session'
import { useDevice } from './device-context'
import { cardClass, CopyButton, inputClass, Notice, QrImage, ScanInput } from './parts'

const PROBLEMS: Record<StudentScanProblem, string> = {
  'not-a-code': 'That is not a lab code. Scan the code shown at the lab desk.',
  forged: 'That code was not made by lab staff. Ask the assistant to show their code again.',
  expired: 'That code has expired. Codes change every 30 seconds, so scan the one on the screen now.',
  'wrong-lab': 'That code is for a different lab.',
  'wrong-action': 'That desk code is for the other action. Ask the assistant to switch it, or change your choice above.',
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const range = (a: string, b: string) => `${timeFmt.format(new Date(a))} to ${new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(b))}`

export function PassPanel() {
  const { store, userId, device, outbox, syncNow, probeOffline, online, outboxVersion } = useDevice()
  const [passes, setPasses] = useState<PassEntry[] | null>(null)
  const [source, setSource] = useState<'network' | 'cache' | 'none'>('none')
  const [selected, setSelected] = useState<string | null>(null)
  const [action, setAction] = useState<Action>('in')
  const [token, setToken] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [message, setMessage] = useState<{ tone: 'good' | 'warn' | 'bad' | 'info'; text: string } | null>(null)
  const [checks, setChecks] = useState<Record<string, { in: string; out: string; reviewPending: boolean }>>({})
  const [pending, setPending] = useState(0)

  const reload = useCallback(async () => {
    const loaded = await loadPassEntries(store, userId, fetch)
    setPasses(loaded.entries)
    setSource(loaded.source)
    setChecks(Object.fromEntries(loaded.entries.map((p) => [p.bookingId, p.checks])))
    setSelected((current) => current ?? loaded.entries[0]?.bookingId ?? null)
  }, [store, userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the cache and the network on mount
    void reload()
  }, [reload, online])

  // rotate the pass at every 30 second boundary and whenever the choice changes
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    const make = async () => {
      const now = nowMs()
      const next = await makePass(device, selected, action, now)
      if (cancelled) return
      setToken(next)
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
  }, [device, selected, action])

  // while online, learn from the server when the lab has scanned this pass
  useEffect(() => {
    if (!selected || !online) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/lab-attendance/bookings/${selected}/checks`, { credentials: 'same-origin', cache: 'no-store' })
        if (!res.ok || cancelled) return
        const body = (await res.json()) as { checks: { in: string; out: string; reviewPending: boolean } }
        setChecks((c) => ({ ...c, [selected]: body.checks }))
      } catch {
        // offline: keep what we have
      }
    }
    void poll()
    const timer = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [selected, online])

  useEffect(() => {
    void outbox.status().then((s) => setPending(s.pending))
  }, [outbox, outboxVersion])

  const current = passes?.find((p) => p.bookingId === selected) ?? null
  const state = current ? (checks[current.bookingId]?.[action] ?? 'none') : 'none'
  const reviewPending = current ? checks[current.bookingId]?.reviewPending : false

  async function onLabCode(text: string) {
    if (!current) return
    const at = nowMs()
    const offline = await probeOffline()
    const res = await scanLabCode({ scanned: text, booking: { id: current.bookingId, labId: current.labId }, staffKeys: current.staffKeys, action, device, outbox, nowMs: at, offline })
    if (!res.ok) {
      setMessage({ tone: 'bad', text: PROBLEMS[res.problem] })
      return
    }
    setMessage({ tone: 'info', text: offline ? 'Scan saved on this device. It will be sent when you are back online.' : 'Scan saved. Sending it now.' })
    await syncNow()
    await reload()
  }

  if (passes === null) return <p role="status">Loading your passes.</p>
  if (!current) {
    return (
      <div className={cardClass}>
        <h2 className="text-[length:var(--text-heading)] font-medium">No pass to show</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">
          You have no approved lab booking that is running now or starts in the next day.
          {source === 'cache' ? ' This list was saved on this device the last time you were online.' : ''}
          {source === 'none' && !online ? ' Connect once to load your bookings.' : ''}
        </p>
        <p className="mt-2">
          <Link className="font-semibold text-[var(--color-signal)] underline underline-offset-4" href="/dashboard/lab-booking">
            Request lab time
          </Link>
        </p>
      </div>
    )
  }

  const stateText =
    state === 'verified'
      ? `Verified: the lab and your device both recorded your ${action === 'in' ? 'check in' : 'check out'}.`
      : state === 'partial'
        ? 'Recorded by one side. Waiting for the other half before it counts as verified.'
        : 'Not recorded yet.'

  return (
    <div className="space-y-6">
      <section className={cardClass} aria-labelledby="pass-heading">
        <h2 id="pass-heading" className="text-[length:var(--text-heading)] font-medium">
          Your pass
        </h2>
        {passes.length > 1 && (
          <div className="mt-3">
            <label htmlFor="booking" className="block text-[length:var(--text-small)] font-semibold">
              Booking
            </label>
            <select id="booking" className={inputClass} value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}>
              {passes.map((p) => (
                <option key={p.bookingId} value={p.bookingId}>
                  {p.labName}, {range(p.startsAt, p.endsAt)}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="mt-3 font-semibold">{current.labName}</p>
        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{range(current.startsAt, current.endsAt)}</p>

        <fieldset className="mt-4">
          <legend className="text-[length:var(--text-small)] font-semibold">What are you doing?</legend>
          <div className="mt-2 flex gap-3">
            {(['in', 'out'] as const).map((a) => (
              <label key={a} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-4">
                <input type="radio" name="action" value={a} checked={action === a} onChange={() => setAction(a)} />
                {a === 'in' ? 'Check in' : 'Check out'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          {token ? <QrImage text={token} label={`Your ${action === 'in' ? 'check in' : 'check out'} pass for ${current.labName}. Show it to the lab assistant.`} /> : <p>Preparing your pass.</p>}
          <p className="mt-2 text-center text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Changes in {secondsLeft} seconds. A screenshot stops working after about a minute.</p>
        </div>

        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Pass as text, for a screen reader or if the code will not scan</summary>
          <p className="mt-2 text-[length:var(--text-small)]">The assistant can paste this text into their scan screen.</p>
          <textarea readOnly rows={4} value={token} aria-label="Pass code text" className={`${inputClass} mt-2 py-2 font-mono`} />
          <div className="mt-2">
            <CopyButton text={token} label="Copy pass text" />
          </div>
        </details>
      </section>

      <section className={cardClass} aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-[length:var(--text-heading)] font-medium">
          Status
        </h2>
        <div className="mt-2 space-y-2">
          <Notice tone={state === 'verified' ? 'good' : 'info'}>{stateText}</Notice>
          {reviewPending && <Notice tone="warn">One scan is waiting for the lab head to review it.</Notice>}
          {pending > 0 && <Notice tone="warn">{pending} scan{pending === 1 ? '' : 's'} saved on this device and not sent yet. They do not count until they are sent.</Notice>}
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      </section>

      <section className={cardClass} aria-labelledby="scan-heading">
        <h2 id="scan-heading" className="text-[length:var(--text-heading)] font-medium">
          Scan the lab code
        </h2>
        <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          After the assistant has scanned your pass, scan the code on the lab desk. Both are needed for a verified {action === 'in' ? 'check in' : 'check out'}.
        </p>
        <div className="mt-3">
          <ScanInput id="lab-code" label="Or paste the lab code text" help="Ask the assistant to read or share the lab code text if the camera will not work." cameraLabel="Camera view for scanning the lab desk code" onCode={(text) => void onLabCode(text)} />
        </div>
      </section>
    </div>
  )
}
