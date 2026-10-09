/**
 * Cloudflare Turnstile, verified on the server (contract module 39: sign-up, sign-in,
 * password reset, application submit, booking request). Only the standalone widget
 * and the siteverify call are used; no Cloudflare DNS or CDN is involved.
 *
 * Fail closed: when a token is missing, rejected, or the verification service cannot be
 * reached, the request is refused. The one exception is a development machine with no
 * secret configured, so local work does not need a Cloudflare account.
 */

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'rejected' | 'unavailable' | 'not-configured' }

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type Env = { [name: string]: string | undefined }

/** The public site key, read at request time (never inlined at build, so one image serves any environment). */
export function turnstileSiteKey(env: Env = process.env): string {
  return env.TURNSTILE_SITE_KEY ?? ''
}

export async function verifyTurnstile(
  token: unknown,
  remoteIp: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY
  if (!secret) return env.NODE_ENV === 'production' ? { ok: false, reason: 'not-configured' } : { ok: true }

  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return { ok: false, reason: 'missing' }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)
    const response = await fetchImpl(env.TURNSTILE_VERIFY_URL || TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return { ok: false, reason: 'unavailable' }
    const result = (await response.json()) as { success?: boolean }
    return result.success === true ? { ok: true } : { ok: false, reason: 'rejected' }
  } catch {
    // Neither the token nor the secret is logged.
    return { ok: false, reason: 'unavailable' }
  }
}
