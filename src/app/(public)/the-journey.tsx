'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { Heading } from '@/components/ui'
import { cn } from '@/lib/cn'
import { STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import type { Program } from '@/payload/payload-types'

const STAGE_CONTENT = {
  'exploring': {
    image: '/images/stage_01_exploring.jpg', // NEW PHOTOREALISTIC IMAGE
    description: "You don't need a groundbreaking idea to start. This stage is about exposing yourself to new problems, finding people who share your intensity, and figuring out exactly what you want to dedicate your time to. KNEST provides the spaces, events, and community to spark that initial fire.",
    noProgramCopy: "We run open mixer events, hackathons, and ideation workshops every month. No formal program required—just show up and start talking to people."
  },
  'idea': {
    image: '/images/stage_02_idea.jpg', // NEW PHOTOREALISTIC IMAGE
    description: "You have a hypothesis. Now you need to tear it apart. We provide the mentorship and frameworks to validate your concept before you write a single line of code. Stop guessing and start talking to users.",
    noProgramCopy: "Leverage our mentor network and drop-in office hours to pressure-test your idea before committing to a structured cohort."
  },
  'validation': {
    image: '/images/stage_idea.jpg', // PLACEHOLDER UNTIL RATE LIMIT LIFTS
    description: "The hardest part isn't building, it's building something people actually want. Get out of the building and test your prototypes against harsh reality. We provide the structure to ensure you aren't building in a vacuum.",
    noProgramCopy: "Our validation frameworks and customer discovery workshops are available on-demand in the resource portal."
  },
  'mvp': {
    image: '/images/stage_mvp.jpg', // PLACEHOLDER
    description: "Validation is over. It's time to build the first functioning version of your product. Access our maker spaces, cloud credits, and technical talent to actually ship your MVP and get it into users' hands.",
    noProgramCopy: "Access our prototyping labs, developer credits, and technical co-founder matchmaking events to build your V1."
  },
  'early_revenue': {
    image: '/images/hero_bg.jpg', // PLACEHOLDER
    description: "Your product is live, and you are hunting for your first paying customers. We plug you into industry networks and go-to-market experts to close those critical early deals and prove your business model works.",
    noProgramCopy: "Tap into our corporate partnerships and alumni network to find your first 10 paying customers."
  },
  'scaling': {
    image: '/images/stage_scaling.jpg', // PLACEHOLDER
    description: "Your product has traction and users want more. We plug you into institutional capital, advanced growth strategies, and industry networks to turn your project into a massive, venture-backable company.",
    noProgramCopy: "We facilitate private investor introductions and scaling strategy sessions for high-growth ventures."
  }
}

// Ensure we only use the first 6 stages to match the design spec requested by the user
const VISIBLE_STAGES = STAGE_OPTIONS.slice(0, 6)

export function TheJourney({ allPrograms }: { allPrograms: Program[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const stagePrograms = VISIBLE_STAGES.map((stage) => ({
    stage,
    programs: allPrograms.filter((program) => program.stage?.includes(stage.value)),
    content: STAGE_CONTENT[stage.value as keyof typeof STAGE_CONTENT] || STAGE_CONTENT['exploring']
  }))

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center']
  })

  // The progress bar draws down as you scroll
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <div ref={containerRef} className="relative py-32 bg-[var(--color-paper-invert)] text-[var(--color-paper)] overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 md:px-10 relative">
        <div className="max-w-3xl mb-32 relative z-10">
          <Heading as="h2" size="display" className="tracking-tight text-[var(--color-paper)]">
            The Trajectory
          </Heading>
          {/* `--color-ink-soft` is a colour for text *on* paper; this section
              runs on the inverted ground, so it measured 1.49:1 against it.
              `--color-paper` at 70% is the muted-on-dark tone the footer
              already uses for the same job, and measures 8.3:1. */}
          <p className="mt-8 text-[length:var(--text-title)] font-light text-[var(--color-paper)]/70">
            Nobody builds a scalable venture in one leap. Here is the exact path, and the infrastructure we deploy at every single stage.
          </p>
        </div>

        {/* Global Progress Line Background */}
        <div className="absolute left-8 md:left-[20%] top-64 bottom-0 w-[1px] bg-[var(--color-line-invert)] z-0" />
        {/* Animated Progress Line */}
        <motion.div 
          className="absolute left-8 md:left-[20%] top-64 bottom-0 w-[1px] bg-[var(--color-signal)] z-10 origin-top"
          style={{ scaleY }}
        />

        <div className="flex flex-col gap-24 md:gap-40 relative z-10">
          {stagePrograms.map(({ stage, programs, content }, index) => (
            <motion.div 
              key={stage.value} 
              className="grid grid-cols-1 md:grid-cols-10 gap-8 md:gap-12 items-center group relative pl-16 md:pl-0"
              data-reveal
              initial="hidden"
              whileInView="visible"
              // `once: false` re-ran the reveal in reverse every time a stage
              // left the viewport, so scrolling back up to re-read one dropped
              // it to 40% opacity and full greyscale again — the six stages
              // grey themselves out behind you as you move down the page, and
              // any stage you return to is unreadable until you scroll away
              // and back. A reveal is an entrance, not a scroll-linked dimmer.
              viewport={{ once: true, margin: "-200px" }}
              variants={{
                hidden: { opacity: 0.4, filter: 'grayscale(100%)' },
                visible: { opacity: 1, filter: 'grayscale(0%)', transition: { duration: 0.8 } }
              }}
            >
              {/* Node on the progress line */}
              <motion.div 
                className="absolute left-8 md:left-[20%] ml-[-6px] top-12 md:top-1/2 w-3 h-3 border-2 border-[var(--color-line-invert)] rounded-full z-20 bg-[var(--color-paper-invert)]"
                variants={{
                  hidden: { borderColor: 'var(--color-line-invert)', backgroundColor: 'var(--color-paper-invert)' },
                  visible: { borderColor: 'var(--color-signal)', backgroundColor: 'var(--color-signal)' }
                }}
                transition={{ duration: 0.5 }}
              />

              {/* Massive Stage Number */}
              <div className="md:col-span-2 text-left md:text-right md:pr-12 pt-8 md:pt-0">
                <motion.span 
                  className="font-[family-name:var(--font-display)] text-[80px] md:text-[120px] font-bold leading-none block bg-clip-text" 
                  /* `WebkitTextStroke` is a real CSS property Motion passes
                     straight through to style, but it is not in Motion's
                     `Variant` type, so this file failed `pnpm typecheck` on
                     both keyframes — on the branch tip, before any of this
                     work. The cast is what the type does not cover; the shape
                     is still checked against `Variants` on assignment. */
                  variants={{
                    hidden: { color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.05)', textShadow: 'none' },
                    visible: { color: 'var(--color-signal)', WebkitTextStroke: '0px transparent', textShadow: '0 0 60px rgba(122, 31, 43, 0.4)' }
                  } as Variants}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  0{index + 1}
                </motion.span>
              </div>
              
              <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Image */}
                <div className={cn("h-[300px] md:h-[450px] overflow-hidden rounded-[var(--radius-lg)] relative", index % 2 !== 0 ? "md:order-2" : "")}>
                  <motion.img 
                    src={content.image} 
                    alt={stage.label} 
                    data-reveal
                    className="w-full h-full object-cover"
                    variants={{
                      hidden: { scale: 1.05, opacity: 0.4, filter: 'grayscale(100%)' },
                      visible: { scale: 1, opacity: 1, filter: 'grayscale(0%)' }
                    }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>

                {/* Content */}
                <div className={cn("py-4 md:py-8", index % 2 !== 0 ? "md:order-1 md:pr-8" : "md:pl-8")}>
                  <motion.div
                    data-reveal
                    className="relative p-6 md:p-10 rounded-[var(--radius-lg)] bg-[var(--color-ink)]/60 backdrop-blur-xl border border-[var(--color-line-invert)]/20 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden group/content"
                    variants={{
                      hidden: { opacity: 0, x: index % 2 !== 0 ? -20 : 20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-signal)] via-[var(--color-signal-deep)] to-transparent opacity-80" />
                    
                    <Heading as="h3" size="title" className="mb-6 text-[var(--color-paper)] drop-shadow-sm">
                      {stage.label}
                    </Heading>
                    <p className="text-[length:var(--text-body)] text-[var(--color-paper)]/70 font-light leading-relaxed mb-10">
                      {content.description}
                    </p>
                    
                    {programs.length === 0 ? (
                      <div className="relative p-5 rounded-[var(--radius-md)] bg-[var(--color-signal)]/10 border border-[var(--color-signal)]/30 backdrop-blur-sm">
                        <p className="text-[length:var(--text-small)] text-[var(--color-paper)] font-medium leading-relaxed">
                          {content.noProgramCopy}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5 pt-6 border-t border-[var(--color-line-invert)]/20">
                        <h4 className="text-[10px] text-[var(--color-paper)]/40 uppercase tracking-[0.2em] font-bold">Available Infrastructure</h4>
                        <ul className="flex flex-col gap-3">
                          {programs.slice(0, 3).map((program) => (
                            <li key={program.id}>
                              <Link 
                                href={`/programs/${program.slug}`}
                                className="group/link flex items-center justify-between p-4 rounded-md bg-[var(--color-ink)]/40 border border-[var(--color-line-invert)]/10 text-[length:var(--text-small)] text-[var(--color-paper)]/90 hover:bg-[var(--color-signal)]/20 hover:border-[var(--color-signal)]/40 hover:text-white transition-all duration-300 shadow-sm hover:shadow-[0_4px_12px_rgba(122,31,43,0.3)]"
                              >
                                <span className="font-medium group-hover/link:translate-x-1 transition-transform duration-300">{program.title}</span>
                                <span className="text-[var(--color-signal)] bg-[var(--color-paper)]/5 rounded-full p-1.5 opacity-0 -translate-x-2 transition-all duration-300 group-hover/link:opacity-100 group-hover/link:translate-x-0 group-hover/link:bg-[var(--color-signal)]/20">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
