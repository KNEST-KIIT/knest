import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const publicDir = path.resolve(import.meta.dirname, '../../../public')
const read = (file: string) => readFileSync(path.join(publicDir, file), 'utf8')

describe('web app manifest', () => {
  const manifest = JSON.parse(read('manifest.webmanifest')) as {
    start_url: string
    scope: string
    display: string
    icons: { src: string; sizes: string; purpose: string }[]
    name: string
    short_name: string
  }

  it('starts inside its own scope and is installable as a standalone app', () => {
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
    expect(manifest.display).toBe('standalone')
    expect(manifest.name.length).toBeGreaterThan(0)
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
  })

  it('has real 192 and 512 icons and a maskable one', () => {
    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) expect(existsSync(path.join(publicDir, icon.src)), icon.src).toBe(true)
  })
})

describe('service worker', () => {
  const source = read('sw.js')

  it('is plain script: no eval, no imports, no remote code', () => {
    expect(source).not.toMatch(/\beval\s*\(|new Function\s*\(|importScripts\s*\(|\bimport\s*\(|https?:\/\//)
  })

  it('parses', () => {
    expect(() => new vm.Script(source)).not.toThrow()
  })

  it('never intercepts the API and only keeps shell and static assets', () => {
    expect(source).toContain("url.pathname.startsWith('/api/')) return")
    expect(source).toContain("request.method !== 'GET'")
    // the only cache writes are the shell page, precache entries and static assets
    const puts = source.match(/cache\.(put|add)\(/g) ?? []
    expect(puts.length).toBeGreaterThan(0)
    expect(source).not.toMatch(/['"`]\/dashboard/)
  })

  it('only handles navigations to its own scope, matching the manifest', () => {
    const manifest = JSON.parse(read('manifest.webmanifest')) as { scope: string }
    expect(source).toContain(`const SHELL_PATH = '${manifest.scope}'`)
  })

  it('can wipe every cache it made', () => {
    expect(source).toContain("data.type === 'wipe'")
    expect(source).toContain("name.startsWith(CACHE_PREFIX)")
  })

  it('does not create IndexedDB stores itself', () => {
    expect(source).toContain('req.transaction.abort()')
  })

  it('precaches only files that exist', () => {
    const list = /const PRECACHE = \[([^\]]*)\]/.exec(source)?.[1] ?? ''
    const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) expect(existsSync(path.join(publicDir, f.replace(/^\//, ''))), f).toBe(true)
  })
})

describe('offline page', () => {
  it('is static, tells the person what to do, and links back to the app', () => {
    const html = read('offline.html')
    expect(html).toContain('/lab-device')
    expect(html).not.toMatch(/<script/i)
  })
})
