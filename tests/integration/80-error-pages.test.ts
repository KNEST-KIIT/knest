import { describe, expect, it } from 'vitest'
import { get } from '../support/helpers'

describe('NF-08: an unknown URL gets the KNEST 404, not the framework default', () => {
  it.each(['/definitely-not-a-page', '/programs/does/not/exist/at/all', '/admin-but-not-really'])('%s', async (path) => {
    const res = await get(path)
    expect(res.status).toBe(404)
    const html = await res.text()
    expect(html).toContain('It may have moved, or the link may be wrong.')
    expect(html).toContain('href="/search"')
  })
})
