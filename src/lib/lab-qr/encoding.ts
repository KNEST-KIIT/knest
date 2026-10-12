/** base64url without padding, and UTF-8, for the QR protocol. Works in browsers and Node. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i]! << 16
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]!
  }
  return out
}

/** Returns null for anything that is not canonical unpadded base64url. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null
  const values: number[] = []
  for (const ch of text) values.push(ALPHABET.indexOf(ch))
  const out: number[] = []
  for (let i = 0; i < values.length; i += 4) {
    const a = values[i]!
    const b = values[i + 1]!
    const c = values[i + 2]
    const d = values[i + 3]
    const n = (a << 18) | (b << 12) | ((c ?? 0) << 6) | (d ?? 0)
    out.push((n >> 16) & 255)
    if (c !== undefined) out.push((n >> 8) & 255)
    if (d !== undefined) out.push(n & 255)
  }
  const bytes = Uint8Array.from(out)
  // Reject non-canonical encodings (stray low bits) so one byte string has one text form.
  return toBase64Url(bytes) === text ? bytes : null
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)
export const fromUtf8 = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes)

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
