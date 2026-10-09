import { labRoute, readJson, respond } from '@/server/labs/http'
import { createLab } from '@/server/labs/manage'

/** A lab administrator creates a lab. */
export async function POST(request: Request) {
  return labRoute(async () => respond(await createLab(await readJson(request)), 201))
}
