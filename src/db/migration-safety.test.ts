import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Migrations only move forward, and a release that fails its health check is rolled back to the previous
 * image, which then runs against the NEW schema (the old container also serves while the migration runs).
 * So a migration must not break the previous release: add things, never take away or tighten in the same
 * release that stops using them (expand now, contract in a later release).
 *
 * This test flags the statements that break an older release:
 *   - dropping a table, column, type or schema
 *   - renaming anything
 *   - changing a column's type
 *   - SET NOT NULL (an older insert that leaves the column out starts failing)
 *   - adding a NOT NULL column with no default
 *
 * A migration that really is the contract step (its code stopped using the thing in an earlier release) says so
 * with a line `-- knest:contract-ok <why it is safe>` (SQL) or `// knest:contract-ok <why>` (TypeScript).
 * The migrations that existed when this check was added are listed below and are not re-judged.
 */

const DESTRUCTIVE: { name: string; pattern: RegExp }[] = [
  { name: 'drops a table, column, type or schema', pattern: /\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA)\b/i },
  { name: 'renames something', pattern: /\bRENAME\s+(TO|COLUMN)\b/i },
  { name: 'changes a column type', pattern: /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i },
  { name: 'sets NOT NULL on an existing column', pattern: /\bSET\s+NOT\s+NULL\b/i },
]

const MARKER = /knest:contract-ok\s+\S+/

/** Migrations that predate this check. Anything new is judged. */
const BASELINE = new Set<string>(['20261009_083013_drop_cms_lab_bookings.ts'])

/** ADD COLUMN ... NOT NULL with no DEFAULT anywhere in the statement: an older release's INSERT leaves it out and fails. */
function addsRequiredColumnWithoutDefault(source: string): boolean {
  return source
    .split(/;|-->\s*statement-breakpoint/)
    .some((statement) => /\bADD\s+COLUMN\b/i.test(statement) && /\bNOT\s+NULL\b/i.test(statement) && !/\bDEFAULT\b/i.test(statement))
}

function findings(source: string): string[] {
  const found = DESTRUCTIVE.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name)
  if (addsRequiredColumnWithoutDefault(source)) found.push('adds a NOT NULL column with no default')
  return found
}

describe('migrations stay compatible with the previous release', () => {
  const drizzleDir = path.join(__dirname, 'migrations')
  const payloadDir = path.join(__dirname, '..', 'migrations')

  const drizzle = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql'))
  const payload = readdirSync(payloadDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')

  it('finds the migrations it is meant to check', () => {
    expect(drizzle.length).toBeGreaterThan(10)
    expect(payload.length).toBeGreaterThan(2)
  })

  for (const file of drizzle) {
    it(`SQL ${file}`, () => {
      const source = readFileSync(path.join(drizzleDir, file), 'utf8')
      if (MARKER.test(source)) return
      expect(findings(source), `${file} would break the previous release; mark it -- knest:contract-ok <why> if it is a deliberate contract step`).toEqual([])
    })
  }

  for (const file of payload) {
    it(`Payload ${file}`, () => {
      const source = readFileSync(path.join(payloadDir, file), 'utf8')
      // Only `up` runs on deploy; `down` is full of DROP statements by design.
      const up = source.slice(source.indexOf('export async function up'), source.includes('export async function down') ? source.indexOf('export async function down') : undefined)
      if (BASELINE.has(file) || MARKER.test(up)) return
      expect(findings(up), `${file} would break the previous release; mark it // knest:contract-ok <why> if it is a deliberate contract step`).toEqual([])
    })
  }

  it('the detector itself catches each kind of breaking change', () => {
    expect(findings('ALTER TABLE "x" DROP COLUMN "y";')).toHaveLength(1)
    expect(findings('DROP TABLE "x";')).toHaveLength(1)
    expect(findings('ALTER TABLE "x" RENAME COLUMN "a" TO "b";')).toHaveLength(1)
    expect(findings('ALTER TABLE "x" ALTER COLUMN "a" SET DATA TYPE integer;')).toHaveLength(1)
    expect(findings('ALTER TABLE "x" ALTER COLUMN "a" SET NOT NULL;')).toHaveLength(1)
    expect(findings('ALTER TABLE "x" ADD COLUMN "a" text NOT NULL;')).toHaveLength(1)
  })

  it('lets additive changes through', () => {
    expect(findings('ALTER TABLE "x" ADD COLUMN "a" text;')).toEqual([])
    expect(findings('ALTER TABLE "x" ADD COLUMN "a" text NOT NULL DEFAULT \'\';')).toEqual([])
    expect(findings('ALTER TABLE "x" ADD COLUMN "a" integer DEFAULT 48 NOT NULL;')).toEqual([])
    expect(findings('ALTER TABLE "x" ADD COLUMN "a" text[] DEFAULT \'{}\' NOT NULL;--> statement-breakpoint ALTER TABLE "x" ADD COLUMN "b" integer;')).toEqual([])
    expect(findings('CREATE TABLE "z" ("id" text PRIMARY KEY NOT NULL);')).toEqual([])
    expect(findings('CREATE INDEX "i" ON "x" ("a");')).toEqual([])
  })
})
