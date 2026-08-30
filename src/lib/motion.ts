import type { Transition, Variants } from 'motion/react'

/**
 * The motion system.
 *
 * One vocabulary for everything that moves, so no component picks a duration
 * or a curve at random. This is the JS half; the CSS half lives in
 * `src/styles/tokens.css` as `--duration-*` and `--ease-*` and carries the
 * identical numbers. Anything animated in CSS (a hover colour, a border)
 * uses the tokens; anything animated in JS (entrances, exits, layout,
 * gestures) uses this file.
 *
 * The rule the whole system is built on: motion explains cause, effect and
 * continuity. If a movement is not telling the user where something came
 * from, where it went, or that their action registered, it should not exist.
 *
 * Reduced motion is handled once, globally, by `<MotionConfig
 * reducedMotion="user">` in `src/components/motion/provider.tsx` — it strips
 * transform and layout animation and leaves opacity, which keeps every
 * reveal below readable rather than blank. Nothing here needs to check for
 * it individually, and nothing should.
 */

/**
 * Durations, in seconds (Motion's unit; the CSS tokens are the same values
 * in ms). The scale is deliberately short — five steps, each roughly 1.5x
 * the last, so the difference between two adjacent steps is perceptible and
 * there is never a reason to invent one in between.
 */
export const duration = {
  /** State flips that should feel instantaneous: hover colour, focus ring. */
  instant: 0.12,
  /** Small elements moving a short distance: badges, tooltips, press feedback. */
  fast: 0.2,
  /** The default. Dropdowns, accordions, tabs, cards, most enter/exit. */
  base: 0.32,
  /** Entrances of whole sections, and anything crossing a large distance. */
  slow: 0.5,
  /** Reserved for the hero. One moment per page is allowed to take its time. */
  deliberate: 0.7,
} as const

/**
 * Easings, as raw cubic-bezier control points.
 *
 * Asymmetry is the point: things arriving decelerate, things leaving
 * accelerate. Using one curve for both is the single most common reason
 * interface motion feels sluggish — an exit that eases out makes the user
 * wait for something they have already dismissed.
 */
export const ease = {
  /** Decelerating. Arrivals. Fast off the mark, settling at the end. */
  entrance: [0.16, 1, 0.3, 1],
  /** Accelerating. Exits. Gets out of the way. */
  exit: [0.4, 0, 1, 1],
  /** Symmetric. State changes that neither arrive nor leave. */
  standard: [0.4, 0, 0.2, 1],
  /** A small overshoot. Only for confirming an action the user just took. */
  emphasis: [0.34, 1.4, 0.64, 1],
} as const

/**
 * Springs, for anything the user is directly manipulating or that needs to
 * feel physical. A spring has no duration — it settles — which is exactly
 * right for gestures and layout changes and exactly wrong for a timed
 * sequence, so timed things above use durations instead.
 */
export const spring = {
  /** Press and release. Stiff and heavily damped: responds, doesn't wobble. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  /** Layout and shared-element transitions. Enough travel to follow by eye. */
  smooth: { type: 'spring', stiffness: 260, damping: 30 },
  /** Larger surfaces — drawers, sheets — where snappy would read as abrupt. */
  gentle: { type: 'spring', stiffness: 170, damping: 24 },
} as const satisfies Record<string, Transition>

/**
 * Stagger intervals, in seconds.
 *
 * A stagger says "these are a set, and they have an order". Too long and the
 * user watches a queue form; the ceiling is roughly 400ms for the whole
 * group, which is why the counts below matter more than the interval.
 */
export const stagger = {
  /** Long lists (8+). Reads as a single wave rather than individual items. */
  tight: 0.035,
  /** The default, for 3-8 items. */
  base: 0.06,
  /** Two or three large items, where each deserves to be seen separately. */
  loose: 0.09,
} as const

/** The distance things travel on entry. Small on purpose — motion, not flight. */
export const travel = {
  sm: 6,
  md: 12,
  lg: 20,
} as const

export const transition = {
  instant: { duration: duration.instant, ease: ease.standard },
  fast: { duration: duration.fast, ease: ease.standard },
  base: { duration: duration.base, ease: ease.standard },
  enter: { duration: duration.base, ease: ease.entrance },
  enterSlow: { duration: duration.slow, ease: ease.entrance },
  leave: { duration: duration.fast, ease: ease.exit },
} as const satisfies Record<string, Transition>

/* ---------------------------------------------------------------------- *
 * Variants
 *
 * Named states rather than inline objects, so a parent can drive its
 * children by name (`animate="visible"` cascades) and so the same entrance
 * is literally the same object everywhere it is used.
 * ---------------------------------------------------------------------- */

/** The house entrance: up and in. Used by `Reveal` and most section content. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: travel.md },
  visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.entrance } },
}

/** Opacity only. For anything where movement would fight the layout. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: ease.standard } },
}

/** Grows into place from its own centre. Popovers, toasts, dialog panels. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: ease.entrance } },
  exit: { opacity: 0, scale: 0.98, transition: transition.leave },
}

/** Expand/collapse. Height animates from the element's own measured size. */
export const collapse: Variants = {
  hidden: { height: 0, opacity: 0, transition: { duration: duration.fast, ease: ease.exit } },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: duration.base, ease: ease.entrance },
      opacity: { duration: duration.fast, ease: ease.standard, delay: 0.06 },
    },
  },
}

/**
 * A container that drives its children's entrance in sequence.
 *
 * Pair with `staggerItem` on each child. `delayChildren` gives the container
 * itself a beat to arrive first, so the group reads as one thing appearing
 * rather than a race.
 */
export function staggerContainer(interval: number = stagger.base, delayChildren = 0.04): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: interval, delayChildren } },
  }
}

/** The child half of `staggerContainer`. Same entrance as `riseIn`, shorter. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: travel.md },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.entrance } },
}

/**
 * The viewport config every scroll reveal uses.
 *
 * `once` because re-animating content a user has already read is noise, and
 * on a back-navigation it is actively disorienting. The negative bottom
 * margin fires the reveal slightly *before* the element reaches the fold, so
 * by the time it is comfortably in view it has finished moving — content
 * that is still animating when you start reading it is the thing that makes
 * scroll animation feel cheap.
 */
export const viewportOnce = { once: true, margin: '0px 0px -12% 0px' } as const
