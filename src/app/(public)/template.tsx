'use client'

import { motion } from 'motion/react'
import { duration, ease } from '@/lib/motion'

/**
 * The arrival half of a route change.
 *
 * `template.tsx` remounts on every navigation (unlike `layout.tsx`), which is
 * what makes an enter animation possible here at all.
 *
 * Enter only, and opacity only. There is no exit animation because producing
 * one in the App Router means holding the outgoing page on screen while it
 * plays — paying real latency for a decoration, on a site whose pages are
 * server-rendered from the database. The departure is already covered
 * properly: every route in this group has a `loading.tsx`, so a slow
 * navigation shows that route's own skeleton immediately rather than a
 * progress bar guessing at how far along it is.
 *
 * No transform, deliberately. The section reveals underneath already move
 * content vertically, and a page-level slide on top of them reads as two
 * things sliding past each other at different speeds.
 */
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: duration.fast, ease: ease.standard }}
    >
      {children}
    </motion.div>
  )
}
