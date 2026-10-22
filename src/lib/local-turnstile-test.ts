/** Cloudflare's public dummy token, limited to its dummy site key on loopback. */
export function localTurnstileTestToken(siteKey: string, hostname: string): string | null {
  const local = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname.endsWith('.localhost')
  return local && siteKey === '1x00000000000000000000AA' ? 'XXXX.DUMMY.TOKEN.XXXX' : null
}
