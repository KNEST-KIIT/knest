import { describe, expect, it } from 'vitest'
import { credentialsSchema, passwordSchema } from './validation'

describe('passwordSchema', () => {
  it('requires 12 characters and no more than the 72 bytes bcrypt actually reads', () => {
    expect(passwordSchema.safeParse('x'.repeat(11)).success).toBe(false)
    expect(passwordSchema.safeParse('x'.repeat(12)).success).toBe(true)
    expect(passwordSchema.safeParse('x'.repeat(72)).success).toBe(true)
    expect(passwordSchema.safeParse('x'.repeat(73)).success).toBe(false)
  })

  it('counts bytes, not characters', () => {
    // 25 three-byte characters is 75 bytes.
    expect(passwordSchema.safeParse('€'.repeat(25)).success).toBe(false)
    expect(passwordSchema.safeParse('€'.repeat(24)).success).toBe(true)
  })

  it('does not lock out an existing account whose password was set under the old limit', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.test', password: 'x'.repeat(150) }).success).toBe(true)
  })
})
