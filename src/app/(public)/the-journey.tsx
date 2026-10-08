'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Heading } from '@/components/ui'
import { STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import type { Program } from '@/payload/payload-types'

/**
 * What each stage *is*. Deliberately says nothing about what KNEST provides at a
 * stage: the previous copy promised free credits, co-founder
 * matching, monthly hackathons, customer introductions and investor
 * introductions, none of which has been approved (KN-18). What KNEST
 * actually offers at a stage is whatever programs the CMS holds for it.
 */
const STAGE_CONTENT = {
  exploring: {
    image: '/images/stage_01_exploring.jpg',
    description: "You don't need an idea yet. This stage is about finding problems worth solving and people who care about them.",
  },
  idea: {
    image: '/images/stage_02_idea.jpg',
    description: "You have an idea. Now the question is whether it's actually worth building.",
  },
  validation: {
    image: '/images/stage_idea.jpg',
    description: 'You have a hypothesis. This stage is about testing it against real people before you build more.',
  },
  mvp: {
    image: '/images/stage_mvp.jpg',
    description: 'The idea is no longer hypothetical. You are building a first version, and it needs users, feedback and momentum.',
  },
  early_revenue: {
    image: '/images/hero_bg.jpg',
    description: 'The product is live and you are looking for your first paying customers.',
  },
  scaling: {
    image: '/images/stage_scaling.jpg',
    description: "You've crossed the first line. Now the question is how far it can go.",
  },
}

const NO_PROGRAMS_COPY = 'Programs for this stage are being built.'
const PROGRAMS_UNAVAILABLE_COPY = 'Programs could not be loaded right now. Please try again shortly.'

const VISIBLE_STAGES = STAGE_OPTIONS.slice(0, 6)

export function TheJourney({
  allPrograms,
  programsUnavailable = false,
}: {
  allPrograms: Program[]
  programsUnavailable?: boolean
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  const stagePrograms = VISIBLE_STAGES.map((stage) => ({
    stage,
    programs: allPrograms.filter((program) => program.stage?.includes(stage.value)),
    content: STAGE_CONTENT[stage.value as keyof typeof STAGE_CONTENT] || STAGE_CONTENT['exploring']
  }))

  const current = stagePrograms[activeIdx] ?? stagePrograms[0]!

  return (
    <section className="relative py-12 md:py-16 bg-[var(--color-ink)] text-[var(--color-paper)] overflow-hidden border-t border-[var(--color-line)]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-5 gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)]">
              Six stages
            </p>
            <Heading as="h2" size="display" className="mt-2 tracking-tight text-[var(--color-paper)] text-3xl md:text-5xl font-bold">
              The Trajectory
            </Heading>
            <p className="mt-3 text-base md:text-lg font-light text-[var(--color-paper)]/70 max-w-2xl">
              Nobody goes from idea to company in one leap. Here is the path, and the programs KNEST runs for each stage.
            </p>
          </div>

          {/* Step Indicator / Prev-Next Controls */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[var(--color-paper)]/60">
              Stage <span className="text-white font-bold">{String(activeIdx + 1).padStart(2, '0')}</span> / 06
            </span>
            <div className="flex gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => setActiveIdx((prev) => (prev > 0 ? prev - 1 : stagePrograms.length - 1))}
                aria-label="Previous stage"
                className="size-9 border border-white/20 bg-white/5 hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)]/20 flex items-center justify-center text-white transition-colors"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setActiveIdx((prev) => (prev < stagePrograms.length - 1 ? prev + 1 : 0))}
                aria-label="Next stage"
                className="size-9 border border-white/20 bg-white/5 hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)]/20 flex items-center justify-center text-white transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* 6-Stage Timeline Stepper Rail */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-white/10">
          {stagePrograms.map(({ stage }, i) => {
            const isActive = activeIdx === i
            return (
              <button
                key={stage.value}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`group relative text-left py-4 px-3 md:px-4 border-r border-white/10 last:border-r-0 transition-all duration-200 ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-[var(--color-paper)]/50 hover:text-[var(--color-paper)] hover:bg-white/[0.03]'
                }`}
              >
                {/* Active Top Signal Bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeStageTab"
                    className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-signal)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <div className="font-mono text-xs font-bold text-[var(--color-signal)]">
                  0{i + 1}
                </div>
                <div className="mt-1 text-xs md:text-sm font-semibold tracking-tight truncate">
                  {stage.label}
                </div>
              </button>
            )
          })}
        </div>

        {/* Active Stage Content Viewport */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.stage.value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch"
          >
            {/* Left Content Column */}
            <div className="lg:col-span-7 flex flex-col justify-between border border-white/10 bg-white/[0.03] p-6 md:p-10 relative">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-signal)]">
                    Phase 0{activeIdx + 1}
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-paper)]/60">
                    {current.stage.value.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl md:text-4xl font-bold text-white tracking-tight">
                  {current.stage.label}
                </h3>

                <p className="mt-4 text-sm md:text-base text-[var(--color-paper)]/80 font-light leading-relaxed">
                  {current.content.description}
                </p>

                {/* Programs for this stage */}
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)] mb-4">
                    Programs for this stage
                  </p>

                  {current.programs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {current.programs.map((program) => (
                        <Link
                          key={program.id}
                          href={`/programs/${program.slug}`}
                          className="group/prog border border-white/15 bg-white/[0.04] p-4 transition-all duration-200 hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)]/15 flex items-center justify-between"
                        >
                          <span className="text-sm font-medium text-white group-hover/prog:text-[var(--color-paper)] transition-colors line-clamp-1">
                            {program.title}
                          </span>
                          <span className="text-xs font-bold text-[var(--color-signal)] ml-2 transition-transform group-hover/prog:translate-x-1">
                            →
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="border-l-2 border-[var(--color-signal)] bg-white/[0.02] p-4">
                      <p className="text-xs md:text-sm text-[var(--color-paper)]/80 font-light leading-relaxed">
                        {programsUnavailable ? PROGRAMS_UNAVAILABLE_COPY : NO_PROGRAMS_COPY}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Stage Progress Quick Jumper */}
              {(() => {
                const nextStage = stagePrograms[activeIdx + 1]?.stage?.label
                return (
                  <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-[var(--color-paper)]/60">
                    <span>Navigate through all 6 phases</span>
                    <button
                      type="button"
                      onClick={() => setActiveIdx((prev) => (prev < stagePrograms.length - 1 ? prev + 1 : 0))}
                      className="font-bold text-[var(--color-signal)] hover:underline uppercase tracking-wider"
                    >
                      {nextStage ? `Next: ${nextStage} →` : 'Back to Start (Exploring) ↺'}
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* Right Architectural Image Column */}
            <div className="lg:col-span-5 h-[260px] sm:h-[320px] lg:h-auto min-h-[300px] border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[var(--color-signal)]/15 mix-blend-multiply z-10" />
              <img
                src={current.content.image}
                alt={current.stage.label}
                className="w-full h-full object-cover grayscale contrast-110 hover:grayscale-0 transition-all duration-700 ease-out"
              />
              <div className="absolute bottom-4 left-4 z-20 bg-black/80 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-[var(--color-paper)]/80 border border-white/10 backdrop-blur-sm">
                Stage 0{activeIdx + 1} {'//'} {current.stage.label}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
