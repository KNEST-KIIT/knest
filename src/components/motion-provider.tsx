'use client'

import { MotionConfig } from 'framer-motion'

/** Honours the visitor's reduced-motion setting for every framer-motion animation (transforms and layout stop; fades remain). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
