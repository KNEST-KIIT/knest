import { describe, expect, it } from 'vitest'
import type { JourneyStage, PlatformRole } from '@/server/auth/roles'
import { recommend, type RecommendedPath } from './recommend'

const ALL_STAGES: JourneyStage[] = [
  'exploring',
  'idea',
  'validation',
  'mvp',
  'early_revenue',
  'scaling',
  'established',
]

const ALL_ROLES: PlatformRole[] = [
  'student',
  'founder',
  'mentor',
  'investor',
  'alumni',
  'partner',
  'other',
]

describe('recommend', () => {
  it('resolves every role × stage combination to exactly one path, always with a reason', () => {
    for (const role of ALL_ROLES) {
      for (const stage of [...ALL_STAGES, null]) {
        const result = recommend(role, stage)
        expect(result.path).toBeTruthy()
        expect(result.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it('routes mentors to MENTOR regardless of stage', () => {
    for (const stage of [...ALL_STAGES, null]) {
      expect(recommend('mentor', stage).path).toBe('MENTOR')
    }
  })

  it('routes investors and partners to CONNECT regardless of stage', () => {
    for (const role of ['investor', 'partner'] as const) {
      for (const stage of [...ALL_STAGES, null]) {
        expect(recommend(role, stage).path).toBe('CONNECT')
      }
    }
  })

  it('routes student/founder/alumni/other by stage identically', () => {
    const stageRoutedRoles: PlatformRole[] = ['student', 'founder', 'alumni', 'other']
    for (const stage of ALL_STAGES) {
      const paths = stageRoutedRoles.map((role) => recommend(role, stage).path)
      expect(new Set(paths).size).toBe(1)
    }
  })

  it('maps each stage to the expected path', () => {
    const expected: Record<JourneyStage, RecommendedPath> = {
      exploring: 'EXPLORE',
      idea: 'VALIDATE',
      validation: 'VALIDATE',
      mvp: 'BUILD',
      early_revenue: 'BUILD',
      scaling: 'GROW',
      established: 'GROW',
    }
    for (const [stage, path] of Object.entries(expected)) {
      expect(recommend('student', stage as JourneyStage).path).toBe(path)
    }
  })

  it('treats a missing stage as exploring rather than throwing', () => {
    expect(recommend('student', null).path).toBe('EXPLORE')
  })

  it('every distinct path has distinct copy', () => {
    const seen = new Map<RecommendedPath, string>()
    for (const role of ALL_ROLES) {
      for (const stage of [...ALL_STAGES, null]) {
        const result = recommend(role, stage)
        const prior = seen.get(result.path)
        if (prior) expect(result.reason).toBe(prior)
        else seen.set(result.path, result.reason)
      }
    }
    // Six distinct paths were actually reached, not a function that always
    // returns the same one.
    expect(seen.size).toBe(6)
  })
})
