'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Reveal, RevealHeading } from '@/components/ui'
import type { Homepage } from '@/payload/payload-types'

interface ExecutionFlowProps {
  homepage: Homepage
}

export function ExecutionFlow({ homepage }: { homepage: Homepage }) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const problemHeading = homepage.problemHeading || "THE HARDEST PART ISN'T THE IDEA. IT'S THE EXECUTION."
  const problemBody =
    homepage.problemBody ||
    "You've probably had one. Sitting in a lecture, noticing a broken system, and thinking someone should fix it.\n\nThe gap between noticing and building is where 99% of potential is lost. Not to a lack of talent. To a lack of a next step."

  // Clean problem paragraphs
  const rawParagraphs = problemBody.split('\n\n').filter(Boolean)
  const lectureText =
    rawParagraphs[0] ||
    "You've probably had one. Sitting in a lecture, noticing a broken system, and thinking someone should fix it."
  const quoteText =
    rawParagraphs[1]?.replace(/We are the next step\.?/i, '').trim() ||
    'The gap between noticing and building is where 99% of potential is lost. Not to a lack of talent — to the lack of an immediate next step.'

  const personHeading = homepage.personHeading || "YOU DON'T HAVE TO BE 'AN ENTREPRENEUR' YET."
  const rawPersonLines =
    homepage.personLines && homepage.personLines.length > 0
      ? homepage.personLines.map((p) => p.line)
      : [
          'You just need an obsession.',
          'You need to hate inefficiency.',
          'You need to be willing to fail in public.',
          'We will teach you the rest.',
        ]

  // Filter out the teaching pledge from the requirement bullet points
  const mindsetTraits = rawPersonLines.filter(
    (line) => !line.toLowerCase().includes('teach you the rest'),
  )
  const pledgeText =
    rawPersonLines.find((line) => line.toLowerCase().includes('teach you the rest')) ||
    'We will teach you the rest.'

  const knestHeading = homepage.knestHeading || 'KNEST IS THE INFRASTRUCTURE FOR AMBITION.'
  const knestBody =
    homepage.knestBody ||
    "We don't just run programs. We provide the capital, the makerspaces, the industry networks, and the intense, high-agency community you need to turn a prototype into a scalable venture."

  const INFRA_PILLARS = [
    { title: 'Capital & Grants', desc: 'Proof-of-concept seed funding' },
    { title: 'Hardware Labs', desc: 'Rapid prototyping & maker spaces' },
    { title: 'Industry Network', desc: 'Corporate & alumni syndicates' },
    { title: 'Founder Cohorts', desc: 'High-agency builder community' },
  ]

  return (
    <section className="relative py-12 md:py-16 bg-[var(--color-paper)] border-b border-[var(--color-line)] overflow-hidden">
      {/* Background Architectural Blueprint Subtle Grid */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#0d1321 1px, transparent 1px), linear-gradient(to right, #0d1321 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 md:px-10 z-10">
        {/* Editorial Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 border border-[var(--color-signal)]/30 bg-[var(--color-signal)]/5 px-3 py-1 mb-3">
            <span className="size-1.5 rounded-full bg-[var(--color-signal)] animate-pulse" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-signal)]">
              The Conversion Sequence
            </span>
          </div>

          <RevealHeading
            size="display"
            className="tracking-tight text-3xl md:text-5xl font-bold text-[var(--color-ink)] leading-[1.1]"
          >
            From Observation to Scalable Venture.
          </RevealHeading>

          <Reveal delay={0.15}>
            <p className="mt-3 text-base md:text-lg text-[var(--color-ink-soft)] font-light max-w-2xl mx-auto leading-relaxed">
              Transforming raw student curiosity into an operating company is not random luck. It is
              an intentional, three-stage architectural progression.
            </p>
          </Reveal>
        </div>

        {/* 3-Column Connected Progression Flow Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {/* ======================================================== */}
          {/* CARD 01: THE FRICTION (From Idea to Next Step)           */}
          {/* ======================================================== */}
          <Reveal delay={0.1} className="h-full">
            <div
              onMouseEnter={() => setHoveredCard(1)}
              onMouseLeave={() => setHoveredCard(null)}
              className="h-full bg-[#fcfaf5] border-2 border-[var(--color-line)] p-6 sm:p-7 md:p-8 flex flex-col justify-between shadow-sm hover:border-[var(--color-signal)] hover:-translate-y-1 transition-all duration-300 relative group overflow-hidden"
            >
              {/* Watermark Roman Numeral — Clearer by default, highlights brightly on hover */}
              <span
                className={`absolute top-2 right-4 font-[family-name:var(--font-display)] text-7xl md:text-8xl font-black select-none pointer-events-none transition-all duration-300 ${
                  hoveredCard === 1
                    ? 'text-[var(--color-signal)]/35 scale-105'
                    : 'text-[var(--color-signal)]/14 scale-100'
                }`}
              >
                01
              </span>

              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[var(--color-signal)]" />

              <div>
                {/* Meta Header / Badge */}
                <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                  <span
                    onMouseEnter={() => setHoveredCard(1)}
                    className="inline-flex items-center gap-2 border border-[var(--color-line)] bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-signal)] transition-all duration-200 hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)]/10 cursor-pointer"
                  >
                    <span className="size-1.5 rounded-full bg-[var(--color-signal)]" />
                    01 // The Friction
                  </span>
                </div>

                {/* Primary Headline with Word-Wrapping Safety */}
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold text-[var(--color-ink)] leading-snug tracking-tight break-words">
                  THE HARDEST PART ISN&rsquo;T THE IDEA.
                  <span className="text-[var(--color-signal)] block mt-1">
                    IT&rsquo;S THE EXECUTION.
                  </span>
                </h3>

                {/* Narrative Body */}
                <p className="mt-3.5 text-sm text-[var(--color-ink-soft)] font-light leading-relaxed">
                  {lectureText}
                </p>

                {/* Editorial Quote Box */}
                <div className="mt-5 border-l-2 border-[var(--color-signal)] bg-white p-3.5 text-xs sm:text-[13px] text-[var(--color-ink)] leading-relaxed shadow-sm border border-[var(--color-line)]/60 border-l-0">
                  <p className="italic text-[var(--color-ink-soft)] font-normal leading-relaxed">
                    &ldquo;{quoteText}&rdquo;
                  </p>
                </div>
              </div>

              {/* Resolution Footer Plaque */}
              <div className="mt-6 pt-3.5 border-t border-[var(--color-line)] flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-signal)]">
                  <span className="size-1.5 rounded-full bg-[var(--color-signal)]" />
                  We Are The Next Step
                </span>
                <span className="font-mono text-xs font-bold text-[var(--color-ink-muted)] group-hover:text-[var(--color-signal)] group-hover:translate-x-1 transition-all">
                  →
                </span>
              </div>
            </div>
          </Reveal>

          {/* ======================================================== */}
          {/* CARD 02: THE DISPOSITION (Mindset over Title)            */}
          {/* ======================================================== */}
          <Reveal delay={0.2} className="h-full">
            <div
              onMouseEnter={() => setHoveredCard(2)}
              onMouseLeave={() => setHoveredCard(null)}
              className="h-full bg-[#f7f2e5] border-2 border-[var(--color-line)] p-6 sm:p-7 md:p-8 flex flex-col justify-between shadow-sm hover:border-[var(--color-signal)] hover:-translate-y-1 transition-all duration-300 relative group overflow-hidden"
            >
              {/* Watermark Roman Numeral — Clearer by default, highlights brightly on hover */}
              <span
                className={`absolute top-2 right-4 font-[family-name:var(--font-display)] text-7xl md:text-8xl font-black select-none pointer-events-none transition-all duration-300 ${
                  hoveredCard === 2
                    ? 'text-[var(--color-signal)]/35 scale-105'
                    : 'text-[var(--color-signal)]/14 scale-100'
                }`}
              >
                02
              </span>

              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[var(--color-signal)]/75" />

              <div>
                {/* Meta Header / Badge */}
                <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                  <span
                    onMouseEnter={() => setHoveredCard(2)}
                    className="inline-flex items-center gap-2 border border-[var(--color-line)] bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-signal)] transition-all duration-200 hover:border-[var(--color-signal)] hover:bg-[var(--color-signal)]/10 cursor-pointer"
                  >
                    <span className="size-1.5 rounded-full bg-[var(--color-signal)]/80" />
                    02 // The Mindset
                  </span>
                </div>

                {/* Primary Headline with Word-Wrapping Safety */}
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold text-[var(--color-ink)] leading-snug tracking-tight break-words">
                  YOU DON&rsquo;T HAVE TO BE
                  <span className="text-[var(--color-signal)] block mt-1">
                    &lsquo;AN ENTREPRENEUR&rsquo; YET.
                  </span>
                </h3>

                {/* Subtitle / Framing */}
                <p className="mt-3.5 text-xs uppercase tracking-widest font-mono text-[var(--color-ink-muted)] font-semibold">
                  Three non-negotiable founder requisites:
                </p>

                {/* Bespoke Trait Rows */}
                <div className="mt-3 flex flex-col gap-2.5">
                  {mindsetTraits.map((trait, idx) => (
                    <div
                      key={idx}
                      className="border border-[var(--color-line)] bg-white px-3.5 py-2.5 flex items-center gap-3 shadow-sm transition-colors hover:border-[var(--color-signal)]/60"
                    >
                      <span className="font-mono text-[11px] font-bold text-[var(--color-signal)] bg-[var(--color-signal)]/10 px-2 py-0.5 shrink-0">
                        0{idx + 1}
                      </span>
                      <span className="text-xs sm:text-[13px] font-semibold text-[var(--color-ink)] tracking-tight">
                        {trait.replace(/^✓\s*/, '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* The Commitment Pledge Plaque */}
              <div className="mt-6 border border-[var(--color-signal)] bg-[var(--color-signal)] text-white p-3.5 text-center shadow-md">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#f8f4e9]/80 block mb-1">
                  Our Institutional Pledge
                </span>
                <p className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold text-white tracking-tight">
                  {pledgeText}
                </p>
              </div>
            </div>
          </Reveal>

          {/* ======================================================== */}
          {/* CARD 03: THE ENGINE (The KNEST Infrastructure)           */}
          {/* ======================================================== */}
          <Reveal delay={0.3} className="h-full">
            <div
              onMouseEnter={() => setHoveredCard(3)}
              onMouseLeave={() => setHoveredCard(null)}
              className="h-full bg-[var(--color-ink)] text-white border-2 border-[var(--color-ink)] p-6 sm:p-7 md:p-8 flex flex-col justify-between shadow-xl hover:border-[var(--color-signal)] hover:-translate-y-1 transition-all duration-300 relative group overflow-hidden"
            >
              {/* Watermark Roman Numeral — Clearer by default, highlights brightly on hover */}
              <span
                className={`absolute top-2 right-4 font-[family-name:var(--font-display)] text-7xl md:text-8xl font-black select-none pointer-events-none transition-all duration-300 ${
                  hoveredCard === 3
                    ? 'text-white/30 scale-105'
                    : 'text-white/12 scale-100'
                }`}
              >
                03
              </span>

              {/* Soft Ambient Brand Highlight Glow in Top Corner */}
              <div className="absolute -top-16 -right-16 size-48 bg-[var(--color-signal)]/25 rounded-full blur-2xl pointer-events-none" />

              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[var(--color-signal)]" />

              <div className="relative z-10">
                {/* Meta Header / Badge */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span
                    onMouseEnter={() => setHoveredCard(3)}
                    className="inline-flex items-center gap-2 border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-all duration-200 hover:border-white hover:bg-white/20 cursor-pointer"
                  >
                    <span className="size-1.5 rounded-full bg-[var(--color-signal)] animate-pulse" />
                    03 // The Engine
                  </span>
                </div>

                {/* Primary Headline with Word-Wrapping Safety */}
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold text-white leading-snug tracking-tight break-words">
                  KNEST IS THE INFRASTRUCTURE
                  <span className="text-[#e27d89] block mt-1">
                    FOR AMBITION.
                  </span>
                </h3>

                {/* Narrative Body */}
                <p className="mt-3.5 text-sm text-[var(--color-paper)]/75 font-light leading-relaxed">
                  {knestBody}
                </p>

                {/* 2x2 Architectural Capability Tiles */}
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {INFRA_PILLARS.map((pillar) => (
                    <div
                      key={pillar.title}
                      className="border border-white/15 bg-white/[0.05] p-2.5 sm:p-3 transition-colors hover:border-[var(--color-signal)] hover:bg-white/[0.09]"
                    >
                      <span className="font-mono text-[11px] sm:text-xs font-bold text-white block truncate">
                        {pillar.title}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-[var(--color-paper)]/65 font-light mt-0.5 block leading-tight">
                        {pillar.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Link Footer */}
              <div className="relative z-10 mt-6 pt-3.5 border-t border-white/10 flex items-center justify-between">
                <Link
                  href="/ecosystem"
                  className="font-mono text-xs font-bold text-white hover:text-[var(--color-signal)] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 group/link"
                >
                  <span>Explore Infrastructure</span>
                  <span className="group-hover/link:translate-x-1 transition-transform text-sm">→</span>
                </Link>
                <span className="font-mono text-[11px] font-bold text-[var(--color-signal)] bg-white/10 px-2 py-0.5">
                  15,000+ sq. ft.
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
