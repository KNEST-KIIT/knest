import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { newDevice } from '../testing'
import { createChallenge, createPass, parseToken } from '../tokens'
import { problemFromError } from './camera'
import { decodeFrame, encodeQr, qrPath, rasterize } from './qr'
import { IndexedDbDeviceStore, MemoryDeviceStore, type DeviceStore } from './store'

const BOOKING = '11111111-1111-4111-8111-111111111111'
const LAB = '33333333-3333-4333-8333-333333333333'

describe('QR drawing and decoding', () => {
  it('round-trips real passes and desk codes through the encoder and the JavaScript decoder', async () => {
    const d = await newDevice('u')
    for (let i = 0; i < 5; i++) {
      const pass = await createPass({ action: i % 2 ? 'in' : 'out', bookingId: BOOKING, keyId: d.keyId, nowMs: Date.now() + i * 31_000 }, d.privateKey)
      const code = await createChallenge({ mode: 'in', labId: LAB, keyId: d.keyId, nowMs: Date.now() }, d.privateKey)
      for (const text of [pass, code]) {
        const image = rasterize(encodeQr(text), 4)
        expect(decodeFrame(image.data, image.width, image.height)).toBe(text)
      }
      expect(parseToken(pass, 'pass')).not.toBeNull()
    }
  })

  it('decodes at a small scale, as a camera would see a distant screen', async () => {
    const d = await newDevice('u')
    const pass = await createPass({ action: 'in', bookingId: BOOKING, keyId: d.keyId, nowMs: Date.now() }, d.privateKey)
    const image = rasterize(encodeQr(pass), 3)
    expect(decodeFrame(image.data, image.width, image.height)).toBe(pass)
  })

  it('returns null for a frame with no code', () => {
    expect(decodeFrame(new Uint8ClampedArray(64 * 64 * 4).fill(255), 64, 64)).toBeNull()
  })

  it('draws a path inside its view box', async () => {
    const d = await newDevice('u')
    const m = encodeQr(await createPass({ action: 'in', bookingId: BOOKING, keyId: d.keyId, nowMs: 1_000_000 }, d.privateKey))
    const { path, viewBox } = qrPath(m)
    expect(viewBox).toBe(`0 0 ${m.size + 8} ${m.size + 8}`)
    expect(path.startsWith('M')).toBe(true)
  })
})

describe('camera problems', () => {
  it('map browser errors to a reason the page can explain', () => {
    expect(problemFromError({ name: 'NotAllowedError' })).toBe('denied')
    expect(problemFromError({ name: 'NotFoundError' })).toBe('no-camera')
    expect(problemFromError({ name: 'NotReadableError' })).toBe('busy')
    expect(problemFromError(new Error('x'))).toBe('unknown')
    expect(problemFromError(null)).toBe('unknown')
  })
})

async function exercise(store: DeviceStore) {
  await store.put('outbox', 'a', { id: 'a', n: 1 })
  await store.put('outbox', 'b', { id: 'b', n: 2 })
  expect(await store.get('outbox', 'a')).toEqual({ id: 'a', n: 1 })
  expect((await store.all<{ id: string }>('outbox')).map((x) => x.id).sort()).toEqual(['a', 'b'])
  await store.put('outbox', 'a', { id: 'a', n: 9 })
  expect(await store.get('outbox', 'a')).toEqual({ id: 'a', n: 9 })
  await store.delete('outbox', 'a')
  expect(await store.get('outbox', 'a')).toBeUndefined()
  await store.clear('outbox')
  expect(await store.all('outbox')).toEqual([])
  expect(await store.get('keys', 'nobody')).toBeUndefined()
}

describe('device stores', () => {
  it('memory store behaves', async () => exercise(new MemoryDeviceStore()))
  it('IndexedDB store behaves the same way', async () => exercise(new IndexedDbDeviceStore(new IDBFactory())))

  it('IndexedDB keeps a non-extractable key handle usable after a reopen', async () => {
    const factory = new IDBFactory()
    const first = new IndexedDbDeviceStore(factory)
    const d = await newDevice('u')
    await first.put('keys', 'u', { keyId: d.keyId, privateKey: d.privateKey, publicKey: d.publicKey })
    const second = new IndexedDbDeviceStore(factory) // a fresh connection, as after closing the app
    const got = await second.get<{ keyId: string; privateKey: CryptoKey }>('keys', 'u')
    expect(got?.keyId).toBe(d.keyId)
    expect(got?.privateKey.extractable).toBe(false)
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, got!.privateKey, new Uint8Array([1, 2, 3]))
    expect(sig.byteLength).toBe(64)
  })
})
