'use client'

import React from 'react'
import { useRowLabel, useFormFields } from '@payloadcms/ui'

const SECTION_LABELS: Record<string, string> = {
  hero: '01 — Hero: What if?',
  problem: '02 — The problem',
  person: '03 — The person',
  knest: '04 — What KNEST is',
  journey_selector: '05 — Journey selector',
  journey: '06 — The journey',
  offer: '07 — What you get',
  ecosystem: '08 — The ecosystem',
  startups: '09 — Built with KNEST',
  closing: '10 — Closing',
}

const DEFAULT_ORDER = [
  'hero',
  'problem',
  'person',
  'knest',
  'journey_selector',
  'journey',
  'offer',
  'ecosystem',
  'startups',
  'closing',
]

export const SectionRowLabel: React.FC<{ rowNumber?: number }> = (props) => {
  const { data, path, rowNumber: hookRowNumber } = useRowLabel<{ key?: string; enabled?: boolean }>()
  const formKey = useFormFields(([fields]) => (path ? (fields?.[`${path}.key`]?.value as string) : undefined))
  const formEnabled = useFormFields(([fields]) => (path ? (fields?.[`${path}.enabled`]?.value as boolean) : undefined))

  const key = data?.key ?? formKey
  const rowNum = props.rowNumber ?? hookRowNumber
  const sectionIndex =
    typeof rowNum === 'number'
      ? rowNum > 0 && rowNum <= DEFAULT_ORDER.length
        ? rowNum - 1
        : rowNum
      : undefined
  const defaultKey = sectionIndex !== undefined ? DEFAULT_ORDER[sectionIndex] : undefined

  const resolvedKey = key || defaultKey
  const identity =
    resolvedKey && SECTION_LABELS[resolvedKey]
      ? SECTION_LABELS[resolvedKey]
      : `Section ${String((rowNum ?? 0) + 1).padStart(2, '0')}`

  const isEnabled = (data?.enabled ?? formEnabled) !== false

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
      <span>{identity}</span>
      {!isEnabled && (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 400,
            padding: '0.1rem 0.4rem',
            borderRadius: 'var(--radius-sm, 0.25rem)',
            backgroundColor: 'var(--theme-elevation-150, #eee)',
            color: 'var(--theme-elevation-500, #666)',
          }}
        >
          hidden
        </span>
      )}
    </span>
  )
}
