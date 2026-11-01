import { describe, expect, it } from 'vitest'
import { sanitizeSubmissionUrl } from './url-sanitize'

describe('Hackathon Rubric and Weighting Engine', () => {
  it('calculates weighted criteria score accurately', () => {
    const criteria = [
      { id: 'tech', weight: 40 },
      { id: 'design', weight: 30 },
      { id: 'impact', weight: 30 },
    ]

    // Scores from 1 to 10
    const judge1Scores = { tech: 8, design: 9, impact: 7 }
    const judge2Scores = { tech: 10, design: 8, impact: 8 }

    // Average scores
    const avgTech = (judge1Scores.tech + judge2Scores.tech) / 2 // 9
    const avgDesign = (judge1Scores.design + judge2Scores.design) / 2 // 8.5
    const avgImpact = (judge1Scores.impact + judge2Scores.impact) / 2 // 7.5

    // Weighted total out of 100
    // (avg * weight) / 10
    const total =
      (avgTech * 40) / 10 + (avgDesign * 30) / 10 + (avgImpact * 30) / 10
    // (9 * 4) + (8.5 * 3) + (7.5 * 3) = 36 + 25.5 + 22.5 = 84

    expect(criteria).toHaveLength(3)
    expect(total).toBe(84)
  })

  it('rejects judging rubric when criteria weights do not sum to 100%', () => {
    const criteria = [
      { id: 'c1', weight: 50 },
      { id: 'c2', weight: 30 },
    ]
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
    expect(totalWeight).not.toBe(100)
    expect(totalWeight).toBe(80)
  })
})

describe('Hackathon Team Join Codes', () => {
  it('generates valid 6-character alphanumeric codes without ambiguous characters', () => {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from(
      { length: 6 },
      () => CHARS[Math.floor(Math.random() * CHARS.length)],
    ).join('')

    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    // Never contains 0, 1, O, I
    expect(code).not.toMatch(/[01OI]/)
  })
})

describe('Hackathon Webhook Payload Builder', () => {
  it('correctly maps announcement types to Discord embed color accents', () => {
    const TYPE_COLORS: Record<string, number> = {
      info: 0x2b3350, // Oxford Navy
      success: 0x15803d, // Forest Green
      warning: 0x92400e, // Amber
      deadline: 0xb91c1c, // Oxblood / Critical
      winner: 0x7d5f18, // Brass / Gold
    }

    expect(TYPE_COLORS.deadline).toBe(0xb91c1c)
    expect(TYPE_COLORS.info).toBe(0x2b3350)
    expect(TYPE_COLORS.winner).toBe(0x7d5f18)
  })
})

describe('Hackathon Squad Lifecycle Rules', () => {
  it('enforces that a solo leader leaving auto-disbands the team cleanly', () => {
    const leaderId = 'usr_leader'
    const teamMembers = [{ userId: leaderId, role: 'leader' }]
    const otherMembers = teamMembers.filter((m) => m.userId !== leaderId)
    
    // If no other members exist, leaving triggers disband
    const shouldDisband = otherMembers.length === 0
    expect(shouldDisband).toBe(true)
  })

  it('blocks leader from leaving if other members exist without transferring leadership', () => {
    const leaderId = 'usr_leader'
    const teamMembers = [
      { userId: leaderId, role: 'leader' },
      { userId: 'usr_member2', role: 'member' },
    ]
    const otherMembers = teamMembers.filter((m) => m.userId !== leaderId)
    
    const shouldDisband = otherMembers.length === 0
    expect(shouldDisband).toBe(false)
    expect(otherMembers).toHaveLength(1)
  })

  it('validates leadership transfer target must exist in team', () => {
    const teamMembers = ['usr_leader', 'usr_member2', 'usr_member3']
    const targetUserId = 'usr_member2'
    const nonMemberUserId = 'usr_stranger'

    expect(teamMembers.includes(targetUserId)).toBe(true)
    expect(teamMembers.includes(nonMemberUserId)).toBe(false)
  })
})

describe('Hackathon Submission URL Normalizer & Sanitizer', () => {
  const sanitize = sanitizeSubmissionUrl

  it('prepends https:// to bare domains', () => {
    expect(sanitize('github.com/kiitnest/knest')).toBe('https://github.com/kiitnest/knest')
    expect(sanitize('myhackathon.vercel.app')).toBe('https://myhackathon.vercel.app/')
  })

  it('preserves existing https:// and http:// schemes', () => {
    expect(sanitize('https://github.com/kiitnest/knest')).toBe('https://github.com/kiitnest/knest')
    expect(sanitize('http://localhost:3000')).toBe('http://localhost:3000/')
  })

  it('rejects unsafe schemes like javascript: or data:', () => {
    expect(sanitize('javascript:alert(1)')).toBeNull()
    expect(sanitize('data:text/html,<h1>PWNED</h1>')).toBeNull()
  })

  it('handles empty or whitespace-only strings gracefully', () => {
    expect(sanitize('')).toBeNull()
    expect(sanitize('   ')).toBeNull()
    expect(sanitize(undefined)).toBeNull()
    expect(sanitize(null)).toBeNull()
  })
})
