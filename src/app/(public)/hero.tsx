'use client'

import { motion } from 'motion/react'
import { ButtonLink, Container } from '@/components/ui'
import { duration, ease, stagger, travel } from '@/lib/motion'
import type { Homepage } from '@/payload/payload-types'

/**
 * WHAT IF? — signature experience 01 (CONTENT_SPEC.md §1.1). Type-only, no
 * stock photography.
 *
 * The headline arrives a word at a time. This is the one place in the app
 * that gets a set-piece entrance, and it earns it: the headline is a
 * question, and reading a question word by word is how you actually read it
 * — the motion is doing the same thing the punctuation is. Everything after
 * this section renders in its final state until it is scrolled to.
 *
 * The split is presentational only. The full headline is in the accessible
 * name via an `sr-only` copy, and the animated words are `aria-hidden`, so a
 * screen reader hears one sentence rather than a list of words — the usual
 * cost of per-word animation, avoided.
 */
export function Hero({ homepage }: { homepage: Homepage }) {
  const lines = (homepage.heroHeadline ?? '').split('\n')

  return (
    <div className="relative flex min-h-[88vh] flex-col justify-center py-24">
      <Container>
        <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-hero)] uppercase leading-[0.9] tracking-[-0.03em]">
          <span className="sr-only">{homepage.heroHeadline}</span>
          <motion.span
            aria-hidden
            data-reveal
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: stagger.tight, delayChildren: 0.08 } } }}
            className="block"
          >
            {lines.map((line, li) => (
              <span key={li} className="block">
                {line.split(' ').map((word, wi) => (
                  // The clip wrapper is what makes this read as type rising
                  // off the page rather than fading in place: each word is
                  // masked by its own line box until it arrives.
                  <span key={wi} className="inline-block overflow-hidden pb-[0.06em] align-bottom">
                    <motion.span
                      className="inline-block"
                      variants={{
                        hidden: { y: '100%', opacity: 0 },
                        visible: {
                          y: '0%',
                          opacity: 1,
                          transition: { duration: duration.deliberate, ease: ease.entrance },
                        },
                      }}
                    >
                      {word}
                      {wi < line.split(' ').length - 1 ? ' ' : ''}
                    </motion.span>
                  </span>
                ))}
              </span>
            ))}
          </motion.span>
        </h1>

        <motion.p
          data-reveal
          initial={{ opacity: 0, y: travel.md }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.slow, ease: ease.entrance, delay: 0.34 }}
          className="mt-6 max-w-[52ch] text-[length:var(--text-heading)] text-[var(--color-ink-soft)]"
        >
          {homepage.heroSubhead}
        </motion.p>

        <motion.div
          data-reveal
          initial={{ opacity: 0, y: travel.md }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.slow, ease: ease.entrance, delay: 0.44 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <ButtonLink href="/signup" size="lg">
            {homepage.heroPrimaryCta}
          </ButtonLink>
          {homepage.heroSecondaryCta && (
            <ButtonLink href="/programs" variant="secondary" size="lg">
              {homepage.heroSecondaryCta}
            </ButtonLink>
          )}
        </motion.div>
      </Container>

      {/*
        The hero is 88vh, so there is always something below it and no way to
        tell from a screenshot-still that this is true. The cue says so.
        `aria-hidden` because it duplicates no information a keyboard or
        screen-reader user needs — they are already past it.
      */}
      <motion.div
        aria-hidden
        data-reveal
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.slow, delay: 0.9 }}
        className="pointer-events-none absolute inset-x-0 bottom-10 hidden justify-center md:flex"
      >
        <motion.span
          className="flex h-10 w-6 items-start justify-center rounded-full border border-[var(--color-line)] pt-2"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
        >
          <span className="h-1.5 w-1 rounded-full bg-[var(--color-ink-muted)]" />
        </motion.span>
      </motion.div>
    </div>
  )
}
