'use client'

import { MotionConfig } from 'framer-motion'

/**
 * One place that makes every animation in the app respect the OS setting.
 *
 * globals.css already carries a `prefers-reduced-motion` block, and it does
 * nothing for any of this: it neutralises CSS `animation-duration` and
 * `transition-duration`, while Framer Motion animates by writing inline
 * styles frame by frame in JavaScript. Measured against a browser with the
 * preference set, the hero headline still travelled its full distance
 * (transform y: 66.2 → 20.5 → 7.97 → 1.70 → 0.15 → 0px over 720ms) — the
 * whole motion system was running unmitigated for exactly the users the
 * stylesheet was written to protect, and the spec's own line is that motion
 * is an enhancement and never load-bearing (§43/§44).
 *
 * `reducedMotion="user"` makes Motion read the media query itself: transform
 * and layout animations are skipped and their values applied at once, while
 * opacity and colour still cross-fade, which is the behaviour the guideline
 * actually asks for rather than freezing the interface.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
