'use client'

import { useState } from 'react'
import { Button } from './button'

export function RequestAccessButton({ spaceName }: { spaceName: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

  const handleRequest = async () => {
    setStatus('loading')
    // Simulate network request
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setStatus('success')
  }

  if (status === 'success') {
    return (
      <Button variant="ghost" size="sm" className="mt-4 text-green-600 bg-green-50 pointer-events-none w-max">
        <svg className="w-4 h-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Access Requested
      </Button>
    )
  }

  return (
    <Button 
      variant="secondary" 
      size="sm" 
      className="mt-4 w-max"
      onClick={handleRequest}
      disabled={status === 'loading'}
    >
      {status === 'loading' ? 'Requesting...' : 'Request Access'}
    </Button>
  )
}
