import React from 'react'
import Image from 'next/image'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <Image
        src="/logo.jpg"
        /* Empty on purpose: every use of this sits inside a link or heading
           that already carries the name, and a described image inside a
           labelled link is announced twice. */
        alt=""
        width={150}
        height={150}
        className="h-10 w-auto object-contain mix-blend-multiply drop-shadow-sm"
        priority
      />
    </div>
  )
}
