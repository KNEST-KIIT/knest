import { NextResponse } from 'next/server'
import { labRoute, readJson, respond } from '@/server/labs/http'
import { markAttendance } from '@/server/labs/service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return labRoute(async () => {
    const { id } = await params
    const body = await readJson(request)
    if (body?.outcome !== 'attended' && body?.outcome !== 'no_show') return NextResponse.json({ error: 'Choose attended or no-show.' }, { status: 400 })
    return respond(await markAttendance(id, body.outcome, typeof body.reason === 'string' ? body.reason : null))
  })
}
