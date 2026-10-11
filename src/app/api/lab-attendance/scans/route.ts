import { NextResponse } from 'next/server'
import { submitScanBatch } from '@/server/labs/attendance-qr'
import { qrRoute, readJsonBody, respondQr } from '@/server/labs/qr-http'

export async function POST(request: Request) {
  return qrRoute(async () => {
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Send a batch of scan events.' }, { status: 400 })
    return respondQr(await submitScanBatch({ clientNowMs: body.clientNowMs, events: body.events }))
  })
}
