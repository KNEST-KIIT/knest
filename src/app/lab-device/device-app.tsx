'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { StoredDeviceKey } from '@/lib/lab-qr/client/device-key'
import { fetchSender, Outbox, type OutboxStatus } from '@/lib/lab-qr/client/outbox'
import { ensureKey, resolveIdentity, type Identity } from '@/lib/lab-qr/client/session'
import { openDeviceStore } from '@/lib/lab-qr/client/store'
import { UNSYNCED_WARN_MS } from '@/lib/lab-qr/constants'
import { DeviceContext, type DeviceContextValue } from './device-context'
import { PassPanel } from './pass-panel'
import { ScanPanel } from './scan-panel'
import { buttonClass, cardClass, Notice, primaryButtonClass } from './parts'

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'no-identity' }
  | { kind: 'no-key'; identity: Identity }
  | { kind: 'ready'; identity: Identity; device: StoredDeviceKey }

type Tab = 'pass' | 'scan'

/**
 * The lab attendance app: one public, static page. It holds no personal data in its HTML, so the
 * service worker may cache it; everything personal is read from this device's own storage, which is
 * filled while online, bounded to 24 hours, and wiped on log out.
 */
export function DeviceApp() {
  const { store, persistent } = useMemo(() => openDeviceStore(), [])
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [tab, setTab] = useState<Tab>('pass')
  const [status, setStatus] = useState<OutboxStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [outboxVersion, setOutboxVersion] = useState(0)
  const [lastSyncProblem, setLastSyncProblem] = useState<string | null>(null)

  // Register the service worker once, on this page only (scope /lab-device).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/lab-device', updateViaCache: 'none' })
      .then(async () => {
        const reg = await navigator.serviceWorker.ready
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.includes('/_next/static/'))
        reg.active?.postMessage({ type: 'precache', urls })
      })
      .catch(() => undefined)
  }, [])

  const boot = useCallback(async () => {
    const result = await resolveIdentity(store, fetch)
    if (result.signedOut) return setPhase({ kind: 'signed-out' })
    if (!result.identity) return setPhase({ kind: 'no-identity' })
    const device = await ensureKey(store, result.identity.userId, fetch, navigator.userAgent.slice(0, 60))
    if (!device.registered && !result.offline) return setPhase({ kind: 'no-key', identity: result.identity })
    setPhase({ kind: 'ready', identity: result.identity, device })
  }, [store])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads identity and key on mount
    void boot()
  }, [boot])

  const userId = phase.kind === 'ready' ? phase.identity.userId : null
  const outbox = useMemo(() => (userId ? new Outbox(store, userId) : null), [store, userId])

  const refreshStatus = useCallback(async () => {
    if (!outbox) return
    setStatus(await outbox.status())
    setOutboxVersion((v) => v + 1)
  }, [outbox])

  const syncNow = useCallback(async () => {
    if (!outbox) return
    setSyncing(true)
    const sent = await outbox.flush(fetchSender())
    setLastSyncProblem(sent.signedOut ? 'You were signed out. Sign in again to send saved scans.' : sent.remaining > 0 ? 'Some scans could not be sent yet. They stay saved and will be retried.' : null)
    setSyncing(false)
    await refreshStatus()
  }, [outbox, refreshStatus])

  // sync on open, when the connection returns, and when the page becomes visible again
  useEffect(() => {
    if (!outbox) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial read of the outbox
    void refreshStatus()
    if (online) void syncNow()
    const onVisible = () => document.visibilityState === 'visible' && navigator.onLine && void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [outbox, online, refreshStatus, syncNow])

  // Background Sync where the browser has it (not iOS): ask once there is something unsent.
  useEffect(() => {
    if (!status || status.pending === 0) return
    navigator.serviceWorker?.ready
      .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register('knest-lab-outbox'))
      .catch(() => undefined)
  }, [status])

  const probeOffline = useCallback(async () => {
    if (!navigator.onLine) return true
    try {
      const res = await fetch('/api/lab-attendance/me', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(1500) })
      return !res.ok && res.status !== 401
    } catch {
      return true
    }
  }, [])

  if (phase.kind === 'loading') return <p role="status">Opening the lab attendance screen.</p>

  if (phase.kind === 'signed-out') {
    return (
      <div className={cardClass}>
        <h2 className="text-[length:var(--text-heading)] font-medium">Sign in to continue</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">Sign in with your KNEST account to show your lab pass or scan for a lab.</p>
        <p className="mt-4">
          <a className={primaryButtonClass} href="/login?next=%2Flab-device">
            Sign in
          </a>
        </p>
      </div>
    )
  }

  if (phase.kind === 'no-identity') {
    return (
      <div className={cardClass}>
        <h2 className="text-[length:var(--text-heading)] font-medium">Connect to get started</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">This device has not been set up yet. Connect to the internet and open this screen once. After that it works without a connection.</p>
        <p className="mt-4">
          <button type="button" className={buttonClass} onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
      </div>
    )
  }

  if (phase.kind === 'no-key') {
    return (
      <div className={cardClass}>
        <h2 className="text-[length:var(--text-heading)] font-medium">This device could not be set up</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">We could not register this device’s key with the server. Check your connection and try again.</p>
        <p className="mt-4">
          <button type="button" className={primaryButtonClass} onClick={() => void boot()}>
            Try again
          </button>
        </p>
      </div>
    )
  }

  const value: DeviceContextValue = { store, userId: phase.identity.userId, device: phase.device, outbox: outbox!, syncNow, probeOffline, online, outboxVersion }
  const showScan = phase.identity.isStaff

  return (
    <DeviceContext.Provider value={value}>
      <div className="space-y-6">
        <section aria-label="Connection and saved scans" className="space-y-2">
          <p className="text-[length:var(--text-small)]">
            Signed in as <strong>{phase.identity.name}</strong>. {online ? 'Online.' : 'Offline: scans are saved on this device and sent when you reconnect.'}
          </p>
          {!persistent && <Notice tone="warn">This browser will not keep your device key between visits. You will need to set up again each time.</Notice>}
          {status && status.pending > 0 && (
            <Notice tone={status.stale ? 'bad' : 'warn'}>
              {status.pending} scan{status.pending === 1 ? '' : 's'} saved on this device and not sent yet.
              {status.stale ? ` The oldest is over ${Math.round(UNSYNCED_WARN_MS / 3_600_000)} hour old. Connect soon so it can count.` : ' They do not count until they are sent.'}
            </Notice>
          )}
          {lastSyncProblem && <Notice tone="warn">{lastSyncProblem}</Notice>}
          <button type="button" className={buttonClass} onClick={() => void syncNow()} disabled={syncing || !online} aria-busy={syncing}>
            {syncing ? 'Sending' : 'Send saved scans now'}
          </button>
        </section>

        {showScan && (
          <div role="tablist" aria-label="Lab attendance" className="flex gap-2">
            {(['pass', 'scan'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`panel-${t}`}
                className={tab === t ? primaryButtonClass : buttonClass}
                onClick={() => setTab(t)}
              >
                {t === 'pass' ? 'My pass' : 'Scan for a lab'}
              </button>
            ))}
          </div>
        )}
        <div role={showScan ? 'tabpanel' : undefined} id={`panel-${tab}`} aria-labelledby={showScan ? `tab-${tab}` : undefined}>
          {showScan && tab === 'scan' ? <ScanPanel /> : <PassPanel />}
        </div>
      </div>
    </DeviceContext.Provider>
  )
}
