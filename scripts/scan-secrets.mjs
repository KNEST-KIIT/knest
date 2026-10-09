#!/usr/bin/env node
// A small, dependency-free scan for credentials committed to the repository.
//
//   node scripts/scan-secrets.mjs            scan every tracked file (git ls-files)
//   node scripts/scan-secrets.mjs <files..>  scan the given files
//
// It looks for high-signal shapes only (cloud access keys, private key blocks, hosting
// and chat tokens), so a finding is almost always real and the scan can fail a build.
// It is a safety net, not a replacement for keeping secrets out of the repository and
// for rotating anything that was ever exposed.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const PATTERNS = [
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA)[0-9A-Z]{16}\b/ },
  { name: 'AWS secret access key assignment', re: /aws_secret_access_key["']?\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}\b/i },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Cloudflare Turnstile secret key', re: /\b0x4[A-Za-z0-9_-]{30,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
]

/** Strings that appear in public documentation and in tests; never a real credential. */
const ALLOWED = [/EXAMPLE/, /^AKIAIOSFODNN7/, /xxxxxxxx/i]

const SKIP_PATH = /(^|\/)(pnpm-lock\.yaml|node_modules|\.next|\.git)\//
const SKIP_EXT = /\.(png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|zip|gz|mp4)$/i

/** Returns [{ line, name }] for one file's text. Never returns the matched value. */
export function scanText(text) {
  const findings = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const { name, re } of PATTERNS) {
      const match = re.exec(lines[i])
      if (match && !ALLOWED.some((ok) => ok.test(match[0]))) findings.push({ line: i + 1, name })
    }
  }
  return findings
}

export function shouldScan(path) {
  return !SKIP_PATH.test(path + '/') && !SKIP_EXT.test(path) && !path.endsWith('pnpm-lock.yaml')
}

function main() {
  const given = process.argv.slice(2)
  const files = given.length
    ? given
    : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)
  let bad = 0
  for (const file of files.filter(shouldScan)) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (text.includes('\0')) continue
    for (const f of scanText(text)) {
      bad++
      // The value is deliberately not printed: a log is not a safe place for it.
      console.error(file + ':' + f.line + ': possible ' + f.name)
    }
  }
  if (bad) {
    console.error(bad + ' possible secret(s) found. Remove them, rotate anything real, and re-run.')
    process.exit(1)
  }
  console.log('No secrets found in ' + files.filter(shouldScan).length + ' files.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
