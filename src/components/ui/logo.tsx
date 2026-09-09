import React from 'react'
import Image from 'next/image'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <Image
        src="/logo.jpg"
        // Decorative: the only place this renders is inside a link already
        // labelled "KNEST home", so alt text here would be announced twice.
        alt=""
        width={150}
        height={150}
        className="h-10 w-auto object-contain mix-blend-multiply drop-shadow-sm"
        priority
      />
    </div>
  )
}
