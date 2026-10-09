/** Display helpers for lab times, shared by server and client components. Everything is shown in India Standard Time. */

const TZ = 'Asia/Kolkata'
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ })
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "09:00" from minutes after midnight. */
export function minuteLabel(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const timeLabel = (instant: Date | string) => TIME.format(new Date(instant))

/** "Mon 12 Oct, 10:00 to 11:00 IST" */
export function rangeLabel(startsAt: Date | string, endsAt: Date | string): string {
  return `${DAY.format(new Date(startsAt))}, ${timeLabel(startsAt)} to ${timeLabel(endsAt)} IST`
}

/** Today's date in India as YYYY-MM-DD, for date inputs. */
export function todayIst(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10)
}

export const STATUS_LABELS: Record<string, string> = {
  requested: 'Waiting for the lab head',
  approved: 'Approved',
  rejected: 'Not approved',
  cancelled: 'Cancelled',
  alternative_proposed: 'Another time suggested',
  completed: 'Attended',
  no_show: 'No-show',
}
