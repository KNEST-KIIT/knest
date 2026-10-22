'use client'

import { useEffect, useRef, useState } from 'react'
import { useClientReady } from '@/lib/use-client-ready'
import { localTurnstileTestToken } from '@/lib/local-turnstile-test'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptLoading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      script.remove()
      scriptLoading = null
      reject(new Error('Turnstile failed to load'))
    }
    const timeout = setTimeout(fail, 15_000)
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => { clearTimeout(timeout); resolve() }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return scriptLoading
}

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured (local
 * development). A token is single-use, so after a form submit that fails, bump
 * `resetSignal` to get a fresh challenge.
 */
export function TurnstileWidget({
  siteKey,
  onToken,
  resetSignal = 0,
  action,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  resetSignal?: number
  action?: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const callback = useRef(onToken)
  const ready = useClientReady()
  const testToken = ready ? localTurnstileTestToken(siteKey, window.location.hostname) : null
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Keep the latest handler without re-rendering the widget (refs are written in effects, not during render).
  useEffect(() => {
    callback.current = onToken
  })

  useEffect(() => {
    if (!siteKey || !ready) return
    if (testToken) {
      callback.current(testToken)
      return
    }
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current) return
        if (!window.turnstile) throw new Error('Verification unavailable')
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => callback.current(token),
          'expired-callback': () => callback.current(null),
          'error-callback': () => { callback.current(null); setFailed(true) },
        })
      })
      .catch(() => { if (!cancelled) { callback.current(null); setFailed(true) } })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey, action, attempt, testToken, ready])

  useEffect(() => {
    if (resetSignal > 0 && testToken) callback.current(testToken)
    else if (resetSignal > 0 && widgetId.current) window.turnstile?.reset(widgetId.current)
  }, [resetSignal, testToken])

  if (!siteKey) return null
  return <div role="group" aria-label="Human verification">
    {testToken ? <p role="status" className="text-xs text-[var(--color-ink-muted)]">Local test verification ready.</p> : <div ref={container} className="min-h-8.125" />}
    {failed && !testToken && <div role="alert" className="mt-2 text-sm text-[var(--color-critical)]">
      <p>Verification couldn’t load. Check your connection and try again.</p>
      <button type="button" className="mt-2 underline underline-offset-4" onClick={() => {
        callback.current(null)
        setFailed(false)
        scriptLoading = null
        setAttempt((value) => value + 1)
      }}>Retry verification</button>
    </div>}
  </div>
}
