import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workflow = parse(readFileSync(new URL('../../.github/workflows/release-image.yml', import.meta.url), 'utf8'))

describe('release acceptance', () => {
  it('cannot build a release before exact-SHA CI acceptance', () => {
    expect(workflow.jobs['build-and-push'].needs).toBe('verify-source')
    const gate = workflow.jobs['verify-source']
    expect(gate.permissions.actions).toBe('read')
    const command = gate.steps[0].run as string
    expect(command).toContain('head_sha=${GITHUB_SHA}')
    expect(command).toContain('.head_sha == $sha')
    expect(command).toContain('.conclusion == "success"')
  })

  it('accepts digests only after successful scans of both images', () => {
    const step = workflow.jobs['build-and-push'].steps.find((step: { id?: string }) => step.id === 'refs')
    expect(step.env.APP_DIGEST).toContain('steps.app.outputs.digest')
    expect(step.env.MIGRATE_DIGEST).toContain('steps.migrate.outputs.digest')
    expect(step.run).toContain('aws ecr wait image-scan-complete')
    expect(step.run).toContain('describe-image-scan-findings')
    expect(step.run.indexOf('(.CRITICAL // 0)')).toBeLessThan(step.run.indexOf('echo "app_image='))
    expect(step.run).toContain('(.HIGH // 0)')
  })
})
