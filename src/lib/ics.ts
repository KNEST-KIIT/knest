/**
 * A minimal RFC 5545 calendar file for a single event, so a visitor can add it
 * to their own calendar. Times are written in UTC, which every calendar app
 * converts to the viewer's zone; nothing here depends on the host's zone.
 */

export interface IcsEvent {
  uid: string
  title: string
  summary?: string | null
  location?: string | null
  url: string
  startsAt: Date
  /** When absent, the event is given a one hour length. */
  endsAt?: Date | null
  /** The time the file was produced, in UTC. Injected so output is deterministic. */
  stamp: Date
}

const DEFAULT_LENGTH_MS = 60 * 60 * 1000

function utc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Escapes a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')
}

/** Folds a content line to at most 75 octets, continuing with a leading space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  // The first line may hold 75 octets; continuation lines hold 74 plus the leading space.
  let limit = 75
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += char
    bytes += size
  }
  if (current) parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs(event: IcsEvent): string {
  const end = event.endsAt && event.endsAt.getTime() > event.startsAt.getTime()
    ? event.endsAt
    : new Date(event.startsAt.getTime() + DEFAULT_LENGTH_MS)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KNEST//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utc(event.stamp)}`,
    `DTSTART:${utc(event.startsAt)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.summary ? [`DESCRIPTION:${escapeIcsText(event.summary)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    `URL:${event.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
