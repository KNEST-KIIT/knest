/**
 * Validates a post-login / post-signup return path (KN-22e).
 *
 * `next.startsWith('/')` accepts `//evil.com` and `/\evil.com`, which browsers
 * resolve to another origin. Only a same-origin absolute path is accepted here;
 * anything else returns null so the caller falls back to its own default.
 */
const BASE = 'http://knest.invalid'
const BACKSLASH = String.fromCharCode(92)

/** Control characters, space and DEL. Browsers strip tabs/newlines inside URLs. */
function hasControlOrSpace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

export function safeNext(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null
  // Must be an absolute path, not protocol-relative ("//") and with no
  // backslash anywhere: "/\evil.com" is read as "//evil.com" by browsers.
  if (raw[0] !== '/' || raw[1] === '/') return null
  if (raw.includes(BACKSLASH)) return null
  // "/<TAB>/evil.com" would become "//evil.com" once the browser strips the tab.
  if (hasControlOrSpace(raw)) return null

  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  return url.pathname + url.search + url.hash
}
