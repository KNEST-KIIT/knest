import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Content-honesty gate (KN-01 / KN-18).
 *
 * KNEST's founding rule (PRODUCT_ARCHITECTURE section 6) is that nothing public
 * is invented. This scans application source for the two ways that rule was
 * broken: substitute records (FALLBACK_* data) and claims that no approved
 * source supports. It is a tripwire, not a copy review: a phrase leaving this
 * list needs the copy approver (HD-04), and a phrase joining it needs a reason.
 */

const SRC = path.resolve(import.meta.dirname)

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

const files = walk(SRC).filter((f) => {
  const rel = path.relative(SRC, f).split(path.sep).join('/')
  return (
    !/\.test\.tsx?$/.test(rel) &&
    !rel.startsWith('db/') && // seeds: fictional, local-only, refused in production
    !rel.endsWith('payload-types.ts')
  )
})

const read = (f: string) => readFileSync(f, 'utf8')

describe('content honesty gate', () => {
  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('has no substitute-record constants (FALLBACK_*), apart from the approved static homepage copy', () => {
    const offenders: string[] = []
    for (const f of files) {
      for (const m of read(f).matchAll(/\bFALLBACK_[A-Z_]+\b/g)) {
        if (m[0] !== 'FALLBACK_HOMEPAGE') offenders.push(`${path.relative(SRC, f)}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  const BANNED: [string, RegExp][] = [
    ['the capital is waiting', /the capital is waiting/i],
    ['"most dangerous thing" hero', /most dangerous thing/i],
    ['cloud credits', /cloud credits/i],
    ['developer credits', /developer credits/i],
    ['co-founder matchmaking', /matchmaking/i],
    ['"Top Tier" ranking', /top tier/i],
    ['"100% incubation pipeline"', /100% incubation/i],
    ['"Campus Labs are Open"', /campus labs are open/i],
    ['"Founder Portal"', /founder portal/i],
    ['"The KNEST Guarantee"', /knest guarantee/i],
    ['"Institutional Pledge"', /institutional pledge/i],
    ['"15,000+" / "Over 15,000" floor area', /(15,000\+|over 15,000)/i],
    ['"World-Class Facilities"', /world-class/i],
    ['invented founder story', /hostel dorm/i],
    ['invented mentor (Sarah Chen)', /sarah chen/i],
    ['invented organisation (Scale AI)', /scale ai/i],
    ['invented organisation (Sequoia)', /sequoia/i],
    ['unapproved "direct grants"', /direct grants/i],
  ]

  for (const [label, pattern] of BANNED) {
    it(`contains no ${label}`, () => {
      const hits = files.filter((f) => pattern.test(read(f))).map((f) => path.relative(SRC, f))
      expect(hits).toEqual([])
    })
  }
})
