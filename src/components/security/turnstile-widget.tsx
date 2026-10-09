'use client'

import { useEffect, useRef } from 'react'

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
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoading = null
      reject(new Error('Turnstile failed to load'))
    }
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
  // Keep the latest handler without re-rendering the widget (refs are written in effects, not during render).
  useEffect(() => {
    callback.current = onToken
  })

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => callback.current(token),
          'expired-callback': () => callback.current(null),
          'error-callback': () => callback.current(null),
        })
      })
      .catch(() => callback.current(null))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey, action])

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current) window.turnstile?.reset(widgetId.current)
  }, [resetSignal])

  if (!siteKey) return null
  return <div ref={container} role="group" aria-label="Human verification" className="min-h-[65px]" />
}
