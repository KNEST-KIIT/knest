import { exportPublicKeyRaw, generateDeviceKeyPair, keyIdFor } from '../keys'
import { toBase64Url } from '../encoding'
import { createRegistrationProof } from '../tokens'
import type { DeviceStore } from './store'

/**
 * The person's device key. Generated once per user per browser profile, non-extractable, kept in
 * IndexedDB as a CryptoKey handle (script can sign with it but cannot read it). The public half is
 * registered with the server with a proof of possession.
 *
 * If the browser evicts storage the key is gone: `loadDeviceKey` then returns null and the person
 * enrols again online. That is expected (T2), not an error to hide.
 */

export type StoredDeviceKey = {
  userId: string
  keyId: string
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyB64: string
  createdAt: number
  registered: boolean
}

export async function loadDeviceKey(store: DeviceStore, userId: string): Promise<StoredDeviceKey | null> {
  const record = await store.get<StoredDeviceKey>('keys', userId)
  return record && record.userId === userId ? record : null
}

export async function createDeviceKey(store: DeviceStore, userId: string, now = Date.now()): Promise<StoredDeviceKey> {
  const pair = await generateDeviceKeyPair()
  const raw = await exportPublicKeyRaw(pair.publicKey)
  const record: StoredDeviceKey = {
    userId,
    keyId: await keyIdFor(raw),
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyB64: toBase64Url(raw),
    createdAt: now,
    registered: false,
  }
  await store.put('keys', userId, record)
  return record
}

export type RegisterFn = (body: { publicKey: string; proof: string; label: string }) => Promise<boolean>

/** Ensures a registered key exists. Registration needs the network; when it cannot reach the server the key stays unregistered. */
export async function ensureDeviceKey(store: DeviceStore, userId: string, register: RegisterFn, label = '', now = Date.now()): Promise<StoredDeviceKey> {
  let key = (await loadDeviceKey(store, userId)) ?? (await createDeviceKey(store, userId, now))
  if (!key.registered) {
    const proof = await createRegistrationProof({ userId, keyId: key.keyId, nowMs: now }, key.privateKey)
    let ok = false
    try {
      ok = await register({ publicKey: key.publicKeyB64, proof, label })
    } catch {
      ok = false
    }
    if (ok) {
      key = { ...key, registered: true }
      await store.put('keys', userId, key)
    }
  }
  return key
}
