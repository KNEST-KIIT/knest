import React from 'react'
import Image from 'next/image'

export interface LogoProps {
  className?: string
  inverted?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export function Logo({ className = '', inverted = false, size = 'md' }: LogoProps) {
  const sizeClasses = {
    xs: 'h-4.5 sm:h-5',
    sm: 'h-5 sm:h-5.5',
    md: 'h-5.5 sm:h-6',
    lg: 'h-6.5 sm:h-7',
    xl: 'h-8 sm:h-9',
  }[size]

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <Image
        src={inverted ? '/images/knest_logo_white.png' : '/images/knest_logo.png'}
        alt="KNEST — KIIT University"
        width={325}
        height={123}
        className={`${sizeClasses} w-auto aspect-[650/246] object-contain transition-transform duration-200 hover:scale-[1.02]`}
        priority
      />
    </div>
  )
}
