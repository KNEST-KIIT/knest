/**
 * Normalizes user-submitted URLs (prepends https:// if scheme is missing)
 * and strictly verifies that the protocol is http: or https:.
 */
export function sanitizeSubmissionUrl(url?: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(normalized)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch {
    return null
  }
  return null
}
