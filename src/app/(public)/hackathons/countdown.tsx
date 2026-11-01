'use client'

import { useEffect, useState } from 'react'

type CountdownProps = {
  targetDate: string | Date
  label?: string
  endedLabel?: string
}

export function HackathonCountdown({
  targetDate,
  label = 'Time Remaining',
  endedLabel = 'Deadline Passed',
}: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    ended: boolean
  } | null>(null)

  useEffect(() => {
    const target = new Date(targetDate).getTime()

    function update() {
      const now = Date.now()
      const diff = target - now

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)

      setTimeLeft({ days, hours, minutes, seconds, ended: false })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)]/50 px-4 py-2">
        <span className="text-xs text-[var(--color-ink-muted)]">Loading timer...</span>
      </div>
    )
  }

  if (timeLeft.ended) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-caution)]/30 bg-[var(--color-caution)]/10 px-4 py-2">
        <span className="size-2 rounded-full bg-[var(--color-caution)]" />
        <span className="text-xs font-semibold text-[var(--color-caution)]">{endedLabel}</span>
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 shadow-xs">
      <div className="flex items-center justify-between gap-4 px-1">
        <span className="text-[length:var(--text-micro)] font-bold uppercase tracking-wider text-[var(--color-signal)]">
          {label}
        </span>
        <span className="flex items-center gap-1 text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
          <span className="size-1.5 rounded-full bg-[var(--color-positive)] animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="flex flex-col rounded-lg bg-[var(--color-paper-soft)]/70 px-2 py-1">
          <span className="font-mono text-base font-bold text-[var(--color-ink)]">
            {String(timeLeft.days).padStart(2, '0')}
          </span>
          <span className="text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-ink-muted)]">
            Days
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-[var(--color-paper-soft)]/70 px-2 py-1">
          <span className="font-mono text-base font-bold text-[var(--color-ink)]">
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span className="text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-ink-muted)]">
            Hours
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-[var(--color-paper-soft)]/70 px-2 py-1">
          <span className="font-mono text-base font-bold text-[var(--color-ink)]">
            {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span className="text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-ink-muted)]">
            Mins
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-[var(--color-paper-soft)]/70 px-2 py-1">
          <span className="font-mono text-base font-bold text-[var(--color-signal)]">
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-ink-muted)]">
            Secs
          </span>
        </div>
      </div>
    </div>
  )
}
