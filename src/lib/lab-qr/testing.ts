import { exportPublicKeyRaw, generateDeviceKeyPair, keyIdFor } from './keys'
import type { BookingFacts, KeyRecord, LabRole, Lookups } from './decide'

/**
 * Test fixtures for the attendance protocol: a fake "device" with a real WebCrypto key pair and an
 * in-memory directory that implements the server's lookups. Used by unit tests and by integration
 * tests that need to act as a phone. Not imported by any production code.
 */

export type TestDevice = {
  userId: string
  keyId: string
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyRaw: Uint8Array
}

export async function newDevice(userId: string): Promise<TestDevice> {
  const pair = await generateDeviceKeyPair()
  const publicKeyRaw = await exportPublicKeyRaw(pair.publicKey)
  return { userId, keyId: await keyIdFor(publicKeyRaw), privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyRaw }
}

export class TestDirectory implements Lookups {
  keys = new Map<string, KeyRecord>()
  bookings = new Map<string, BookingFacts>()
  roles = new Map<string, LabRole>()

  addDevice(device: TestDevice, revokedAtMs: number | null = null): void {
    this.keys.set(device.keyId, { userId: device.userId, publicKey: device.publicKey, revokedAtMs })
  }
  addBooking(booking: BookingFacts): void {
    this.bookings.set(booking.id, booking)
  }
  setRole(userId: string, labId: string, role: LabRole): void {
    this.roles.set(`${userId}:${labId}`, role)
  }
  revoke(keyId: string, atMs: number): void {
    const record = this.keys.get(keyId)
    if (record) this.keys.set(keyId, { ...record, revokedAtMs: atMs })
  }

  async key(keyId: string) {
    return this.keys.get(keyId) ?? null
  }
  async booking(id: string) {
    return this.bookings.get(id) ?? null
  }
  async labRole(userId: string, labId: string) {
    return this.roles.get(`${userId}:${labId}`) ?? null
  }
}
