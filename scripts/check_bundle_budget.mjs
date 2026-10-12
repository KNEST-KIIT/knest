#!/usr/bin/env node
/**
 * Deterministic bundle budget (module 52). Reads the output of `next build`
 * and fails when the client JavaScript or CSS grows past the limits in
 * scripts/bundle-budget.json.
 *
 * It measures bytes on disk after gzip level 9 of every file in
 * .next/static/chunks and .next/static/css. That is a pure function of the
 * build output: no network, no browser, no timing, so it cannot flake. It is
 * not a Lighthouse score and does not claim to predict one; it stops a bundle
 * from quietly doubling.
 *
 * Usage: node scripts/check_bundle_budget.mjs [--print]
 *   --print  show the numbers and exit 0 (use when re-basing the budget)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const staticDir = join(root, '.next', 'static')
const budget = JSON.parse(readFileSync(join(root, 'scripts', 'bundle-budget.json'), 'utf8'))
const printOnly = process.argv.includes('--print')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

if (!existsSync(staticDir)) {
  console.error('No .next/static found. Run `pnpm build` first.')
  process.exit(2)
}

const files = walk(staticDir)
const gz = (path) => gzipSync(readFileSync(path), { level: 9 }).length
const js = files.filter((f) => f.endsWith('.js'))
const css = files.filter((f) => f.endsWith('.css'))

const totals = {
  jsGzipBytes: js.reduce((n, f) => n + gz(f), 0),
  cssGzipBytes: css.reduce((n, f) => n + gz(f), 0),
  largestJsChunkGzipBytes: Math.max(0, ...js.map(gz)),
}

let failed = false
for (const [key, value] of Object.entries(totals)) {
  const limit = budget[key]
  const over = typeof limit === 'number' && value > limit
  if (over) failed = true
  console.log(`${over ? 'FAIL' : 'ok  '} ${key}: ${value} bytes${typeof limit === 'number' ? ` (limit ${limit})` : ''}`)
}

if (printOnly) process.exit(0)
if (failed) {
  console.error('\nBundle budget exceeded. Reduce the bundle, or raise scripts/bundle-budget.json with a reason in the commit message.')
  process.exit(1)
}
