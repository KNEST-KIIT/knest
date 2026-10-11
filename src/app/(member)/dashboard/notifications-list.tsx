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
export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter()
  const [items, setItems] = useState(notifications)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unreadCount = items.filter((n) => !n.readAt).length

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
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
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

      <ul className="mt-4 flex flex-col divide-y divide-[var(--color-line)]">
        {items.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-4 py-3">
            <div>
              {n.href ? (
                <Link href={n.href} className="font-medium hover:underline">
                  {n.title}
                </Link>
              ) : (
                <p className="font-medium">{n.title}</p>
              )}
              <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{n.body}</p>
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
    </div>
  )
}
