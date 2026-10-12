import { revokeDeviceKey } from '@/server/labs/attendance-qr'
import { qrRoute, readJsonBody, respondQr } from '@/server/labs/qr-http'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return qrRoute(async () => {
    const { id } = await params
    const body = await readJsonBody(request)
    return respondQr(await revokeDeviceKey(id, body?.reason))
  })
}
