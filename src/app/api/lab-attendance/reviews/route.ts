import { NextResponse } from 'next/server'
import { listReviewQueue } from '@/server/labs/attendance-qr'
import { qrRoute } from '@/server/labs/qr-http'

export async function GET(request: Request) {
  return qrRoute(async () => {
    const labId = new URL(request.url).searchParams.get('labId')
    if (!labId) return NextResponse.json({ error: 'Say which lab.' }, { status: 400 })
    return NextResponse.json({ ok: true, events: await listReviewQueue(labId) }, { headers: { 'cache-control': 'no-store' } })
  })
}
