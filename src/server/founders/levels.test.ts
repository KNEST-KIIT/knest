import { describe, expect, it } from 'vitest'
import {
  CapabilityError,
  FOUNDER_LEVELS,
  MAX_LEVEL,
  MIN_LEVEL,
  capabilitiesFor,
  capabilityDeniedMessage,
  hasCapability,
  levelDefinition,
  levelRequiredFor,
  requireCapability,
  type Capability,
} from './levels'

describe('founder levels', () => {
  it('has exactly seven rungs, numbered 1 to 7 in order', () => {
    expect(FOUNDER_LEVELS).toHaveLength(7)
    expect(FOUNDER_LEVELS.map((entry) => entry.level)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('shares its seven keys with the journey_stage vocabulary', () => {
    // The two are different authorities over the same words. If this ever
    // diverges, a founder is being shown two different ladders.
    expect(FOUNDER_LEVELS.map((entry) => entry.key)).toEqual([
      'exploring',
      'idea',
      'validation',
      'mvp',
      'early_revenue',
      'scaling',
      'established',
    ])
  })

  /**
   * The rule that protects every existing account.
   *
   * `users.founderLevel` defaults to 1, so on the day this ships everyone is at
   * level 1. Nothing a signed-in person can already do — browse, register for
   * events, apply to a programme — is expressed as a capability, so levels can
   * only ever *add*. If someone later moves an existing freedom onto a rung,
   * this test is what stops the entire user base losing it silently.
   */
  it('grants nothing at level 1, so introducing levels takes nothing away', () => {
    expect(capabilitiesFor(1)).toEqual([])
  })

  it('is cumulative — every level keeps everything below it', () => {
    for (let level = MIN_LEVEL; level < MAX_LEVEL; level += 1) {
      const lower = capabilitiesFor(level)
      const higher = capabilitiesFor(level + 1)
      for (const capability of lower) {
        expect(higher).toContain(capability)
      }
    }
  })

  it('unlocks lab booking at exactly level 3', () => {
    expect(hasCapability(2, 'book_lab')).toBe(false)
    expect(hasCapability(3, 'book_lab')).toBe(true)
    expect(levelRequiredFor('book_lab')).toBe(3)
  })

  it('grants every capability exactly once across the ladder', () => {
    const all = FOUNDER_LEVELS.flatMap((entry) => entry.grants)
    expect(new Set(all).size).toBe(all.length)
  })

  it('clamps out-of-range levels instead of throwing', () => {
    // A bad column value should degrade a dashboard, never 500 it.
    expect(levelDefinition(0).level).toBe(1)
    expect(levelDefinition(99).level).toBe(7)
    expect(capabilitiesFor(-5)).toEqual([])
    expect(capabilitiesFor(99)).toEqual(capabilitiesFor(7))
  })

  it('requireCapability throws a 403 that names the level needed', () => {
    expect(() => requireCapability(3, 'book_lab')).not.toThrow()

    let thrown: unknown
    try {
      requireCapability(1, 'book_lab')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(CapabilityError)
    const error = thrown as CapabilityError
    expect(error.status).toBe(403)
    expect(error.requiredLevel).toBe(3)
    expect(error.currentLevel).toBe(1)

    const message = capabilityDeniedMessage(error)
    expect(message).toContain('level 3')
    expect(message).toContain('Validation')
    expect(message).toContain('Exploring')
  })

  it('names every capability in the denial copy', () => {
    // A capability added without copy would render "undefined unlocks at…".
    const all = FOUNDER_LEVELS.flatMap((entry) => entry.grants) as Capability[]
    for (const capability of all) {
      const message = capabilityDeniedMessage(new CapabilityError(capability, 7, 1))
      expect(message).not.toContain('undefined')
    }
  })
})
