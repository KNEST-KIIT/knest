'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Heading } from '@/components/ui'

export interface DirectorProfile {
  name: string
  photo: string
  linkedin: string
  title: string
  bio: string
  focusAreas: readonly string[]
  achievements: readonly string[]
}

export const DIRECTORS: readonly DirectorProfile[] = [
  {
    name: 'Mr. S. Samir Panda',
    photo: '/images/directors/samir-panda.jpg',
    linkedin: 'https://www.linkedin.com/in/samir-panda/',
    title: 'Director, KiiTNEST & Registrar, KIIT Group of Institutions',
    bio: 'Mr. S. Samir Panda is a distinguished institutional administrator and operational strategist steering governance, cross-campus scale, and institutional alliances across KIIT, KISS, and KiiT-TBI. Leading with deep acumen in organizational frameworks, compliance, and multi-stakeholder governance, he plays a crucial role in anchoring KiiTNEST as an institutional engine for student enterprise creation.',
    focusAreas: ['Institutional Governance', 'Startup Policy Frameworks', 'Campus Enterprise Scaling'],
    achievements: [
      'Spearheads ecosystem governance across KIIT’s multi-disciplinary academic and incubation assets.',
      'Drives regulatory, compliance, and institutional support architectures for university ventures.',
      'Fosters strategic partnerships linking academic labs to national entrepreneurship bodies.',
    ],
  },
  {
    name: 'Prof. (Dr.) Saranjit Singh',
    photo: '/images/directors/saranjit-singh.jpg',
    linkedin: 'https://www.linkedin.com/in/prof-dr-saranjit-singh-24404825/',
    title: 'Director, KiiTNEST & Vice Chancellor, KIIT Deemed to be University',
    bio: 'Prof. (Dr.) Saranjit Singh is an eminent academic leader, researcher, and educational innovator serving as the Vice Chancellor of KIIT Deemed to be University. A distinguished scholar in engineering and manufacturing systems, he has championed translational research and multidisciplinary venture incubation across KIIT, ensuring that foundational academic curiosity converts into real-world commercial impact.',
    focusAreas: ['Academic Innovation', 'Translational Research', 'University Venture Strategy'],
    achievements: [
      'Leads KIIT Deemed to be University to top national & global academic rankings and accreditations.',
      'Architects curriculum integration connecting engineering research with student incubation.',
      'Champions global university-industry partnerships and deep-tech incubation consortia.',
    ],
  },
  {
    name: 'Mr. Miten Narendra Mehta',
    photo: '/images/directors/miten-mehta.png',
    linkedin: 'https://www.linkedin.com/in/mitenmehta/',
    title: 'Director, KiiTNEST & Global AI, Innovation & Venture Advisor',
    bio: 'Mr. Miten Narendra Mehta brings over three decades of international leadership across Silicon Valley, Europe, and Asia as an enterprise technology strategist, angel investor, and AI transformation advisor. Having built, scaled, and advised tech ventures, unicorn startups, and institutional funds worldwide, he directs KiiTNEST’s global mentorship, cross-border commercialization, and deep-tech venture corridors.',
    focusAreas: ['AI & Deep-Tech Strategy', 'Cross-Border Venture Corridors', 'Angel & Institutional Capital'],
    achievements: [
      '30+ years advising Fortune 500 tech leaders, venture studios, and frontier AI accelerators globally.',
      'Mentored and invested in cross-border tech enterprises across North America, Europe, and India.',
      'Connects KiiTNEST founders directly with Silicon Valley and global venture capital networks.',
    ],
  },
  {
    name: 'Dr. Suman Bhattacharya',
    photo: '/images/directors/suman-bhattacharya.jpg',
    linkedin: 'https://www.linkedin.com/in/sumanity/',
    title: 'Director, KiiTNEST & Director, CAAS, KIIT',
    bio: 'Dr. Suman Bhattacharya is a forward-thinking academic innovator and technology commercialization leader at KIIT, heading the Centre for Advanced Applied Sciences (CAAS). With a focus on interdisciplinary prototyping, student patenting, and translational technology development, he bridges student ideation with institutional funding, incubation facilities, and technical validation.',
    focusAreas: ['Applied Sciences & Prototyping', 'Student Venture Acceleration', 'IP & Technology Translation'],
    achievements: [
      'Director of Centre for Advanced Applied Sciences (CAAS), pioneering applied student tech ventures.',
      'Mentored hundreds of student-led prototypes through grant validation and patent filing.',
      'Spearheads student venture incubation, technical vetting, and institutional hackathon excellence.',
    ],
  },
]

function LinkedInMark({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}

function CloseIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ArrowUpRightIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

function CheckmarkIcon({ className = 'size-4 shrink-0 text-[var(--color-signal)]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function Directors() {
  const [selectedDirector, setSelectedDirector] = useState<DirectorProfile | null>(null)
  const titleId = useId()
  const descId = useId()

  const reduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const open = (d: DirectorProfile) => {
    triggerRef.current = document.activeElement as HTMLElement | null
    setSelectedDirector(d)
  }

  const handleClose = useCallback(() => {
    setSelectedDirector(null)
    triggerRef.current?.focus()
  }, [])

  // Escape closes, Tab stays inside the dialog, focus moves in on open and
  // returns to the card that opened it on close.
  useEffect(() => {
    if (!selectedDirector) return
    const dialog = dialogRef.current
    dialog?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDirector, handleClose])

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--color-signal)]">
            Institutional Leadership
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl lg:text-4xl text-[var(--color-ink)]">
            Board of Directors
          </Heading>
          <p className="mt-2 text-sm md:text-base text-[var(--color-ink-muted)]">
            Click any profile to view their institutional brief, focus areas, and leadership journey.
          </p>
        </div>
      </div>

      <ul className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {DIRECTORS.map((d) => (
          <motion.li
            key={d.name}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            transition={{ duration: 0.2 }}
            className="group relative flex min-w-0 flex-col border border-[var(--color-line)] bg-white shadow-xs transition-shadow hover:shadow-md hover:border-[var(--color-signal)]"
          >
            {/* Clickable Card Media */}
            <button
              type="button"
              onClick={() => open(d)}
              className="relative aspect-square w-full overflow-hidden bg-[var(--color-paper-soft)] cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)]"
              aria-haspopup="dialog"
              aria-label={`View full profile and brief for ${d.name}`}
            >
              <Image
                src={d.photo}
                alt={`Portrait of ${d.name}`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)]/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-3">
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-white/95 px-2.5 py-1 text-xs font-bold text-[var(--color-ink)] shadow-xs">
                  <span>Read Brief</span>
                  <ArrowUpRightIcon />
                </span>
              </div>
            </button>

            {/* Card Footer */}
            <div className="flex flex-1 flex-col items-start justify-between gap-3 border-t border-[var(--color-line)] p-3.5">
              <div className="w-full">
                <p className="font-[family-name:var(--font-display)] text-base md:text-lg font-bold leading-snug text-[var(--color-ink)]">
                  {d.name}
                </p>
              </div>

              <div className="flex w-full items-center justify-between gap-2 border-t border-[var(--color-line)]/50 pt-2.5">
                <button
                  type="button"
                  onClick={() => open(d)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-signal)] hover:underline cursor-pointer"
                >
                  <span>Profile Brief</span>
                  <ArrowUpRightIcon className="size-3" />
                </button>

                <a
                  href={d.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${d.name} on LinkedIn (opens in a new tab)`}
                  className="inline-flex min-h-[2.25rem] items-center gap-1.5 border border-[var(--color-ink-muted)] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] transition-colors hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)]"
                >
                  <LinkedInMark className="size-3.5" />
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>

      {/* Accessible Profile Brief Dialog */}
      <AnimatePresence>
        {selectedDirector && (
          <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleClose}
              className="fixed inset-0 bg-[var(--color-ink)]/75 backdrop-blur-xs cursor-pointer"
              aria-hidden="true"
            />

            {/* Modal Content */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              ref={dialogRef}
              tabIndex={-1}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden outline-none border border-[var(--color-line)] bg-white shadow-2xl rounded-[var(--radius-sm)]"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-3.5">
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
                  Director Profile Brief
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close director profile dialog"
                  className="rounded-[var(--radius-sm)] p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-line)]/50 hover:text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)] cursor-pointer transition-colors"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto p-5 sm:p-7">
                {/* Top Section with Photo & Core Info */}
                <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center border-b border-[var(--color-line)] pb-6">
                  <div className="relative size-28 sm:size-32 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 border-[var(--color-line)] bg-[var(--color-paper-soft)] shadow-xs">
                    <Image
                      src={selectedDirector.photo}
                      alt={`Portrait of ${selectedDirector.name}`}
                      fill
                      sizes="8rem"
                      className="object-cover object-center"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3
                      id={titleId}
                      className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]"
                    >
                      {selectedDirector.name}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--color-signal)] leading-snug">
                      {selectedDirector.title}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedDirector.focusAreas.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-[var(--radius-sm)] bg-[var(--color-paper-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-soft)] border border-[var(--color-line)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Biography Narrative */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Institutional Overview
                  </h4>
                  <p
                    id={descId}
                    className="mt-2 text-sm sm:text-base leading-relaxed text-[var(--color-ink)]"
                  >
                    {selectedDirector.bio}
                  </p>
                </div>

                {/* Key Leadership Highlights */}
                <div className="mt-6 border-t border-[var(--color-line)]/60 pt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Key Leadership Focus
                  </h4>
                  <ul className="mt-3 space-y-2">
                    {selectedDirector.achievements.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--color-ink-soft)]">
                        <CheckmarkIcon className="size-4 shrink-0 mt-0.5 text-[var(--color-signal)]" />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-4">
                <a
                  href={selectedDirector.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[2.5rem] items-center gap-2 border border-[var(--color-signal)] bg-[var(--color-signal)] px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--color-signal-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)]"
                >
                  <LinkedInMark className="size-4 text-white" />
                  <span>Connect on LinkedIn</span>
                </a>

                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex min-h-[2.5rem] items-center border border-[var(--color-line)] bg-white px-4 text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper-soft)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
