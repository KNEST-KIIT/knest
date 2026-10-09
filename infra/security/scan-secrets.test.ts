import { describe, expect, it } from 'vitest'
import { scanText, shouldScan } from '../../scripts/scan-secrets.mjs'

// The fake credentials are assembled at run time so this file does not itself look like a leak.
const realShapedAwsKey = 'AK' + 'IA' + 'Z7Q4MWD2HBN6XJKP' // 4 + 16 characters
const privateKey = '-----BEGIN ' + 'RSA PRIVATE KEY-----'
const githubToken = 'gh' + 'p_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const turnstile = '0x4' + 'AAAAAAABcdefGHIJklmnOPQRstuVWX_-yz12'

describe('scanText', () => {
  it('flags credential shapes by name and never returns the value', () => {
    const findings = scanText(['const a = 1', 'aws=' + realShapedAwsKey, privateKey, 'token=' + githubToken, 'k=' + turnstile].join('\n'))
    expect(findings.map((f: { name: string }) => f.name)).toEqual([
      'AWS access key id',
      'private key block',
      'GitHub token',
      'Cloudflare Turnstile secret key',
    ])
    expect(JSON.stringify(findings)).not.toContain(realShapedAwsKey)
    expect(findings[0]?.line).toBe(2)
  })

  it('ignores the keys published in AWS documentation and obvious placeholders', () => {
    expect(scanText('AK' + 'IAIOSFODNN7' + 'EXAMPLE')).toEqual([])
    expect(scanText('key = AK' + 'IA' + 'X'.repeat(16))).toEqual([])
  })

  it('does not flag ordinary code, prose or long identifiers', () => {
    expect(scanText('const secretName = "knest-production/auth-secret"\n// the access key is never stored')).toEqual([])
    expect(scanText('sha256:' + 'a'.repeat(64))).toEqual([])
  })
})

describe('shouldScan', () => {
  it('skips dependencies, build output, the lockfile and binaries', () => {
    for (const p of ['node_modules/x/index.js', '.next/server/a.js', 'pnpm-lock.yaml', 'public/auth-cover.jpg']) expect(shouldScan(p), p).toBe(false)
    for (const p of ['src/server/env.ts', '.github/workflows/ci.yml', 'infra/cfn/app.yaml']) expect(shouldScan(p), p).toBe(true)
  })
})
