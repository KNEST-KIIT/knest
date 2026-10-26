import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'
import { Events } from './events'

type ValidateFn = (val: unknown, args?: { siblingData?: Record<string, unknown> }) => boolean | string | Promise<boolean | string>

function findField(fields: Field[], name: string): (Field & { validate?: ValidateFn }) | undefined {
  for (const f of fields) {
    if ('name' in f && f.name === name) return f as Field & { validate?: ValidateFn }
    if ('fields' in f && Array.isArray(f.fields)) {
      const nested = findField(f.fields, name)
      if (nested) return nested
    }
  }
  return undefined
}

describe('Events collection field validation', () => {
  const endsAtField = findField(Events.fields, 'endsAt')

  it('defines an endsAt field with validation', () => {
    expect(endsAtField).toBeDefined()
    expect(typeof endsAtField?.validate).toBe('function')
  })

  it('rejects end time before start time', () => {
    const start = '2026-11-01T10:00:00.000Z'
    const earlier = '2026-11-01T09:00:00.000Z'
    const result = endsAtField!.validate!(earlier, { siblingData: { startsAt: start } })
    expect(result).toBe('End time must be after start time.')
  })

  it('rejects end time exactly equal to start time', () => {
    const start = '2026-11-01T10:00:00.000Z'
    const result = endsAtField!.validate!(start, { siblingData: { startsAt: start } })
    expect(result).toBe('End time must be after start time.')
  })

  it('accepts end time strictly after start time', () => {
    const start = '2026-11-01T10:00:00.000Z'
    const later = '2026-11-01T11:00:00.000Z'
    const result = endsAtField!.validate!(later, { siblingData: { startsAt: start } })
    expect(result).toBe(true)
  })

  it('accepts missing or null end time', () => {
    expect(endsAtField!.validate!(null, { siblingData: { startsAt: '2026-11-01T10:00:00.000Z' } })).toBe(true)
    expect(endsAtField!.validate!(undefined, { siblingData: { startsAt: '2026-11-01T10:00:00.000Z' } })).toBe(true)
  })

  const regUrlField = findField(Events.fields, 'registrationUrl')

  it('defines registrationUrl with validation', () => {
    expect(regUrlField).toBeDefined()
    expect(typeof regUrlField?.validate).toBe('function')
  })

  it('accepts valid http and https registration URLs', () => {
    expect(regUrlField!.validate!('https://lu.ma/knest-workshop')).toBe(true)
    expect(regUrlField!.validate!('http://example.com/register')).toBe(true)
  })

  it('accepts empty or blank registration URLs', () => {
    expect(regUrlField!.validate!('')).toBe(true)
    expect(regUrlField!.validate!('   ')).toBe(true)
    expect(regUrlField!.validate!(null)).toBe(true)
    expect(regUrlField!.validate!(undefined)).toBe(true)
  })

  it('rejects non-http protocols and malformed registration URLs', () => {
    expect(regUrlField!.validate!('javascript:alert(1)')).toMatch(/absolute web link/i)
    expect(regUrlField!.validate!('ftp://files.example.com')).toMatch(/absolute web link/i)
    expect(regUrlField!.validate!('not a url')).toMatch(/valid absolute web address/i)
  })
})
