import { requireUserOrThrow } from '@/server/auth/guards'
import { labRoute, readJson, respond } from '@/server/labs/http'
import { requestBooking } from '@/server/labs/service'
import { captchaFailure } from '@/server/security/captcha'
import { limitByUser } from '@/server/security/route-limits'

/** A member asks to book a lab. Human check, rate limit, then every booking rule on the server. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return labRoute(async () => {
    await requireUserOrThrow()
    const limited = await limitByUser('labRequest')
    if (limited) return limited
    const body = await readJson(request)
    const captcha = await captchaFailure(request, body)
    if (captcha) return captcha
    const { slug } = await params
    return respond(await requestBooking(slug, body), 201)
  })
}
