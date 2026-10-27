import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomeLink } from './home-link'

describe('HomeLink', () => {
  it('uses native navigation so browser beforeunload guards run once', () => {
    const html = renderToStaticMarkup(
      createElement(HomeLink, { 'aria-label': 'KNEST home', className: 'brand' }, 'KNEST'),
    )

    expect(html).toBe('<a href="/" aria-label="KNEST home" class="brand">KNEST</a>')
  })
})
