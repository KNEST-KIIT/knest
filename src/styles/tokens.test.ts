import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every `var(--token)` in the app must resolve to a token that exists.
 *
 * CSS custom properties fail silently: an undefined one resolves to nothing,
 * so `bg-[var(--color-paper-invert)]` is not an error, it is a transparent
 * background. That is how the journey section shipped rendering on the cream
 * page instead of the dark band it was written for, with its heading — set in
 * `--color-paper` — cream on cream at 1:1 contrast and invisible. Typecheck,
 * lint and the build were all green throughout.
 *
 * Nothing else in the toolchain looks at these names, so this test does.
 */

const SRC = 'src'

/* Injected at runtime by next/font (see src/styles/fonts.ts, which registers
   them as CSS variable names on <html>), so they are never declared in a
   stylesheet and are not typos. */
const RUNTIME_TOKENS = new Set(['--font-display-family', '--font-text-family'])

/* Set by Tailwind's own gradient utilities. */
const TAILWIND_TOKENS = new Set(['--tw-gradient-stops'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    // Test files are excluded: they quote token names in prose to explain
    // themselves, and a docstring is not a stylesheet reference.
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

const files = walk(SRC)

const declared = new Set<string>()
for (const file of files.filter((f) => f.endsWith('.css'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
    if (match[1]) declared.add(match[1])
  }
}

describe('design tokens', () => {
  it('declares every token the app references', () => {
    const missing = new Map<string, string[]>()

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        for (const match of line.matchAll(/var\((--[a-z0-9-]+)/g)) {
          const name = match[1]
          if (!name) continue
          if (declared.has(name) || RUNTIME_TOKENS.has(name) || TAILWIND_TOKENS.has(name)) continue
          const where = missing.get(name) ?? []
          where.push(`${file}:${i + 1}`)
          missing.set(name, where)
        }
      })
    }

    const report = [...missing]
      .map(([name, where]) => `  ${name}\n${where.map((w) => `    ${w}`).join('\n')}`)
      .join('\n')

    expect(report, `tokens referenced but never declared:\n${report}`).toBe('')
  })

  it('keeps --spacing at Tailwind’s 4px base unit', () => {
    /*
     * `--spacing` is the base unit every spacing and sizing utility
     * multiplies, not a step on a scale. It had been set to 0.5rem to express
     * an 8pt grid, which doubled the whole scale: `h-11` rendered at 88px,
     * `gap-12` at 96px, `md:px-10` at 80px. The journey section's ten-column
     * grid then needed 864px of gaps inside a 674px row, every column
     * computed to 0px, and the homepage scrolled sideways at tablet width.
     *
     * An 8pt rhythm is still available by picking even steps (`p-2`, `gap-6`,
     * `py-16`); it must not come from redefining the unit.
     */
    const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8')
    expect(tokens).toMatch(/--spacing:\s*0\.25rem/)
  })
})
