'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'

const PILLARS = {
  university: {
    num: '01',
    scope: 'INSTITUTIONAL LEADERSHIP',
    title: 'KIIT Deemed to be University',
    shortLabel: 'KIIT University',
    role: 'Academic excellence, university governance, accreditation backing, and strategic policy direction.',
  },
  schools: {
    num: '02',
    scope: 'ACADEMIC FACULTIES',
    title: 'Schools of KIIT',
    shortLabel: 'Schools of KIIT',
    role: 'Interdisciplinary talent, research centers, specialized hardware labs, and founder discovery across disciplines.',
  },
  partners: {
    num: '03',
    scope: 'INDUSTRY & ECOSYSTEM',
    title: 'Alumni & Corporate Partners',
    shortLabel: 'Corporate Partners',
    role: 'Market validation, corporate co-development, seed capital linkages, and operator-grade founder mentorship.',
  },
} as const

export function TripleHelix() {
  const [hoveredNode, setHoveredNode] = useState<'university' | 'schools' | 'partners' | null>(null)

  return (
    <div className="w-full">
      {/* High-Impact Visual Triangle Stage on Creamy Warm Parchment Background */}
      <div className="w-full bg-[#fbf8f0] border-2 border-[var(--color-line)] p-6 sm:p-10 md:p-14 relative shadow-xl overflow-visible">
        {/* Soft Ambient Oxblood Brand Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-[var(--color-signal)]/6 rounded-full blur-3xl pointer-events-none" />

        {/* Scalable Container for Triangle & Overlaid Nodes */}
        <div className="relative w-full max-w-[960px] mx-auto min-h-[580px] sm:min-h-[620px] flex items-center justify-center">
          {/* Big High-Visibility Vector SVG Triangle */}
          <svg
            viewBox="0 0 900 580"
            className="w-full h-auto drop-shadow-xl select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Default Inactive Arrowhead in Muted Oxford Navy */}
              <marker
                id="inactive-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#43415a" />
              </marker>

              {/* Active Directional Arrowhead in Bold KNEST Red */}
              <marker
                id="active-red-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#7a1f2b" />
              </marker>

              {/* Bold Authoritative KNEST Red Triangle Gradient */}
              <linearGradient id="triangle-bold-red" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7a1f2b" />
                <stop offset="35%" stopColor="#991b1b" />
                <stop offset="70%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#7a1f2b" />
              </linearGradient>

              {/* Crisp Inner Canvas Shading */}
              <radialGradient id="center-parchment-glow" cx="50%" cy="55%" r="48%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#fffdf9" />
                <stop offset="100%" stopColor="#f8f4e9" />
              </radialGradient>
            </defs>

            {/* Inner White/Parchment Core Field */}
            <polygon
              points="450,115 810,480 90,480"
              fill="url(#center-parchment-glow)"
              className="drop-shadow-sm"
            />

            {/* Architectural Blueprint Inner Parchment Gold Hairline */}
            <polygon
              points="450,138 784,462 116,462"
              fill="none"
              stroke="#ddd0a8"
              strokeWidth="2"
              strokeDasharray="6 4"
              opacity="0.75"
            />

            {/* Large Bold Primary KNEST Red Triangle Stroke (Maximum Visibility) */}
            <polygon
              points="450,115 810,480 90,480"
              fill="none"
              stroke="url(#triangle-bold-red)"
              strokeWidth="22"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="transition-all duration-300"
            />

            {/* Center Core: KIIT Nurturing Entrepreneurship & Student Talent in Bold Dark Navy Ink */}
            <g className="cursor-default pointer-events-none">
              <text
                x="450"
                y="282"
                textAnchor="middle"
                fill="#0d1321"
                fontFamily="var(--font-display), Georgia, serif"
                fontSize="56"
                fontWeight="900"
                letterSpacing="4"
              >
                KIIT
              </text>
              <text
                x="450"
                y="336"
                textAnchor="middle"
                fill="#0d1321"
                fontFamily="var(--font-display), Georgia, serif"
                fontSize="38"
                fontWeight="800"
                letterSpacing="1"
              >
                Nurturing
              </text>
              <text
                x="450"
                y="388"
                textAnchor="middle"
                fill="#0d1321"
                fontFamily="var(--font-display), Georgia, serif"
                fontSize="38"
                fontWeight="800"
                letterSpacing="1"
              >
                Entrepreneurship
              </text>
              <text
                x="450"
                y="436"
                textAnchor="middle"
                fill="#7a1f2b"
                fontFamily="var(--font-display), Georgia, serif"
                fontSize="34"
                fontWeight="800"
                letterSpacing="1"
              >
                &amp; Student Talent
              </text>
            </g>

            {/* Perimeter Directional Arrows (Clockwise Loop) */}
            {/* Edge 1: Right Side (Top -> Bottom-Right) */}
            <line
              x1="550"
              y1="120"
              x2="835"
              y2="430"
              stroke={hoveredNode === 'university' || hoveredNode === 'schools' ? '#7a1f2b' : '#43415a'}
              strokeWidth="3.5"
              markerEnd={hoveredNode === 'university' || hoveredNode === 'schools' ? 'url(#active-red-arrow)' : 'url(#inactive-arrow)'}
              strokeDasharray={hoveredNode === 'university' || hoveredNode === 'schools' ? 'none' : '8 6'}
              opacity={hoveredNode === 'university' || hoveredNode === 'schools' ? 1 : 0.45}
              className="transition-all duration-300"
            />

            {/* Edge 2: Bottom Side (Bottom-Right -> Bottom-Left) */}
            <line
              x1="700"
              y1="565"
              x2="200"
              y2="565"
              stroke={hoveredNode === 'schools' || hoveredNode === 'partners' ? '#7a1f2b' : '#43415a'}
              strokeWidth="3.5"
              markerEnd={hoveredNode === 'schools' || hoveredNode === 'partners' ? 'url(#active-red-arrow)' : 'url(#inactive-arrow)'}
              strokeDasharray={hoveredNode === 'schools' || hoveredNode === 'partners' ? 'none' : '8 6'}
              opacity={hoveredNode === 'schools' || hoveredNode === 'partners' ? 1 : 0.45}
              className="transition-all duration-300"
            />

            {/* Edge 3: Left Side (Bottom-Left -> Top) */}
            <line
              x1="65"
              y1="430"
              x2="350"
              y2="120"
              stroke={hoveredNode === 'partners' || hoveredNode === 'university' ? '#7a1f2b' : '#43415a'}
              strokeWidth="3.5"
              markerEnd={hoveredNode === 'partners' || hoveredNode === 'university' ? 'url(#active-red-arrow)' : 'url(#inactive-arrow)'}
              strokeDasharray={hoveredNode === 'partners' || hoveredNode === 'university' ? 'none' : '8 6'}
              opacity={hoveredNode === 'partners' || hoveredNode === 'university' ? 1 : 0.45}
              className="transition-all duration-300"
            />
          </svg>

          {/* ======================================================== */}
          {/* NODE 01: Top Apex (KIIT University) + Anchored Popover */}
          {/* ======================================================== */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 z-30"
            onMouseEnter={() => setHoveredNode('university')}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Interactive Node Button on Creamy Ground */}
            <div
              className={cn(
                'w-[280px] sm:w-[350px] p-3 sm:p-4 rounded-none text-center cursor-pointer transition-all duration-200 shadow-md',
                hoveredNode === 'university'
                  ? 'bg-[#f4e4e2] border-2 border-[var(--color-signal)] shadow-lg shadow-[rgba(122,31,43,0.15)]'
                  : 'bg-white border-2 border-[var(--color-line)] hover:border-[var(--color-signal)] hover:bg-[#f4e4e2]/40',
              )}
            >
              <p className="font-mono text-[11px] sm:text-xs font-bold text-[var(--color-signal)] tracking-widest uppercase">
                01 // {PILLARS.university.scope}
              </p>
              <h4 className="mt-1 font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold text-[var(--color-ink)] tracking-tight">
                {PILLARS.university.shortLabel}
              </h4>
            </div>

            {/* Popover Appearing Right There Below Node 01 */}
            <AnimatePresence>
              {hoveredNode === 'university' && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-[320px] sm:w-[380px] p-5 border-2 border-[var(--color-signal)] bg-white/98 backdrop-blur-2xl shadow-[0_20px_50px_rgba(13,19,33,0.2)] text-left pointer-events-none z-50 rounded-none"
                >
                  {/* Arrow pointing UP to Node 01 */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[8px] border-x-transparent border-b-[8px] border-b-[var(--color-signal)]" />

                  <span className="font-mono text-[10px] font-bold text-[var(--color-signal)] uppercase tracking-widest">
                    {PILLARS.university.num} // {PILLARS.university.scope}
                  </span>
                  <h5 className="mt-1.5 font-[family-name:var(--font-display)] text-lg sm:text-xl font-bold text-[var(--color-ink)]">
                    {PILLARS.university.title}
                  </h5>
                  <p className="mt-2 text-xs sm:text-sm text-[var(--color-ink-soft)] font-normal leading-relaxed">
                    {PILLARS.university.role}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] flex items-center justify-between text-[11px] font-mono font-semibold text-[var(--color-signal)]">
                    <span>REINFORCING NODE</span>
                    <span>→</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ========================================================== */}
          {/* NODE 02: Bottom-Right (Schools of KIIT) + Anchored Popover */}
          {/* ========================================================== */}
          <div
            className="absolute bottom-2 right-0 sm:right-2 z-30"
            onMouseEnter={() => setHoveredNode('schools')}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Popover Appearing Right There Above Node 02 */}
            <AnimatePresence>
              {hoveredNode === 'schools' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="absolute bottom-full mb-3 right-0 w-[320px] sm:w-[380px] p-5 border-2 border-[var(--color-signal)] bg-white/98 backdrop-blur-2xl shadow-[0_20px_50px_rgba(13,19,33,0.2)] text-left pointer-events-none z-50 rounded-none"
                >
                  {/* Arrow pointing DOWN to Node 02 */}
                  <div className="absolute -bottom-2 right-12 w-0 h-0 border-x-[8px] border-x-transparent border-t-[8px] border-t-[var(--color-signal)]" />

                  <span className="font-mono text-[10px] font-bold text-[var(--color-signal)] uppercase tracking-widest">
                    {PILLARS.schools.num} // {PILLARS.schools.scope}
                  </span>
                  <h5 className="mt-1.5 font-[family-name:var(--font-display)] text-lg sm:text-xl font-bold text-[var(--color-ink)]">
                    {PILLARS.schools.title}
                  </h5>
                  <p className="mt-2 text-xs sm:text-sm text-[var(--color-ink-soft)] font-normal leading-relaxed">
                    {PILLARS.schools.role}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] flex items-center justify-between text-[11px] font-mono font-semibold text-[var(--color-signal)]">
                    <span>REINFORCING NODE</span>
                    <span>→</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interactive Node Button on Creamy Ground */}
            <div
              className={cn(
                'w-[240px] sm:w-[300px] p-3 sm:p-4 rounded-none text-center cursor-pointer transition-all duration-200 shadow-md',
                hoveredNode === 'schools'
                  ? 'bg-[#f4e4e2] border-2 border-[var(--color-signal)] shadow-lg shadow-[rgba(122,31,43,0.15)]'
                  : 'bg-white border-2 border-[var(--color-line)] hover:border-[var(--color-signal)] hover:bg-[#f4e4e2]/40',
              )}
            >
              <p className="font-mono text-[11px] sm:text-xs font-bold text-[var(--color-signal)] tracking-widest uppercase">
                02 // {PILLARS.schools.scope}
              </p>
              <h4 className="mt-1 font-[family-name:var(--font-display)] text-lg sm:text-xl font-bold text-[var(--color-ink)] tracking-tight">
                {PILLARS.schools.shortLabel}
              </h4>
            </div>
          </div>

          {/* ============================================================== */}
          {/* NODE 03: Bottom-Left (Corporate Partners) + Anchored Popover */}
          {/* ============================================================== */}
          <div
            className="absolute bottom-2 left-0 sm:left-2 z-30"
            onMouseEnter={() => setHoveredNode('partners')}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Popover Appearing Right There Above Node 03 */}
            <AnimatePresence>
              {hoveredNode === 'partners' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="absolute bottom-full mb-3 left-0 w-[320px] sm:w-[380px] p-5 border-2 border-[var(--color-signal)] bg-white/98 backdrop-blur-2xl shadow-[0_20px_50px_rgba(13,19,33,0.2)] text-left pointer-events-none z-50 rounded-none"
                >
                  {/* Arrow pointing DOWN to Node 03 */}
                  <div className="absolute -bottom-2 left-12 w-0 h-0 border-x-[8px] border-x-transparent border-t-[8px] border-t-[var(--color-signal)]" />

                  <span className="font-mono text-[10px] font-bold text-[var(--color-signal)] uppercase tracking-widest">
                    {PILLARS.partners.num} // {PILLARS.partners.scope}
                  </span>
                  <h5 className="mt-1.5 font-[family-name:var(--font-display)] text-lg sm:text-xl font-bold text-[var(--color-ink)]">
                    {PILLARS.partners.title}
                  </h5>
                  <p className="mt-2 text-xs sm:text-sm text-[var(--color-ink-soft)] font-normal leading-relaxed">
                    {PILLARS.partners.role}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] flex items-center justify-between text-[11px] font-mono font-semibold text-[var(--color-signal)]">
                    <span>REINFORCING NODE</span>
                    <span>→</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interactive Node Button on Creamy Ground */}
            <div
              className={cn(
                'w-[240px] sm:w-[300px] p-3 sm:p-4 rounded-none text-center cursor-pointer transition-all duration-200 shadow-md',
                hoveredNode === 'partners'
                  ? 'bg-[#f4e4e2] border-2 border-[var(--color-signal)] shadow-lg shadow-[rgba(122,31,43,0.15)]'
                  : 'bg-white border-2 border-[var(--color-line)] hover:border-[var(--color-signal)] hover:bg-[#f4e4e2]/40',
              )}
            >
              <p className="font-mono text-[11px] sm:text-xs font-bold text-[var(--color-signal)] tracking-widest uppercase">
                03 // {PILLARS.partners.scope}
              </p>
              <h4 className="mt-1 font-[family-name:var(--font-display)] text-lg sm:text-xl font-bold text-[var(--color-ink)] tracking-tight">
                {PILLARS.partners.shortLabel}
              </h4>
            </div>
          </div>
        </div>

        {/* Academic Citation at the Base */}
        <div className="mt-6 pt-4 border-t border-[var(--color-line)] text-center">
          <p className="text-xs font-mono text-[var(--color-ink-muted)] leading-relaxed max-w-4xl mx-auto">
            Etzkowitz, H., &amp; Leydesdorff, L. (1995). The Triple Helix — University-Industry-Government Relations: A Laboratory for Knowledge-Based Economic Development.
          </p>
        </div>
      </div>
    </div>
  )
}

