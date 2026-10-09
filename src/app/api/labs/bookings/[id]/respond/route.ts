import { NextResponse } from 'next/server'
import { labRoute, readJson, respond } from '@/server/labs/http'
import { respondToProposal } from '@/server/labs/service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return labRoute(async () => {
    const { id } = await params
    const body = await readJson(request)
    if (typeof body?.accept !== 'boolean') return NextResponse.json({ error: 'Say whether you accept.' }, { status: 400 })
    return respond(await respondToProposal(id, body.accept))
  })
}
