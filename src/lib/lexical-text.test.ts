import { describe, expect, it } from 'vitest'
import { lexicalToPlainText } from './lexical-text'

/** The shape Payload's Lexical editor actually stores. */
function doc(...paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [{ type: 'text', text }],
      })),
    },
  }
}

describe('lexicalToPlainText', () => {
  it('reads text out of a single paragraph', () => {
    expect(lexicalToPlainText(doc('No, you do not need an idea.'))).toBe('No, you do not need an idea.')
  })

  it('keeps paragraphs from running into one another', () => {
    expect(lexicalToPlainText(doc('First.', 'Second.'))).toBe('First. Second.')
  })

  it('reads nested formatting nodes', () => {
    const nested = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Applications close on ' },
              { type: 'link', children: [{ type: 'text', text: '1 April' }] },
              { type: 'text', text: '.' },
            ],
          },
        ],
      },
    }
    expect(lexicalToPlainText(nested)).toBe('Applications close on 1 April .')
  })

  it('truncates on a word boundary, not mid-word', () => {
    const long = lexicalToPlainText(doc('alpha bravo charlie delta echo foxtrot'), 20)
    expect(long.endsWith('…')).toBe(true)
    expect(long).toBe('alpha bravo charlie…')
  })

  it('leaves text at or under the limit alone', () => {
    expect(lexicalToPlainText(doc('short'), 20)).toBe('short')
  })

  it('returns an empty string rather than throwing on junk', () => {
    expect(lexicalToPlainText(null)).toBe('')
    expect(lexicalToPlainText(undefined)).toBe('')
    expect(lexicalToPlainText('a string')).toBe('')
    expect(lexicalToPlainText({ root: { type: 'root', children: 'not an array' } })).toBe('')
  })

  it('survives an unfamiliar node type instead of failing the search page', () => {
    const odd = { root: { type: 'root', children: [{ type: 'someFutureBlock', children: [{ type: 'text', text: 'still readable' }] }] } }
    expect(lexicalToPlainText(odd)).toBe('still readable')
  })
})
