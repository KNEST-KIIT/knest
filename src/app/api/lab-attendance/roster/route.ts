import { getRoster } from '@/server/labs/attendance-qr'
import { qrRoute, respondQr } from '@/server/labs/qr-http'

export async function GET() {
  return qrRoute(async () => respondQr(await getRoster()))
}
