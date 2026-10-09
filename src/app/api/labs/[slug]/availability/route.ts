import { NextResponse } from 'next/server'
import { requireUserOrThrow } from '@/server/auth/guards'
import { labRoute } from '@/server/labs/http'
import { isValidDateString } from '@/server/labs/rules'
import { getAvailability } from '@/server/labs/service'

/** Free and busy slots on one date. Signed-in members only; no booker is ever named. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return labRoute(async () => {
    await requireUserOrThrow()
    const { slug } = await params
    const date = new URL(request.url).searchParams.get('date') ?? ''
    if (!isValidDateString(date)) return NextResponse.json({ error: 'Give a date as YYYY-MM-DD.' }, { status: 400 })
    const slots = await getAvailability(slug, date)
    if (slots === null) return NextResponse.json({ error: 'That lab doesn’t exist.' }, { status: 404 })
    return NextResponse.json({ date, slots })
  })
}
