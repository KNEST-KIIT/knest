import type { Variants } from 'framer-motion'

/**
 * KNEST: Artistic Motion Library
 * 
 * Elegant, cinematic tweens for a high-end editorial feel.
 */

const cinematicEase = [0.16, 1, 0.3, 1] as const
const duration = 0.8

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration, ease: cinematicEase }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: 0.4, ease: cinematicEase }
  }
}

export const staggerContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
}

// Staggered word-by-word text reveal
export const textRevealContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
}

export const textRevealWord: Variants = {
  initial: { opacity: 0, y: 20, filter: 'blur(4px)' },
  animate: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: cinematicEase }
  }
}

// Cinematic Image Mask Reveal
export const imageReveal: Variants = {
  initial: { clipPath: 'inset(100% 0 0 0)', filter: 'blur(10px)' },
  animate: { 
    clipPath: 'inset(0% 0 0 0)',
    filter: 'blur(0px)',
    transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const }
  }
}

export const imageRevealLeft: Variants = {
  initial: { clipPath: 'inset(0 100% 0 0)', scale: 1.05 },
  animate: { 
    clipPath: 'inset(0 0 0 0)',
    scale: 1,
    transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const }
  }
}

// Interactive states
export const magneticButton = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.05, y: -2, transition: { duration: 0.4, ease: cinematicEase } },
  tap: { scale: 0.95, y: 1, transition: { duration: 0.1 } }
}

export const subtleHoverCard = {
  rest: { scale: 1, y: 0, filter: 'brightness(1)' },
  hover: { scale: 1.02, y: -5, filter: 'brightness(1.1)', transition: { duration: 0.5, ease: cinematicEase } }
}
