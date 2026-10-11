import { NextResponse } from 'next/server'
import { listMyDeviceKeys, registerDeviceKey } from '@/server/labs/attendance-qr'
import { qrRoute, readJsonBody, respondQr } from '@/server/labs/qr-http'

export async function GET() {
  return qrRoute(async () => NextResponse.json({ ok: true, keys: await listMyDeviceKeys() }, { headers: { 'cache-control': 'no-store' } }))
}

export async function POST(request: Request) {
  return qrRoute(async () => {
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Send the public key and its proof.' }, { status: 400 })
    return respondQr(await registerDeviceKey({ publicKey: body.publicKey, proof: body.proof, label: body.label }), 201)
  })
}
