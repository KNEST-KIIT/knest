'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const ready = () => true
const notReady = () => false

/** Keep sensitive forms inert until their submit handler is attached. */
export function useClientReady() {
  return useSyncExternalStore(subscribe, ready, notReady)
}
