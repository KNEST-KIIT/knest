'use client'

import { formRequest } from '@/lib/form-request'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heading, LiveRegion } from '@/components/ui'

type NotificationRow = {
  id: string
  title: string
  body: string
  href: string | null
  readAt: Date | null
  createdAt: Date
}

/**
 * The first UI in the app to read the notifications table (retrospective
 * §6). An item changes to read only after the server has confirmed it, and a
 * failure is said out loud: a list that shows "read" for something the server
 * still holds as unread would come back unread on the next load.
 */
export function cleanNotificationBody(body: string): string {
  return body
    .replace(/https?:\/\/[^\s)]+/gi, (rawUrl) => {
      const trailingPunctuation = rawUrl.match(/[.,;:!?]+$/)?.[0] || ''
      const cleanUrl = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation.length) : rawUrl
      try {
        const parsed = new URL(cleanUrl)
        const replacement = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : 'the portal'
        return `${replacement}${trailingPunctuation}`
      } catch {
        return `the portal${trailingPunctuation}`
      }
    })
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter()
  const [items, setItems] = useState(notifications)
  const [expanded, setExpanded] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unreadCount = items.filter((n) => !n.readAt).length
  const MAX_COMPACT = 2
  const visibleItems = expanded ? items : items.slice(0, MAX_COMPACT)

  async function markRead(id: string) {
    setPendingId(id)
    setError(null)
    const res = await formRequest(`/api/notifications/${id}/read`, { method: 'POST' })
    setPendingId(null)
    if (!res.ok) {
      setError(
        res.status === 401
          ? 'Your session has ended. Log in again to update your notifications.'
          : 'We couldn’t mark that as read. Check your connection and try again.',
      )
      return
    }
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)))
    router.refresh()
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <Heading as="h2" size="heading" uppercase={false}>
          Notifications
        </Heading>
        {unreadCount > 0 && (
          <span className="rounded-full bg-[var(--color-signal-wash)] px-2.5 py-0.5 text-[length:var(--text-micro)] font-semibold text-[var(--color-signal-deep)]">
            {unreadCount} unread
          </span>
        )}
      </div>
      <LiveRegion message={unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications read'} />

      {error && (
        <p role="alert" className="mt-3 text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}

      <ul className="mt-3 flex flex-col divide-y divide-[var(--color-line)]">
        {visibleItems.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {n.href ? (
                <Link href={n.href} className="font-medium hover:underline text-[var(--color-ink)]">
                  {n.title}
                </Link>
              ) : (
                <p className="font-medium text-[var(--color-ink)]">{n.title}</p>
              )}
              <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{cleanNotificationBody(n.body)}</p>
            </div>
            {!n.readAt && (
              <button
                type="button"
                onClick={() => markRead(n.id)}
                disabled={pendingId === n.id}
                className="shrink-0 text-[length:var(--text-small)] font-medium text-[var(--color-signal)] disabled:opacity-50"
              >
                {pendingId === n.id ? 'Marking…' : 'Mark read'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {items.length > MAX_COMPACT && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line)]/50 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[length:var(--text-small)] font-medium text-[var(--color-signal)] hover:underline"
          >
            {expanded ? 'Show fewer notifications' : `View all ${items.length} notifications`}
          </button>
        </div>
      )}
    </div>
  )
}
