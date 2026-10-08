import { describe, expect, it } from 'vitest'
import { completionDestination, onboardingReturnPath, onboardingUrl, pathHref } from './destination'
import { recommend } from './recommend'

describe('pathHref', () => {
  it('sends every recommendable path to a page that exists', () => {
    const roles = ['student', 'founder', 'mentor', 'investor', 'partner', 'alumni', 'other'] as const
    const stages = [null, 'exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established'] as const
    for (const role of roles) {
      for (const stage of stages) {
        const { path } = recommend(role, stage)
        const href = pathHref(path, stage)
        expect(href, `${role}/${stage}`).toMatch(/^\/[a-z]/)
        expect(href).not.toContain('/profile') // no such page (HD-13)
      }
    }
  })

  it('keeps the stage on the programs link', () => {
    expect(pathHref('VALIDATE', 'idea')).toBe('/programs?stage=idea')
    expect(pathHref('BUILD', null)).toBe('/programs')
  })

  it('does not send a mentor to /programs or a missing page', () => {
    expect(pathHref('MENTOR', null)).toBe('/dashboard')
  })
})

describe('onboardingReturnPath (KN-14 / KN-22e)', () => {
  it('keeps a same-origin path', () => {
    expect(onboardingReturnPath('/apply/ignite')).toBe('/apply/ignite')
    expect(onboardingReturnPath('/programs?stage=idea')).toBe('/programs?stage=idea')
  })

  it('drops hostile and looping values', () => {
    for (const bad of ['//evil.example', 'https://evil.example', 'javascript:1', '/onboarding', '/onboarding?stage=idea', '', null, undefined]) {
      expect(onboardingReturnPath(bad as string | null)).toBeNull()
    }
  })
})

describe('completionDestination', () => {
  it('the application the person was heading to wins over the recommendation', () => {
    expect(completionDestination('/apply/ignite', 'VALIDATE', 'idea')).toBe('/apply/ignite')
  })

  it('without a return path, the recommended page is used', () => {
    expect(completionDestination(null, 'VALIDATE', 'idea')).toBe('/programs?stage=idea')
    expect(completionDestination(undefined, 'EXPLORE', 'exploring')).toBe('/events')
  })

  it('a hostile return path falls back to the recommendation, never to the attacker', () => {
    expect(completionDestination('//evil.example/x', 'BUILD', 'mvp')).toBe('/programs?stage=mvp')
  })
})

describe('onboardingUrl', () => {
  it('carries both the stage and the return path', () => {
    expect(onboardingUrl({ next: '/apply/ignite', stage: 'idea' })).toBe('/onboarding?stage=idea&next=%2Fapply%2Fignite')
  })
  it('is plain when there is nothing to carry', () => {
    expect(onboardingUrl({})).toBe('/onboarding')
    expect(onboardingUrl({ next: '//evil.example' })).toBe('/onboarding')
  })
})
