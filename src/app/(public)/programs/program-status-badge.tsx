import { StatusBadge } from '@/components/ui'
import type { Program } from '@/payload/payload-types'

const CONFIG: Record<Program['applicationStatus'], { label: string; tone: 'signal' | 'caution' | 'neutral' | 'archive' }> = {
  open: { label: 'Applications open', tone: 'signal' },
  opening_soon: { label: 'Opens soon', tone: 'caution' },
  closed: { label: 'Closed', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'archive' },
}

export function ProgramStatusBadge({ status }: { status: Program['applicationStatus'] }) {
  return <StatusBadge status={status} config={CONFIG} variant="pill" />
}
