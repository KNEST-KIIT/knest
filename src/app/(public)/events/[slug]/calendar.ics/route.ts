import { buildIcs } from '@/lib/ics'
import { absoluteUrl, siteUrl } from '@/lib/site-url'
import { getEventBySlug } from '@/server/content/events'

/**
 * One published event as a calendar file. It reads through the same content
 * layer as the page (overrideAccess:false), so a draft event has no file.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })

  const host = new URL(siteUrl()).hostname
  const body = buildIcs({
    uid: `event-${event.id}@${host}`,
    title: event.title,
    summary: event.summary,
    location: event.location,
    url: absoluteUrl(`/events/${event.slug}`),
    startsAt: new Date(event.startsAt),
    endsAt: event.endsAt ? new Date(event.endsAt) : null,
    stamp: new Date(),
  })

  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${event.slug.replace(/[^a-z0-9-]/gi, '-')}.ics"`,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  })
}
