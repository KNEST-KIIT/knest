import Link from 'next/link'
import { Card } from '@/components/ui'
import { hasCapability, levelDefinition, levelRequiredFor } from '@/server/founders/levels'

/**
 * Where you stand, on every dashboard variant.
 *
 * Lives above the role-specific views rather than inside one of them: levels
 * and lab access are not a founder-only idea. A student at level 1 seeing the
 * ladder exists is how they learn there is something to move up, and the
 * `platformRole` that decides which view renders below is self-declared anyway.
 *
 * The lab link is shown to everyone and says what it needs. Hiding it would
 * make the capability invisible until the moment it is already granted, which
 * is the opposite of a ladder.
 */
export function Standing({
  level,
  manages,
}: {
  level: number
  /** Whether this account is named a manager of any bookable space. */
  manages: boolean
}) {
  const definition = levelDefinition(level)
  const canBook = hasCapability(level, 'book_lab')

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          Your level
        </p>
        <p className="mt-1 font-medium">
          {definition.level} · {definition.label}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[length:var(--text-small)]">
        <Link href="/dashboard/level" className="flex h-11 items-center underline underline-offset-4">
          The ladder, and how to move up
        </Link>
        <Link href="/dashboard/labs" className="flex h-11 items-center underline underline-offset-4">
          {canBook ? 'Book a lab' : `Labs — opens at level ${levelRequiredFor('book_lab')}`}
        </Link>
        {manages && (
          <Link
            href="/dashboard/labs/manage"
            className="flex h-11 items-center underline underline-offset-4"
          >
            Requests waiting on you
          </Link>
        )}
      </div>
    </Card>
  )
}
