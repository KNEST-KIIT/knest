import { fromBase64Url, toBase64Url } from './encoding'

/**
 * Device keys for lab attendance. ECDSA over P-256 with SHA-256, through WebCrypto, so the same code
 * runs in a browser and on the server. A signature is the 64-byte IEEE P1363 form (r then s), which
 * is what WebCrypto produces and verifies; no DER handling is needed anywhere.
 *
 * The private key is generated non-extractable: page script can ask it to sign but can never read it
 * (threat model T9). Only the 65-byte uncompressed public key leaves the device.
 */

const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const

/** A fixed ArrayBuffer copy: TypeScript 5.7+ distinguishes ArrayBuffer-backed views from the rest. */
const toBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer

export const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/
export const RAW_PUBLIC_KEY_LENGTH = 65

export async function generateDeviceKeyPair(subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<CryptoKeyPair> {
  return subtle.generateKey(KEY_ALGORITHM, false, ['sign', 'verify']) as Promise<CryptoKeyPair>
}

/** The uncompressed public point, 0x04 || X || Y. */
export async function exportPublicKeyRaw(publicKey: CryptoKey, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<Uint8Array> {
  return new Uint8Array(await subtle.exportKey('raw', publicKey))
}

/** Rejects anything that is not a well-formed P-256 point; WebCrypto checks the point is on the curve. */
export async function importPublicKeyRaw(raw: Uint8Array, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<CryptoKey | null> {
  if (raw.length !== RAW_PUBLIC_KEY_LENGTH || raw[0] !== 0x04) return null
  try {
    return await subtle.importKey('raw', toBuffer(raw), KEY_ALGORITHM, true, ['verify'])
  } catch {
    return null
  }
}

/** Key id: the first 12 bytes of SHA-256 of the raw public key, as 16 base64url characters. */
export async function keyIdFor(raw: Uint8Array, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', toBuffer(raw)))
  return toBase64Url(digest.slice(0, 12))
}

export async function signBytes(privateKey: CryptoKey, data: Uint8Array, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<Uint8Array> {
  return new Uint8Array(await subtle.sign(SIGN_ALGORITHM, privateKey, toBuffer(data)))
}

export async function verifyBytes(
  publicKey: CryptoKey,
  data: Uint8Array,
  signature: Uint8Array,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<boolean> {
  if (signature.length !== 64) return false
  try {
    return await subtle.verify(SIGN_ALGORITHM, publicKey, toBuffer(signature), toBuffer(data))
  } catch {
    return false
  }
}

/** Random nonce: 12 bytes, 16 base64url characters. */
export function randomNonce(): string {
  return toBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(12)))
}

export function decodePublicKey(text: string): Uint8Array | null {
  const bytes = fromBase64Url(text)
  return bytes && bytes.length === RAW_PUBLIC_KEY_LENGTH ? bytes : null
}
