import { NextResponse } from 'next/server'
import { labRoute, readJson, respond } from '@/server/labs/http'
import { decideBooking, type Decision } from '@/server/labs/service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return labRoute(async () => {
    const { id } = await params
    const body = (await readJson(request)) as Decision | null
    if (!body || typeof body !== 'object' || !['approve', 'reject', 'propose'].includes((body as { action?: string }).action ?? '')) {
      return NextResponse.json({ error: 'Choose approve, reject or propose.' }, { status: 400 })
    }
    return respond(await decideBooking(id, body))
  })
}
