import { copyFileSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { requireScopedAws } from '../../scripts/ops/require-scoped-aws.mjs'

describe('cutover AWS entry guards', () => {
  it.each([undefined, 'claude-deploy', 'invalid/profile'])('refuses profile %s before invoking AWS', (profile) => {
    let calls = 0
    expect(() => requireScopedAws(profile, () => { calls++; return '{}' })).toThrow(/scoped profile/)
    expect(calls).toBe(0)
  })

  it('refuses unknown or direct-user identities immediately after the sole identity read', () => {
    for (const Arn of ['arn:aws:iam::166917387892:root', 'arn:aws:iam::166917387892:user/operator', 'arn:aws:sts::000000000000:assumed-role/operator/test']) {
      const calls: string[][] = []
      expect(() => requireScopedAws('test', (_file, args) => { calls.push(args); return JSON.stringify({ Arn }) })).toThrow(/assumed role/)
      expect(calls.map((args) => args.slice(0, 2))).toEqual([['sts', 'get-caller-identity']])
    }
  })

  it('accepts the selected assumed role through an explicit profile identity read', () => {
    const calls: string[][] = []
    requireScopedAws('verified-role', (_file, args) => { calls.push(args); return JSON.stringify({ Arn: 'arn:aws:sts::166917387892:assumed-role/operator/test' }) })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('--profile')
    expect(calls[0]![calls[0]!.indexOf('--profile') + 1]).toBe('verified-role')
  })

  it.each(['cutover-preflight.sh', 'cutover-apply.sh'])('%s blocks the known root profile before any AWS subprocess', (script) => {
    const dir = mkdtempSync(join(tmpdir(), 'knest-dns-guard-'))
    const awsFile = join(dir, 'aws')
    const log = join(dir, 'calls')
    const init = join(dir, 'init.sh')
    const posix = (path: string) => path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_whole, drive: string) => '/' + drive.toLowerCase())
    // Bash finds this harmless stub if an entry point reads AWS before the guard.
    writeFileSync(awsFile, '#!/usr/bin/env bash\nprintf "attempt\\n" >> "$KNEST_TEST_AWS_LOG"\nprintf "None\\n"\n', { mode: 0o755 })
    writeFileSync(log, '')
    writeFileSync(init, `export PATH='${posix(dir).replaceAll("'", "'\\''")}':"$PATH"\n`)
    try {
      const result = spawnSync(process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash', [`scripts/ops/${script}`, 'aliases'], {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        env: { ...process.env, AWS_PROFILE: 'claude-deploy', BASH_ENV: posix(init), KNEST_TEST_AWS_LOG: posix(log) },
        encoding: 'utf8', timeout: 15_000,
      })
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(2)
      expect(result.stderr).toContain('scoped AWS role profile is required')
      expect(readFileSync(log, 'utf8')).toBe('')
    } finally {
      for (const file of [awsFile, log, init]) unlinkSync(file)
      rmdirSync(dir)
    }
  }, 20_000)

  it.each(['cutover-preflight.sh', 'cutover-apply.sh'])('%s binds every shell AWS call to the verified profile despite ambient credentials', (script) => {
    const dir = mkdtempSync(join(tmpdir(), 'knest-dns-profile-'))
    const awsFile = join(dir, 'aws')
    const log = join(dir, 'calls')
    const init = join(dir, 'init.sh')
    const apply = join(dir, 'cutover-apply.sh')
    const preflight = join(dir, 'cutover-preflight.sh')
    const posix = (path: string) => path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_whole, drive: string) => '/' + drive.toLowerCase())
    // This test isolates argument binding: mock the successful Node identity
    // check, then run only a harmless AWS stub, including apply's mutations.
    writeFileSync(awsFile, '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$KNEST_TEST_AWS_LOG"\ncase "$*" in\n*describe-stacks*) printf "Aliases\\tAcmCertificateArn\\tAccessHash\\n";;\n*list-certificates*) printf "arn:aws:acm:us-east-1:166917387892:certificate/fixture\\n";;\n*) printf "None\\n";;\nesac\n', { mode: 0o755 })
    writeFileSync(log, '')
    writeFileSync(init, `export PATH='${posix(dir).replaceAll("'", "'\\''")}':"$PATH"\nnode() { return 0; }\n`)
    copyFileSync(fileURLToPath(new URL('../../scripts/ops/cutover-apply.sh', import.meta.url)), apply)
    writeFileSync(preflight, '#!/usr/bin/env bash\nexit 0\n')
    try {
      const target = script === 'cutover-apply.sh' ? posix(apply) : `scripts/ops/${script}`
      const result = spawnSync(process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash', [target, 'aliases'], {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        env: { ...process.env, AWS_PROFILE: 'verified-role', AWS_ACCESS_KEY_ID: 'fixture-ambient-key', AWS_SECRET_ACCESS_KEY: 'fixture-ambient-secret', BASH_ENV: posix(init), KNEST_TEST_AWS_LOG: posix(log) },
        encoding: 'utf8', timeout: 15_000,
      })
      expect(result.error).toBeUndefined()
      const calls = readFileSync(log, 'utf8').trim().split('\n')
      expect(calls.length).toBeGreaterThan(1)
      expect(calls.every((call) => call.startsWith('--profile verified-role ')), calls.join('\n')).toBe(true)
      if (script === 'cutover-apply.sh') {
        expect(result.status, result.stderr).toBe(0)
        expect(calls.some((call) => call.includes('cloudformation create-change-set'))).toBe(true)
        expect(calls.some((call) => call.includes('cloudformation execute-change-set'))).toBe(true)
      }
    } finally {
      for (const file of [awsFile, log, init, apply, preflight]) unlinkSync(file)
      rmdirSync(dir)
    }
  }, 20_000)
})
