import { labRoute, readJson, respond } from '@/server/labs/http'
import { cancelBooking } from '@/server/labs/service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return labRoute(async () => {
    const { id } = await params
    const body = await readJson(request)
    return respond(await cancelBooking(id, typeof body?.note === 'string' ? body.note : null))
  })
}
