import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field, Input } from './field'

type FieldProps = React.ComponentProps<typeof Field>

function renderField(props: Omit<FieldProps, 'children'>): string {
  const fieldProps: FieldProps = {
    ...props,
    children: (controlProps) => React.createElement(Input, { ...controlProps, name: 'test' }),
  }
  return renderToStaticMarkup(React.createElement(Field, fieldProps))
}

describe('Field component aria-describedby wiring', () => {
  it('omits aria-describedby when neither hint nor error is present', () => {
    const html = renderField({ label: 'Test Label' })
    expect(html).not.toContain('aria-describedby')
  })

  it('links hintId when only hint is provided', () => {
    const html = renderField({ label: 'Test Label', hint: 'Helper text' })
    const match = html.match(/aria-describedby="([^"]+)"/)
    expect(match).not.toBeNull()
    const describedBy = match?.[1]
    if (!describedBy) throw new Error('Expected aria-describedby to reference the hint')
    expect(describedBy).toMatch(/-hint/)
    expect(html).toContain(`id="${describedBy}"`)
    expect(html).toContain('Helper text')
  })

  it('links errorId and marks aria-invalid when only error is provided', () => {
    const html = renderField({ label: 'Test Label', error: 'Required field' })
    const match = html.match(/aria-describedby="([^"]+)"/)
    expect(match).not.toBeNull()
    const describedBy = match?.[1]
    if (!describedBy) throw new Error('Expected aria-describedby to reference the error')
    expect(describedBy).toMatch(/-error/)
    expect(html).toContain(`id="${describedBy}"`)
    expect(html).toContain('Required field')
    expect(html).toContain('aria-invalid="true"')
  })

  it('preserves both hint and error IDs in aria-describedby without dangling references', () => {
    const html = renderField({ label: 'Test Label', hint: 'Helper text', error: 'Required field' })
    const match = html.match(/aria-describedby="([^"]+)"/)
    expect(match).not.toBeNull()
    const describedBy = match?.[1]
    if (!describedBy) throw new Error('Expected aria-describedby to reference the hint and error')
    const ids = describedBy.split(' ')
    expect(ids).toHaveLength(2)
    for (const id of ids) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain('Helper text')
    expect(html).toContain('Required field')
    expect(html).toContain('aria-invalid="true"')
  })
})
