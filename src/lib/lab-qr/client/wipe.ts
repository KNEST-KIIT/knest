import { openDeviceStore } from './store'
import { wipeRoster } from './roster-cache'

/**
 * Called on log out: removes the cached roster and any Cache Storage the lab service worker made.
 * The outbox is left alone on purpose: unsent scan events belong to the person who signed them and
 * are sent when they next sign in; deleting them would silently lose attendance records (T6).
 */
export async function wipeLabDeviceCaches(): Promise<void> {
  try {
    await wipeRoster(openDeviceStore().store)
  } catch {
    // storage unavailable: nothing to wipe
  }
  try {
    if (typeof caches !== 'undefined') for (const name of await caches.keys()) if (name.startsWith('knest-lab-')) await caches.delete(name)
  } catch {
    // ignore
  }
  try {
    const reg = typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    reg?.active?.postMessage({ type: 'wipe' })
  } catch {
    // ignore
  }
}
