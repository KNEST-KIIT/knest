import { getPassContext } from '@/server/labs/attendance-qr'
import { qrRoute, respondQr } from '@/server/labs/qr-http'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return qrRoute(async () => {
    const { id } = await params
    return respondQr(await getPassContext(id))
  })
}
