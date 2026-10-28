import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workflow = parse(readFileSync(new URL('../../.github/workflows/release-image.yml', import.meta.url), 'utf8'))

/**
 * CloudFormation accepts at most 51,200 bytes of template in the request body itself (CreateStack, UpdateStack,
 * CreateChangeSet, ValidateTemplate); a larger template, up to 1 MB, must be uploaded to S3 and passed by URL
 * (AWS documentation, "Understand CloudFormation quotas", checked 2026-10-28). The app template grew past the
 * inline limit with document screening, so a runbook that still says `--template-body file://infra/cfn/app.yaml`
 * would fail on the day it is followed.
 */
const INLINE_LIMIT_BYTES = 51_200
const here = (path: string) => new URL(path, import.meta.url)
const lfText = (path: string) => readFileSync(here(path), 'utf8').replace(/\r\n/g, '\n')
/** Worst case: a Windows checkout turns every line feed into two bytes. */
const bytesOnWindows = (text: string) => Buffer.byteLength(text) + (text.match(/\n/g) ?? []).length

/** Template files a command line passes inline, with the size the request would carry. */
function inlineTemplates(commandText: string, sizeOf: (file: string) => number): { file: string; bytes: number }[] {
  return [...commandText.matchAll(/--template-body\s+file:\/\/(infra\/cfn\/[a-z0-9-]+\.yaml)/g)].map((m) => ({ file: m[1]!, bytes: sizeOf(m[1]!) }))
}

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

describe('templates deployed by hand', () => {
  const sizeOf = (file: string) => bytesOnWindows(lfText(`../../${file}`))
  const runbooks = [
    'docs/delivery/OPERATOR-COMMANDS.md',
    ...readdirSync(here('../../scripts/ops/')).filter((f) => f.endsWith('.sh')).map((f) => `scripts/ops/${f}`),
  ]

  it('recognises an oversized template passed inline, and accepts a small one or one passed by URL', () => {
    const sizes: Record<string, number> = { 'infra/cfn/big.yaml': INLINE_LIMIT_BYTES + 1, 'infra/cfn/small.yaml': 1000 }
    const sizeOfFake = (file: string) => sizes[file] ?? 0
    const inline = inlineTemplates('aws cloudformation create-change-set --template-body file://infra/cfn/big.yaml --x\naws x --template-body file://infra/cfn/small.yaml', sizeOfFake)
    expect(inline.filter((t) => t.bytes > INLINE_LIMIT_BYTES).map((t) => t.file)).toEqual(['infra/cfn/big.yaml'])
    expect(inlineTemplates('aws cloudformation create-change-set --template-url https://example.s3.amazonaws.com/big.yaml', sizeOfFake)).toEqual([])
  })

  it('never passes a template over the inline limit as --template-body in a runbook or ops script', () => {
    for (const file of runbooks) {
      const tooBig = inlineTemplates(lfText(`../../${file}`), sizeOf).filter((t) => t.bytes > INLINE_LIMIT_BYTES)
      expect(tooBig, `${file} passes ${tooBig.map((t) => `${t.file} (${t.bytes} bytes)`).join(', ')} inline; upload it to S3 and use --template-url`).toEqual([])
    }
  })

  it('tells the operator to use an S3 URL for the app template, which is over the inline limit', () => {
    expect(sizeOf('infra/cfn/app.yaml')).toBeGreaterThan(INLINE_LIMIT_BYTES)
    expect(sizeOf('infra/cfn/app.yaml')).toBeLessThan(1_000_000)
    const commands = lfText('../../docs/delivery/OPERATOR-COMMANDS.md')
    expect(commands).toMatch(/--template-url\s+https:\/\/\S+\/app-/)
  })
})
