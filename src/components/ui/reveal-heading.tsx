'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Heading } from './heading'

export function RevealHeading({
  children,
  className,
  size = 'display',
  as = 'h1',
  delay = 0,
}: {
  children: string
  className?: string
  size?: 'display' | 'title' | 'heading' | 'hero'
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  delay?: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-10% 0px' })
  
  const lines = children.split('\n')

  return (
    <Heading as={as as any} size={size as any} className={className}>
      <span ref={ref} className="block">
        {lines.map((line, i) => (
          <span key={i} className="block overflow-hidden">
            <motion.span
              className="block"
              data-reveal
              initial={{ y: '100%' }}
              animate={isInView ? { y: '0%' } : { y: '100%' }}
              transition={{ duration: 0.8, delay: delay + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </span>
    </Heading>
  )
}
