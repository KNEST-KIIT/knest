import { Tag } from '@/components/ui'
import type { Program } from '@/payload/payload-types'

const LABELS: Record<Program['applicationStatus'], string> = {
  open: 'Applications open',
  opening_soon: 'Opens soon',
  closed: 'Closed',
  in_progress: 'In progress',
}

const TONES: Record<Program['applicationStatus'], 'signal' | 'caution' | 'neutral' | 'archive'> = {
  open: 'signal',
  opening_soon: 'caution',
  closed: 'neutral',
  in_progress: 'archive',
}

export function ProgramStatusBadge({ status }: { status: Program['applicationStatus'] }) {
  return <Tag tone={TONES[status]}>{LABELS[status]}</Tag>
}
