import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * scripts/ops/deploy-slot.sh, exercised with stand-in `docker`, `aws` and `sleep` commands that record what they were
 * asked to do. This proves the ORDER of operations, which is the whole point of a zero-downtime swap: the new slot is
 * proven healthy and in rotation before the old one is touched, and a failure leaves the old one exactly as it was.
 * It cannot prove the load balancer behaves; that needs the S-1 stack (docs/delivery/ZERO-DOWNTIME-DEPLOY.md).
 */

const script = path.resolve(__dirname, '..', 'scripts', 'ops', 'deploy-slot.sh')
const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' })
const haveBash = bash.status === 0 && bash.stdout.trim() === 'ok'
const haveTools = haveBash

function run(options: { running?: string[]; containerHealth?: string; targetHealth?: string }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'slot-'))
  const log = path.join(dir, 'calls.log')
  writeFileSync(log, '')
  const shim = (name: string, body: string) => {
    const file = path.join(dir, name)
    writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(file, 0o755)
  }
  shim(
    'docker',
    `echo "docker $*" >> "${log.replace(/\\/g, '/')}"
case "$1" in
  ps) echo 'CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES'; for n in $FAKE_RUNNING; do echo "abc123   img   cmd   1m   Up 1m   ports   $n"; done ;;
  inspect) echo '[]' ;;
  *) ;;
esac`,
  )
  shim(
    'aws',
    `echo "aws $*" >> "${log.replace(/\\/g, '/')}"
if [ "$2" = "describe-target-health" ]; then echo "$FAKE_TARGET_HEALTH"; fi`,
  )
  shim('sleep', `echo "sleep $*" >> "${log.replace(/\\/g, '/')}"`)
  // The real host has jq; here it only has to report the health the scenario wants, whatever `docker inspect` printed.
  shim('jq', 'cat > /dev/null; echo "$FAKE_CONTAINER_HEALTH"')

  const result = spawnSync('bash', [script.replace(/\\/g, '/'), 'knest:release'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir.replace(/\\/g, '/')}${path.delimiter}${process.env.PATH}`,
      TARGET_GROUP_ARN: 'arn:tg',
      INSTANCE_ID: 'i-123',
      FAKE_RUNNING: (options.running ?? []).join(' '),
      FAKE_CONTAINER_HEALTH: options.containerHealth ?? 'healthy',
      FAKE_TARGET_HEALTH: options.targetHealth ?? 'healthy',
      HEALTH_TRIES: '3',
      TARGET_TRIES: '3',
      DRAIN_SECONDS: '60',
    },
  })
  const calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
  const at = (needle: string) => calls.findIndex((c) => c.includes(needle))
  /** The last call that is exactly `call` (a name can be a prefix of another, and a slot is cleared before it is started). */
  const lastExact = (call: string) => calls.map((c, i) => (c === call ? i : -1)).filter((i) => i >= 0).pop() ?? -1
  return { ...result, calls, at, lastExact }
}

describe.skipIf(!haveTools)('deploy-slot.sh', () => {
  it('starts the release in the idle slot, brings it into rotation, and only then retires the old slot', () => {
    const r = run({ running: ['knest-a'] })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('live=knest-b')

    const started = r.at('docker run -d --name knest-b')
    const registered = r.at('register-targets')
    const healthy = r.at('describe-target-health')
    const deregistered = r.at('deregister-targets')
    const drained = r.calls.findIndex((c, i) => i > deregistered && c === 'sleep 60')
    const stopped = r.lastExact('docker rm -f knest-a')

    expect(started).toBeGreaterThanOrEqual(0)
    expect(registered).toBeGreaterThan(started)
    expect(healthy).toBeGreaterThan(registered)
    expect(deregistered).toBeGreaterThan(healthy)
    expect(drained).toBeGreaterThan(deregistered)
    expect(stopped).toBeGreaterThan(drained)
    expect(r.calls[started]).toContain('-p 3001:3000')
    expect(r.calls[deregistered]).toContain('Port=3000')
  })

  it('alternates slots: from b it goes to a, on port 3000', () => {
    const r = run({ running: ['knest-b'] })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('live=knest-a')
    expect(r.calls[r.at('docker run -d --name knest-a')]).toContain('-p 3000:3000')
    expect(r.lastExact('docker rm -f knest-b')).toBeGreaterThan(r.at('deregister-targets'))
  })

  it('treats the old single container as the live slot on the first swap', () => {
    const r = run({ running: ['knest'] })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('live=knest-b')
    expect(r.lastExact('docker rm -f knest')).toBeGreaterThan(r.at('deregister-targets'))
  })

  it('starts cleanly when nothing is running, with nothing to retire', () => {
    const r = run({ running: [] })
    expect(r.status, r.stderr).toBe(0)
    expect(r.calls.some((c) => c.includes('deregister-targets'))).toBe(false)
  })

  it('leaves the old slot untouched when the new container never becomes healthy', () => {
    const r = run({ running: ['knest-a'], containerHealth: 'starting' })
    expect(r.status).toBe(1)
    expect(r.calls.some((c) => c.includes('register-targets') && !c.includes('deregister'))).toBe(false)
    expect(r.calls.some((c) => c.includes('docker rm -f knest-a'))).toBe(false)
    expect(r.calls.some((c) => c.includes('deregister-targets') && c.includes('Port=3000'))).toBe(false)
    expect(r.lastExact('docker rm -f knest-b')).toBeGreaterThan(r.at('docker run -d --name knest-b'))
  })

  it('takes the new slot back out of rotation, and leaves the old one, when the load balancer never agrees', () => {
    const r = run({ running: ['knest-a'], targetHealth: 'unhealthy' })
    expect(r.status).toBe(1)
    const dereg = r.calls.filter((c) => c.includes('deregister-targets'))
    expect(dereg).toHaveLength(1)
    expect(dereg[0]).toContain('Port=3001')
    expect(r.calls.some((c) => c.includes('docker rm -f knest-a'))).toBe(false)
    expect(r.lastExact('docker rm -f knest-b')).toBeGreaterThan(r.at('deregister-targets'))
  })

  it('refuses to guess when both slots are running', () => {
    const r = run({ running: ['knest-a', 'knest-b'] })
    expect(r.status).toBe(3)
    expect(r.calls.some((c) => c.includes('docker run'))).toBe(false)
  })
})
