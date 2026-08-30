'use client'

import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { riseIn, staggerContainer, staggerItem, viewportOnce } from '@/lib/motion'

/**
 * Scroll-triggered entrance for a block of content.
 *
 * Deliberately a wrapper that takes `children` rather than a hook, so the
 * thing being revealed stays a server component — `<Reveal>` is the only
 * part of the subtree that ships to the browser. Most of this app renders
 * on the server and that should survive adding motion to it.
 *
 * `data-reveal` is what the `<noscript>` rule in the root layout targets: if
 * JavaScript never runs, these elements must not be left at opacity 0 with
 * no way back. Content being readable is not conditional on the animation
 * library loading.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variants = riseIn,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  variants?: Variants
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'aside'
}) {
  const Component = motion[Tag]
  return (
    <Component
      data-reveal
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ delay }}
    >
      {children}
    </Component>
  )
}

/**
 * A set of items that enter in sequence.
 *
 * Drives its children by variant name, so each child only needs to be a
 * `<RevealItem>` — no per-item delay arithmetic, which is the thing that
 * always drifts out of step when someone adds a sixth card to a row of five.
 */
export function RevealGroup({
  children,
  className,
  interval,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  interval?: number
  as?: 'div' | 'section' | 'ul' | 'ol'
}) {
  const Component = motion[Tag]
  return (
    <Component
      data-reveal
      className={className}
      variants={staggerContainer(interval)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </Component>
  )
}

/** One member of a `RevealGroup`. Inherits its timing from the parent. */
export function RevealItem({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
}) {
  const Component = motion[Tag]
  return (
    <Component data-reveal className={className} variants={staggerItem}>
      {children}
    </Component>
  )
}
