import { describe, expect, it } from 'vitest'
import { likePattern, pageInfo, parsePage } from './pagination'

describe('parsePage', () => {
  it('accepts positive whole numbers and falls back to 1 for anything else', () => {
    expect(parsePage('3')).toBe(3)
    for (const bad of [undefined, null, '', '0', '-2', '1.5', 'abc', '99999999']) expect(parsePage(bad as string | undefined)).toBe(1)
  })
})

describe('pageInfo', () => {
  it('describes a middle page', () => {
    expect(pageInfo(60, 2, 25)).toEqual({ page: 2, pageSize: 25, total: 60, pages: 3, from: 26, to: 50 })
  })
  it('clamps a page past the end to the last page, and an empty list to page 1 of 1', () => {
    expect(pageInfo(60, 9, 25).page).toBe(3)
    expect(pageInfo(60, 9, 25).to).toBe(60)
    expect(pageInfo(0, 1, 25)).toEqual({ page: 1, pageSize: 25, total: 0, pages: 1, from: 0, to: 0 })
  })
})

describe('likePattern', () => {
  it('wraps the text and escapes LIKE metacharacters', () => {
    expect(likePattern(' ann ')).toBe('%ann%')
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%')
  })
})
