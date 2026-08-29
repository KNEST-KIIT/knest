import { StatusBadge } from '@/components/ui'

const CONFIG = {
  open: { label: 'Open to requests', tone: 'positive' } as const,
  limited: { label: 'Limited availability', tone: 'caution' } as const,
  unavailable: { label: 'Not currently available', tone: 'neutral' } as const,
}

/** Unavailable mentors are always shown, never hidden — this badge is what makes that honest. */
export function AvailabilityBadge({ availability }: { availability: 'open' | 'limited' | 'unavailable' }) {
  return <StatusBadge status={availability} config={CONFIG} variant="pill" />
}
