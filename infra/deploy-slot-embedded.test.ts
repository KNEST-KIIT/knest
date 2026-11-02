import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { currentEmbedded, embeddedBlock } from '../scripts/sync-deploy-slot.mjs'

/**
 * The zero-downtime swap lives in scripts/ops/deploy-slot.sh and is pasted into the deploy document, which cannot
 * include another file. These tests keep the two identical, keep the script free of the one construct that would break
 * inside an SSM document, and syntax-check the whole document script, so a bad edit is found here and not during a deploy.
 */

const root = path.resolve(__dirname, '..')
const template = readFileSync(path.join(root, 'infra', 'cfn', 'app.yaml'), 'utf8')
const script = readFileSync(path.join(root, 'scripts', 'ops', 'deploy-slot.sh'), 'utf8')

const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' })
const haveBash = bash.status === 0 && bash.stdout.trim() === 'ok'

describe('deploy-slot.sh inside the deploy document', () => {
  it('is identical to the file (run: node scripts/sync-deploy-slot.mjs)', () => {
    const { text, bodyStart, bodyEnd } = currentEmbedded(template)
    expect(text.slice(bodyStart, bodyEnd)).toBe(embeddedBlock(script))
  })

  it('contains no pair of opening braces, which SSM would read as a parameter placeholder', () => {
    expect(script).not.toContain('{{')
  })

  it('is off unless the stack parameter says on, and the in-place deploy is still the default path', () => {
    const lf = template.split('\r\n').join('\n')
    expect(lf).toMatch(/ZeroDowntimeDeploy:\n {4}Type: String\n {4}Default: 'off'/)
    expect(lf).toContain('param zero-downtime-deploy 2>/dev/null || echo off')
    // the original in-place replacement is still there, after the optional branch
    expect(lf.indexOf('param zero-downtime-deploy')).toBeLessThan(lf.indexOf('docker rm -f knest >/dev/null 2>&1 || true'))
  })

  it.skipIf(!haveBash)('leaves the whole deploy script syntactically valid', () => {
    const lf = template.split('\r\n').join('\n')
    const start = lf.indexOf('                - |\n                  set -euo pipefail\n                  ENVIRONMENT="{{ Environment }}"')
    expect(start).toBeGreaterThan(0)
    const bodyStart = lf.indexOf('\n', start) + 1
    const end = lf.indexOf('\n\n  # ----', bodyStart)
    const body = lf
      .slice(bodyStart, end)
      .split('\n')
      .map((line) => (line.startsWith(' '.repeat(18)) ? line.slice(18) : line.trimStart() === '' ? '' : line))
      .join('\n')
      .replace(/\{\{\s*[A-Za-z]+\s*\}\}/g, '1234')
    const dir = mkdtempSync(path.join(tmpdir(), 'doc-'))
    const file = path.join(dir, 'deploy.sh').replace(/\\/g, '/')
    writeFileSync(file, body)
    const check = spawnSync('bash', ['-n', file], { encoding: 'utf8' })
    expect(check.stderr).toBe('')
    expect(check.status).toBe(0)
  })
})
