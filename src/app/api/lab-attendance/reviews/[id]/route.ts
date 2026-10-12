import { NextResponse } from 'next/server'
import { decideReview } from '@/server/labs/attendance-qr'
import { qrRoute, readJsonBody, respondQr } from '@/server/labs/qr-http'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return qrRoute(async () => {
    const { id } = await params
    const body = await readJsonBody(request)
    if (typeof body?.approve !== 'boolean') return NextResponse.json({ error: 'Choose approve or decline.' }, { status: 400 })
    return respondQr(await decideReview(id, body.approve, body.note))
  })
}
