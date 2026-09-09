import { describe, expect, it } from 'vitest'
import { canManageSpace, isAnySpaceManager, managerEmails } from './access'

const LAB = {
  managers: [
    { email: 'prof.mishra@kiit.ac.in', name: 'Dr Mishra' },
    { email: 'lab.tech@kiit.ac.in', name: null },
  ],
}

describe('canManageSpace', () => {
  it('lets a listed manager through', () => {
    expect(canManageSpace({ email: 'prof.mishra@kiit.ac.in' }, LAB)).toBe(true)
  })

  it('ignores case and surrounding space on both sides', () => {
    expect(canManageSpace({ email: '  Prof.Mishra@KIIT.ac.in ' }, LAB)).toBe(true)
    expect(
      canManageSpace({ email: 'prof.mishra@kiit.ac.in' }, { managers: [{ email: ' PROF.MISHRA@kiit.ac.in ' }] }),
    ).toBe(true)
  })

  it('keeps everyone else out, staff included', () => {
    expect(canManageSpace({ email: 'someone@kiit.ac.in' }, LAB)).toBe(false)
    // A reviewer runs the applications queue; that is not this room.
    expect(canManageSpace({ email: 'someone@kiit.ac.in', staffRole: 'reviewer' }, LAB)).toBe(false)
    expect(canManageSpace({ email: 'someone@kiit.ac.in', staffRole: 'program_manager' }, LAB)).toBe(false)
  })

  it('lets a super admin through, so a lab whose manager left is not stuck', () => {
    expect(canManageSpace({ email: 'admin@knest.local', staffRole: 'super_admin' }, LAB)).toBe(true)
  })

  it('is false for a space with no managers, rather than open', () => {
    expect(canManageSpace({ email: 'anyone@kiit.ac.in' }, { managers: [] })).toBe(false)
    expect(canManageSpace({ email: 'anyone@kiit.ac.in' }, { managers: null })).toBe(false)
  })

  it('is false when there is no user or no space', () => {
    expect(canManageSpace(null, LAB)).toBe(false)
    expect(canManageSpace({ email: 'prof.mishra@kiit.ac.in' }, null)).toBe(false)
    expect(canManageSpace({ email: '' }, LAB)).toBe(false)
  })
})

describe('managerEmails', () => {
  it('normalises and drops blanks', () => {
    expect(managerEmails({ managers: [{ email: ' A@B.COM ' }, { email: '' }] })).toEqual(['a@b.com'])
    expect(managerEmails({ managers: null })).toEqual([])
  })
})

describe('isAnySpaceManager', () => {
  it('is true for someone who manages one of them', () => {
    expect(isAnySpaceManager({ email: 'lab.tech@kiit.ac.in' }, [{ managers: [] }, LAB])).toBe(true)
  })

  it('is false for someone who manages none', () => {
    expect(isAnySpaceManager({ email: 'nobody@kiit.ac.in' }, [LAB])).toBe(false)
  })

  it('is true for a super admin even when the list is empty', () => {
    // They manage every space, so asking the list would wrongly answer no.
    expect(isAnySpaceManager({ email: 'admin@knest.local', staffRole: 'super_admin' }, [])).toBe(true)
  })
})
