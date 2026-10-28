import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { missingArm64Counterparts, parsePackages } from '../../scripts/check-arm64-lockfile.mjs'

/**
 * The production image is linux/arm64 on Alpine (musl), built by .github/workflows/release-image.yml under QEMU. Docker is
 * not available where this suite runs, so the build itself cannot be repeated here. What can be checked here, and what
 * most often breaks an arm64 image, is that every native package the lockfile resolves for Linux on x64 has an arm64 twin of
 * the same version (glibc to glibc, musl to musl), and that nothing needs compiling at install time. The image build in the
 * release workflow remains the final proof.
 */

const lock = readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8')

describe('arm64 coverage of the lockfile', () => {
  it('parses the packages section, scoped names and quoted keys included', () => {
    const packages = parsePackages(
      ["lockfileVersion: '9.0'", '', 'packages:', '', "  '@img/sharp-linuxmusl-x64@0.35.5':", '    resolution: {}', '', '  lightningcss-linux-arm64-musl@1.32.0:', '    resolution: {}', '', 'snapshots:', '', "  '@img/ignored@1.0.0':", ''].join('\n'),
    )
    expect([...packages].sort()).toEqual(['@img/sharp-linuxmusl-x64@0.35.5', 'lightningcss-linux-arm64-musl@1.32.0'])
  })

  it('reports an x64 Linux build with no arm64 twin of the same version, and accepts one that has it', () => {
    const broken = ['packages:', '', '  native-linux-x64-musl@2.0.0:', '', '  native-linux-x64-gnu@2.0.0:', '', '  native-linux-arm64-gnu@2.0.0:', '', 'snapshots:', ''].join('\n')
    expect(missingArm64Counterparts(broken)).toEqual([{ x64: 'native-linux-x64-musl@2.0.0', expected: 'native-linux-arm64-musl@2.0.0' }])
    const wrongVersion = ['packages:', '', '  native-linux-x64-musl@2.0.0:', '', '  native-linux-arm64-musl@1.9.0:', '', 'snapshots:', ''].join('\n')
    expect(missingArm64Counterparts(wrongVersion)).toHaveLength(1)
    const complete = ['packages:', '', '  native-linux-x64-musl@2.0.0:', '', '  native-linux-arm64-musl@2.0.0:', '', 'snapshots:', ''].join('\n')
    expect(missingArm64Counterparts(complete)).toEqual([])
  })

  it('refuses text it cannot read instead of reporting that nothing is missing', () => {
    expect(() => missingArm64Counterparts('')).toThrow(/not a pnpm lockfile/)
    expect(() => missingArm64Counterparts('lockfileVersion: 10\nimporters: {}\n')).toThrow(/not a pnpm lockfile/)
  })

  it('has an arm64 twin for every Linux x64 native package the lockfile resolves', () => {
    expect(parsePackages(lock).size).toBeGreaterThan(500)
    expect(missingArm64Counterparts(lock)).toEqual([])
  })

  it('has the musl arm64 builds the runtime image loads: sharp and its libvips, and the Next.js compiler', () => {
    const packages = [...parsePackages(lock)].map((id) => id.slice(0, id.lastIndexOf('@')))
    for (const name of ['@img/sharp-linuxmusl-arm64', '@img/sharp-libvips-linuxmusl-arm64', '@next/swc-linux-arm64-musl', 'lightningcss-linux-arm64-musl', '@tailwindcss/oxide-linux-arm64-musl']) {
      expect(packages, name).toContain(name)
    }
  })

  it('needs nothing compiled at install time: no package in the lockfile asks for a build step', () => {
    // pnpm 10 does not run dependency install scripts unless they are allowed, and the Alpine build stage has no compiler.
    expect(lock).not.toMatch(/requiresBuild:\s*true/)
  })
})
