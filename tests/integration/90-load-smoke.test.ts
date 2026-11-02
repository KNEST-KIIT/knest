import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BASE, captcha, closeDb, uniqueIp } from '../support/helpers'

/**
 * A load smoke test against the production build, to prove that ordinary traffic does not take the site down.
 * It is not a benchmark: the machine is shared and the database is a throwaway. What it asserts is the property
 * that mattered in the audit, that a burst of concurrent visitors gets answers (no 5xx, no hung request) and that
 * the connection pool recovers afterwards.
 *
 * Off by default. Run it with:
 *
 *   TEST_LOAD=on [TEST_CONTENT_CACHE=on] npx vitest run --config vitest.integration.config.mts tests/integration/90-load-smoke.test.ts
 */

const enabled = process.env.TEST_LOAD === 'on'
const CONCURRENCY = Number(process.env.TEST_LOAD_CONCURRENCY ?? 60)
const ROUNDS = Number(process.env.TEST_LOAD_ROUNDS ?? 4)

afterAll(closeDb)

/** The suite hides console output from passing tests, so the figures are also written where a person can read them. */
const REPORT = path.join(tmpdir(), 'knest-load-report.txt')
const report = (line: string) => {
  console.log(line)
  appendFileSync(REPORT, `${line}
`)
}

type Timed = { path: string; status: number; ms: number }

async function timed(path: string, init?: RequestInit): Promise<Timed> {
  const started = performance.now()
  try {
    const res = await fetch(`${BASE()}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000), ...init })
    await res.arrayBuffer()
    return { path, status: res.status, ms: performance.now() - started }
  } catch {
    return { path, status: 0, ms: performance.now() - started }
  }
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}

describe.skipIf(!enabled)('load smoke', () => {
  it('serves a burst of public traffic with no server errors and no hung requests', async () => {
    const paths = ['/', '/programs', '/events', '/mentors', '/startups', '/resources', '/search?q=a', '/about', '/api/health']
    const results: Timed[] = []
    const started = performance.now()
    for (let round = 0; round < ROUNDS; round++) {
      const burst = Array.from({ length: CONCURRENCY }, (_, i) => timed(paths[(i + round) % paths.length]!, { headers: { 'x-forwarded-for': uniqueIp() } }))
      results.push(...(await Promise.all(burst)))
    }
    const seconds = (performance.now() - started) / 1000
    const ms = results.map((r) => r.ms)
    const statuses = results.reduce<Record<number, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {})
    report(
      `LOAD public: ${results.length} requests, ${CONCURRENCY} at a time, ${seconds.toFixed(1)}s total (${(results.length / seconds).toFixed(0)} req/s); ` +
        `p50 ${percentile(ms, 50).toFixed(0)} ms, p95 ${percentile(ms, 95).toFixed(0)} ms, max ${Math.max(...ms).toFixed(0)} ms; statuses ${JSON.stringify(statuses)}; ` +
        `content cache ${process.env.TEST_CONTENT_CACHE === 'on' ? 'on' : 'off'}`,
    )
    const failures = results.filter((r) => r.status === 0 || r.status >= 500)
    expect(failures.map((f) => `${f.path} ${f.status}`), 'requests that errored or hung').toEqual([])
    expect(percentile(ms, 95)).toBeLessThan(15_000)
  }, 240_000)

  it('keeps the whole site responsive during a burst of sign-in attempts, and answers every one', async () => {
    // The property that matters: while many people sign in at once (each check is about half a second of CPU), the
    // rest of the site must keep answering. Probes run alongside the burst.
    const probes: Promise<Timed>[] = []
    const probing = (async () => {
      for (let i = 0; i < 24; i++) {
        probes.push(timed(i % 2 === 0 ? '/api/health' : '/about'))
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    })()
    const attempts = Array.from({ length: CONCURRENCY }, (_, i) =>
      timed('/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), origin: new URL(BASE()).origin },
        body: JSON.stringify({ email: `load-${i}@nobody.test`, password: 'not-the-password-1', ...captcha('login') }),
      }),
    )
    const results = await Promise.all(attempts)
    await probing
    const probed = await Promise.all(probes)
    report(`LOAD probes during the sign-in burst: ${probed.length} requests, max ${Math.max(...probed.map((p) => p.ms)).toFixed(0)} ms, statuses ${JSON.stringify(probed.map((p) => p.status))}`)
    expect(probed.filter((p) => p.status !== 200).map((p) => `${p.path} ${p.status}`), 'the rest of the site must keep answering').toEqual([])
    expect(Math.max(...probed.map((p) => p.ms)), 'no page may stall while sign-ins are processed').toBeLessThan(8_000)
    const statuses = results.reduce<Record<number, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {})
    report(`LOAD login: ${results.length} concurrent attempts, p95 ${percentile(results.map((r) => r.ms), 95).toFixed(0)} ms, statuses ${JSON.stringify(statuses)}`)
    // Every attempt gets an answer: a wrong password (401), a rate limit (429), or "busy, retry" (503). Never a hang.
    expect(results.filter((r) => ![401, 429, 503].includes(r.status)).map((r) => r.status)).toEqual([])

    // the pool must have recovered: health answers 200 straight away
    const health = await timed('/api/health')
    expect(health.status).toBe(200)
  }, 240_000)
})
