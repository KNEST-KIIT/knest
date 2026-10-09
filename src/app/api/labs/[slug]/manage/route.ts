import { NextResponse } from 'next/server'
import { labRoute, readJson, respond } from '@/server/labs/http'
import { addBlackout, addLabStaff, removeBlackout, removeLabStaff, setLabHours, updateLab } from '@/server/labs/manage'
import { getLabBySlug } from '@/server/labs/service'

/** One endpoint for everything a head or admin changes on a lab: { action, ...payload }. Authorisation is per lab, inside each function. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return labRoute(async () => {
    const { slug } = await params
    const found = await getLabBySlug(slug)
    const body = await readJson(request)
    if (!found || !body || typeof body.action !== 'string') return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    const labId = found.lab.id
    switch (body.action) {
      case 'update':
        return respond(await updateLab(labId, body.settings))
      case 'hours':
        return respond(await setLabHours(labId, body.windows))
      case 'blackout-add':
        return respond(await addBlackout(labId, body.blackout))
      case 'blackout-remove':
        return respond(await removeBlackout(labId, String(body.blackoutId ?? '')))
      case 'staff-add':
        return respond(await addLabStaff(labId, body.staff))
      case 'staff-remove':
        return respond(await removeLabStaff(labId, String(body.staffId ?? '')))
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
  })
}
