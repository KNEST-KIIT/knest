'use client'

import { createContext, useContext } from 'react'
import type { StoredDeviceKey } from '@/lib/lab-qr/client/device-key'
import type { Outbox } from '@/lib/lab-qr/client/outbox'
import type { DeviceStore } from '@/lib/lab-qr/client/store'

export type DeviceContextValue = {
  store: DeviceStore
  userId: string
  device: StoredDeviceKey
  outbox: Outbox
  /** Sends everything queued. Safe to call at any time. */
  syncNow: () => Promise<void>
  /** True when the device cannot reach the server right now. Decided at the moment of a scan and signed into it. */
  probeOffline: () => Promise<boolean>
  online: boolean
  /** Bumped whenever the outbox changes so panels re-read it. */
  outboxVersion: number
}

export const DeviceContext = createContext<DeviceContextValue | null>(null)

export function useDevice(): DeviceContextValue {
  const value = useContext(DeviceContext)
  if (!value) throw new Error('useDevice must be used inside the device app')
  return value
}
