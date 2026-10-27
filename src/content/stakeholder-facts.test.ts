import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Tripwire for facts the stakeholder change list retired. Scans the application source (not tests, not seeds) so a
 * later edit cannot quietly bring one back:
 *  - the old school address and name (sld.kiit.ac.in, "School of Leadership", the SLD abbreviation);
 *  - the outdated application deadline of 16 February 2027, in any common spelling;
 *  - the second, bottom-of-page "request the brochure by email" call to action.
 * src/content/siel.ts is exempt because its comment records the rule itself.
 */

const SRC = path.resolve(import.meta.dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const files = walk(SRC).filter((file) => {
  const rel = path.relative(SRC, file).split(path.sep).join('/')
  return !/\.test\.tsx?$/.test(rel) && !rel.startsWith('db/') && !rel.startsWith('migrations/') && !rel.endsWith('payload-types.ts') && rel !== 'content/siel.ts'
})

const text = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
const offenders = (pattern: RegExp) => files.filter((file) => pattern.test(text.get(file)!)).map((file) => path.relative(SRC, file))

describe('retired stakeholder facts stay retired', () => {
  it('scans the application source', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('links nowhere to sld.kiit.ac.in', () => {
    expect(offenders(/sld\.kiit\.ac\.in/i)).toEqual([])
  })

  it('never calls the school the School of Leadership, or SLD', () => {
    // "School of Innovation & Entrepreneurial Leadership" is the name; the bare old name is not.
    expect(offenders(/School of Leadership/i)).toEqual([])
    expect(offenders(/\bSLD\b/)).toEqual([])
  })

  it('does not publish 16 February 2027 as an application deadline', () => {
    const spellings = /16(th)?\s+(of\s+)?Feb(ruary)?\.?,?\s+2027|Feb(ruary)?\.?\s+16(th)?,?\s+2027|2027-02-16|16[/.-]0?2[/.-]2027|2027[/.-]0?2[/.-]16/i
    expect(offenders(spellings)).toEqual([])
  })

  it('has no second brochure call to action asking for the brochure by email', () => {
    expect(offenders(/request (a|the) brochure/i)).toEqual([])
    expect(offenders(/brochure by e-?mail/i)).toEqual([])
  })
})
