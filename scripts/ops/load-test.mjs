#!/usr/bin/env node
/**
 * Deterministic HTTP load test for KNEST. No dependencies: Node 20+ only.
 *
 *   node scripts/ops/load-test.mjs --base=http://localhost:3000 --profile=smoke
 *   node scripts/ops/load-test.mjs --base=http://localhost:3000 --profile=peak --json=out.json
 *
 * Deterministic means: the request sequence is a fixed round-robin over the profile's paths, there
 * is no randomness, and the pass criteria are fixed thresholds. Latency itself still varies with
 * the machine, so the thresholds are stated per profile in docs/handover/LOAD-TEST.md.
 *
 * Only anonymous GET requests are sent: public pages and /api/health. It never signs in, never
 * writes, and never sends a header that would bypass an edge control.
 *
 * Safety: it refuses any host that is not local or private unless LOAD_TEST_ALLOW_REMOTE=1 is set,
 * and it must not be pointed at the AWS production distribution without the release owner's
 * written approval (DRILLS.md). Exit code 0 = pass, 1 = a criterion failed, 2 = bad usage.
 */

const PROFILES = {
  // Quick check that the harness and the app agree. Seconds, not minutes.
  smoke: { concurrency: 5, requests: 200, p95Ms: 1500, maxErrorRate: 0 },
  // DRILLS.md D7: 20 concurrent clients on a single t4g.small, public reads only.
  d7: { concurrency: 20, requests: 6000, p95Ms: 1500, maxErrorRate: 0.001 },
  // 50 concurrent users, the figure in S-1-SPEC.md (anonymous reads only in this script).
  peak: { concurrency: 50, requests: 5000, p95Ms: 1200, maxErrorRate: 0.005 },
  // Twice peak, to find the knee. Informational thresholds, looser on latency.
  stress: { concurrency: 100, requests: 10000, p95Ms: 3000, maxErrorRate: 0.02 },
}

const PATHS = ['/', '/programs', '/events', '/mentors', '/blog', '/about', '/contact', '/login', '/api/health']

function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg)
    if (m) out[m[1]] = m[2]
  }
  return out
}

function isLocalOrPrivate(hostname) {
  if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') return true
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

export function percentile(sortedAscending, p) {
  if (sortedAscending.length === 0) return 0
  const rank = Math.ceil((p / 100) * sortedAscending.length)
  return sortedAscending[Math.min(sortedAscending.length - 1, Math.max(0, rank - 1))]
}

export function evaluate(result, profile) {
  const failures = []
  if (result.errorRate > profile.maxErrorRate) failures.push(`error rate ${(result.errorRate * 100).toFixed(2)}% is over ${(profile.maxErrorRate * 100).toFixed(2)}%`)
  if (result.p95Ms > profile.p95Ms) failures.push(`p95 ${result.p95Ms.toFixed(0)} ms is over ${profile.p95Ms} ms`)
  if (result.rateLimited > 0) failures.push(`${result.rateLimited} requests were rate limited (429): the test is hitting a limiter, not the app`)
  return failures
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const base = args.base
  const profileName = args.profile ?? 'smoke'
  const profile = PROFILES[profileName]
  if (!base || !profile) {
    console.error('Usage: load-test.mjs --base=<url> [--profile=smoke|d7|peak|stress] [--json=<file>]')
    process.exit(2)
  }
  const url = new URL(base)
  if (!isLocalOrPrivate(url.hostname) && process.env.LOAD_TEST_ALLOW_REMOTE !== '1') {
    console.error(`Refusing to load ${url.hostname}: not a local or private address. Set LOAD_TEST_ALLOW_REMOTE=1 only with written approval.`)
    process.exit(2)
  }

  const durations = []
  const statusCounts = {}
  let errors = 0
  let rateLimited = 0
  let next = 0

  async function worker() {
    for (;;) {
      const i = next++
      if (i >= profile.requests) return
      const target = new URL(PATHS[i % PATHS.length], url)
      const started = performance.now()
      try {
        const res = await fetch(target, { redirect: 'manual' })
        await res.arrayBuffer()
        durations.push(performance.now() - started)
        statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1
        if (res.status === 429) rateLimited++
        // A redirect (3xx) is an answer; a 4xx or 5xx on these public paths is an error.
        if (res.status >= 400) errors++
      } catch {
        durations.push(performance.now() - started)
        errors++
        statusCounts.network = (statusCounts.network ?? 0) + 1
      }
    }
  }

  const wallStart = performance.now()
  await Promise.all(Array.from({ length: profile.concurrency }, worker))
  const wallMs = performance.now() - wallStart

  durations.sort((a, b) => a - b)
  const result = {
    base: url.origin,
    profile: profileName,
    concurrency: profile.concurrency,
    requests: durations.length,
    seconds: Number((wallMs / 1000).toFixed(2)),
    throughputPerSecond: Number((durations.length / (wallMs / 1000)).toFixed(1)),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.at(-1) ?? 0,
    errorRate: durations.length ? errors / durations.length : 1,
    rateLimited,
    statusCounts,
  }
  const failures = evaluate(result, profile)
  console.log(JSON.stringify({ ...result, pass: failures.length === 0, failures }, null, 2))
  if (args.json) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(args.json, JSON.stringify({ ...result, pass: failures.length === 0, failures }, null, 2))
  }
  process.exit(failures.length === 0 ? 0 : 1)
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
