#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Identity format is a guard, not proof of the role's permission policy.
 * @param {string | undefined} profile
 * @param {(file: string, args: string[], options: import('node:child_process').ExecFileSyncOptionsWithStringEncoding) => string} [run]
 */
export function requireScopedAws(profile, run = execFileSync) {
  if (!profile || profile === 'claude-deploy' || !/^[A-Za-z0-9_+=,.@-]+$/.test(profile)) throw new Error('An explicit scoped profile is required; the documented root profile is prohibited.')
  const identity = JSON.parse(run('aws', ['sts', 'get-caller-identity', '--region', 'ap-south-1', '--profile', profile, '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }))
  if (!/^arn:aws:sts::166917387892:assumed-role\//.test(identity.Arn ?? '')) throw new Error('Expected an assumed role in the KNEST account.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireScopedAws(process.env.AWS_PROFILE)
  } catch {
    console.error('A verified scoped AWS role profile is required. Root, IAM-user and wrong-account sessions are refused; no resource action was attempted.')
    process.exitCode = 2
  }
}
