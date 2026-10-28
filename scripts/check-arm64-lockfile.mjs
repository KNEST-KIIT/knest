#!/usr/bin/env node
// Checks that pnpm-lock.yaml can produce a linux/arm64 image on Alpine (musl) without compiling anything: every native
// package resolved for Linux on x64 must have an arm64 twin of the same version (glibc to glibc, musl to musl).
// Docker is not needed. This is a proxy for the arm64 image build in .github/workflows/release-image.yml, which stays the
// final proof.
//
//   node scripts/check-arm64-lockfile.mjs            exit 0 when covered, 1 and a list when not
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** The `name@version` of every entry in the lockfile's `packages:` section (not the `snapshots:` section). */
export function parsePackages(lockText) {
  // The leading newline lets a section that starts the text be found like any other.
  const text = '\n' + lockText.replace(/\r\n/g, '\n')
  const start = text.indexOf('\npackages:\n')
  const end = text.indexOf('\nsnapshots:\n')
  const section = start === -1 ? '' : text.slice(start, end === -1 ? undefined : end)
  const ids = new Set()
  for (const line of section.split('\n')) {
    const match = line.match(/^ {2}'?((?:@[^/'\s]+\/)?[^@'\s/][^@'\s]*)@([^'\s:(]+)'?:$/)
    if (match) ids.add(`${match[1]}@${match[2]}`)
  }
  return ids
}

/** Linux x64 native builds that have no arm64 build of the same version. */
export function missingArm64Counterparts(lockText) {
  const packages = parsePackages(lockText)
  // A file this parser cannot read must never look like a file with nothing wrong in it.
  if (packages.size === 0) throw new Error('no packages found: this is not a pnpm lockfile the checker understands')
  const missing = []
  for (const id of packages) {
    const at = id.lastIndexOf('@')
    const name = id.slice(0, at)
    const version = id.slice(at + 1)
    if (!/linux/.test(name) || !/x64/.test(name)) continue
    const expected = `${name.replace('x64', 'arm64')}@${version}`
    if (!packages.has(expected)) missing.push({ x64: id, expected })
  }
  return missing
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8')
  const missing = missingArm64Counterparts(lock)
  if (missing.length === 0) {
    console.log(`ok: every Linux x64 native package in the lockfile (${parsePackages(lock).size} packages checked) has an arm64 twin`)
  } else {
    for (const m of missing) console.error(`missing arm64 build: ${m.x64} has no ${m.expected}`)
    process.exitCode = 1
  }
}
