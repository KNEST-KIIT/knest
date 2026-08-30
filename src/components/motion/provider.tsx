'use client'

import { MotionConfig } from 'motion/react'
import { transition } from '@/lib/motion'

/**
 * Wraps the whole app so reduced-motion is handled in exactly one place.
 *
 * `reducedMotion="user"` makes Motion read the OS setting and strip transform
 * and layout animation from every animation in the tree, while leaving
 * opacity alone — so a section that would have risen into view simply fades
 * in, and nothing is left invisible. This matters because the global
 * `prefers-reduced-motion` rule in globals.css only reaches CSS animations
 * and transitions; it has no effect on anything Motion drives through
 * inline styles, which after this change is most of the interesting motion
 * in the app.
 *
 * The default transition is set here too, so a bare `animate` prop anywhere
 * in the app lands on the system's curve rather than Motion's built-in one.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={transition.base}>
      {children}
    </MotionConfig>
  )
}
