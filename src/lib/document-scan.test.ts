import { describe, expect, it } from 'vitest'
import { attachedNames, isRejected, pollDelayMs, submissionBlockers, type ClientDocument } from './document-scan'

const doc = (fileName: string, scanStatus: ClientDocument['scanStatus']): ClientDocument => ({ fileName, scanStatus, message: '' })

describe('client view of a file’s malware check', () => {
  it('treats infected, unscannable and error as rejections, and pending and clean as not', () => {
    expect(['infected', 'unscannable', 'scan_error'].every((s) => isRejected(s as ClientDocument['scanStatus']))).toBe(true)
    expect(isRejected('pending')).toBe(false)
    expect(isRejected('clean')).toBe(false)
  })

  it('counts waiting and clean files as attached when resuming a draft, and never a rejected one', () => {
    expect(attachedNames({ a: doc('a.pdf', 'clean'), b: doc('b.pdf', 'pending'), c: doc('c.pdf', 'infected'), d: doc('d.pdf', 'scan_error'), e: doc('e.pdf', 'unscannable') })).toEqual({ a: 'a.pdf', b: 'b.pdf' })
  })

  it('lists what blocks a submission: files being checked, and files that failed', () => {
    expect(submissionBlockers({ a: doc('a.pdf', 'clean'), b: doc('b.pdf', 'pending'), c: doc('c.pdf', 'infected') })).toEqual({ waiting: ['b.pdf'], rejected: ['c.pdf'] })
    expect(submissionBlockers({ a: doc('a.pdf', 'clean') })).toEqual({ waiting: [], rejected: [] })
    expect(submissionBlockers({})).toEqual({ waiting: [], rejected: [] })
  })

  it('polls quickly at first and then more gently', () => {
    expect(pollDelayMs(0)).toBe(2000)
    expect(pollDelayMs(10)).toBe(4000)
    expect(pollDelayMs(100)).toBe(10000)
    expect(pollDelayMs(0)).toBeLessThan(pollDelayMs(10))
  })
})
