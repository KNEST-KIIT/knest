import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { render } from '../../scripts/render-cfn.mjs'
import { scanText } from '../../scripts/scan-secrets.mjs'

/**
 * docs/delivery/S-1-CREATE-RUNBOOK.md is the only sequence for the first-ever S-1 environment. It is prose a person
 * follows with an AWS session, so the failures that matter (a raw template with Retain/Snapshot uploaded, a change set
 * without the service role, the production registry name, a secret typed into a command) are pinned here as text
 * checks on the commands themselves. Nothing here talks to AWS.
 */

const here = (path: string) => new URL(path, import.meta.url)
const lf = (path: string) => readFileSync(here(path), 'utf8').replace(/\r\n/g, '\n')
const runbook = lf('../../docs/delivery/S-1-CREATE-RUNBOOK.md')
const code = [...runbook.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]!).join('\n')
const INLINE_LIMIT_BYTES = 51_200

/** Each `aws cloudformation <verb>` invocation with its continuation lines, in document order. */
const invocations = (verb: string): { text: string; at: number }[] =>
  [...code.matchAll(new RegExp(`aws cloudformation ${verb}\\b(?:[^\\n]*\\\\\\n)*[^\\n]*`, 'g'))].map((m) => ({ text: m[0], at: m.index ?? 0 }))
const createChangeSets = invocations('create-change-set')
const nameOf = (text: string) => /--change-set-name\s+(\S+)/.exec(text)?.[1] ?? ''
const stackOf = (text: string) => /--stack-name\s+(\S+)/.exec(text)?.[1] ?? ''
const indexOfCode = (needle: string | RegExp) => (typeof needle === 'string' ? code.indexOf(needle) : code.search(needle))

describe('S-1 runbook: rendered templates only, never the raw production ones', () => {
  it('renders waf, ci, app and edge with the S-1 variant and uploads or passes only the rendered files', () => {
    for (const name of ['waf', 'ci', 'app', 'edge']) {
      expect(code, `${name} is rendered for s1`).toContain(`node scripts/render-cfn.mjs s1 ${name} > "$OUT/${name}.yaml"`)
    }
    expect(code).not.toMatch(/render-cfn\.mjs production/)
    // Nothing in a command reads a template straight from infra/cfn: not for upload, not inline, not by URL.
    expect(code).not.toMatch(/infra\/cfn\//)
    const uploads = [...code.matchAll(/aws s3 cp\s+(\S+)\s+(\S+)/g)]
    expect(uploads.length).toBeGreaterThan(0)
    for (const [, source, target] of uploads) {
      expect(source, 'upload source is a rendered file').toMatch(/^"\$OUT\/\$T\.yaml"$/)
      expect(target).toMatch(/^"s3:\/\/\$TPL_BUCKET\/knest-s1\/\$T-\$SHA\.yaml"$/)
    }
    expect(code).toContain('for T in ci app edge; do aws s3 cp')
  })

  it('refuses to continue when a rendered template still retains data', () => {
    expect(code).toContain("grep -nE '(DeletionPolicy|UpdateReplacePolicy): (Retain|Snapshot)' \"$OUT\"/*.yaml")
    for (const name of ['app', 'ci', 'edge', 'waf'] as const) {
      const rendered = render(lf(`../cfn/${name}.yaml`), 's1')
      expect(rendered, `${name} (s1 rendering)`).not.toMatch(/(DeletionPolicy|UpdateReplacePolicy): (Retain|Snapshot)/)
    }
  })

  it('has no production name or production template bucket anywhere in its commands', () => {
    // The verification script is named verify-production.mjs; that file name is the only place the word may appear.
    expect(code.replaceAll('verify-production.mjs', '')).not.toMatch(/production/i)
    expect(code).not.toContain('knest-templates-')
    expect(code).toContain('TPL_BUCKET=knest-s1-templates-166917387892')
    expect(code).toContain('TPL_URL=https://knest-s1-templates-166917387892.s3.ap-south-1.amazonaws.com')
    for (const url of code.match(/--template-url\s+"[^"]+"/g) ?? []) expect(url).toMatch(/^--template-url\s+"\$TPL_URL\/knest-s1\/(ci|app|edge)-\$SHA\.yaml"$/)
  })

  it('passes the waf template inline only because the rendered file is under the inline limit', () => {
    const waf = render(lf('../cfn/waf.yaml'), 's1')
    expect(Buffer.byteLength(waf) + (waf.match(/\n/g) ?? []).length).toBeLessThan(INLINE_LIMIT_BYTES)
    const inline = code.match(/--template-body\s+\S+/g) ?? []
    expect(inline).toEqual(['--template-body file://$OUT/waf.yaml'])
    // The big ones are too large for the request body and go by URL.
    for (const name of ['app', 'edge', 'ci']) expect(code).toContain(`knest-s1/${name}-$SHA.yaml`)
    expect(Buffer.byteLength(render(lf('../cfn/app.yaml'), 's1'))).toBeGreaterThan(INLINE_LIMIT_BYTES)
  })

  it('renders edge and waf unchanged, so the one-command rule cannot alter them', () => {
    for (const name of ['edge', 'waf']) {
      const source = lf(`../cfn/${name}.yaml`)
      expect(source).not.toContain('# DELETION')
      expect(render(source, 's1')).toBe(source)
    }
  })
})

describe('S-1 runbook: change sets, service role, review before execute, stack order', () => {
  it('defines the exact service role and uses it on every change set', () => {
    expect(code).toContain('CFN_ROLE=arn:aws:iam::166917387892:role/knest-s1-cfn-service')
    expect(createChangeSets.length).toBe(5)
    for (const { text } of createChangeSets) {
      expect(text, nameOf(text)).toContain('--role-arn "$CFN_ROLE"')
      expect(text).toMatch(/--change-set-type (CREATE|UPDATE)/)
      expect(text).toMatch(/--stack-name knest-s1(-waf|-ci|-edge)?\s/)
    }
    expect(code).not.toMatch(/aws cloudformation (create-stack|update-stack|deploy)\b/)
    // Every deletion also goes through the service role.
    for (const { text } of invocations('delete-stack')) expect(text).toContain('--role-arn "$CFN_ROLE"')
  })

  it('creates each new stack with a CREATE change set and updates only the app stack, and only SiteUrl', () => {
    const types = createChangeSets.map(({ text }) => [stackOf(text), /--change-set-type (\w+)/.exec(text)?.[1]])
    expect(types).toEqual([['knest-s1-waf', 'CREATE'], ['knest-s1-ci', 'CREATE'], ['knest-s1', 'CREATE'], ['knest-s1-edge', 'CREATE'], ['knest-s1', 'UPDATE']])
    const update = createChangeSets[4]!.text
    expect(update).toContain('--parameters $KEYS ParameterKey=SiteUrl,ParameterValue=https://$DIST_DOMAIN')
    expect(code).toContain("grep -v '^SiteUrl$'")
    expect(code).toContain('ParameterKey=%s,UsePreviousValue=true')
    // The placeholder is what the first create carries, and it never reaches the host: the release comes after the update.
    expect(createChangeSets[2]!.text).toContain('ParameterKey=SiteUrl,ParameterValue=https://placeholder.invalid')
    expect(indexOfCode('gh workflow run')).toBeGreaterThan(createChangeSets[4]!.at)
  })

  it('orders the stacks waf, ci, app, edge, then the SiteUrl update, then the release', () => {
    const positions = createChangeSets.map(({ at }) => at)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const at = (stack: string, type: string) => createChangeSets.find(({ text }) => stackOf(text) === stack && text.includes(`--change-set-type ${type}`))!.at
    expect(at('knest-s1-waf', 'CREATE')).toBeLessThan(at('knest-s1-ci', 'CREATE'))
    expect(at('knest-s1-ci', 'CREATE')).toBeLessThan(at('knest-s1', 'CREATE'))
    expect(at('knest-s1', 'CREATE')).toBeLessThan(at('knest-s1-edge', 'CREATE'))
    expect(at('knest-s1-edge', 'CREATE')).toBeLessThan(at('knest-s1', 'UPDATE'))
    // The edge needs outputs of the waf and app stacks; the ci variables are set before the host is released.
    expect(code.indexOf('WEB_ACL_ARN=')).toBeLessThan(at('knest-s1-edge', 'CREATE'))
    expect(code.indexOf('ORIGIN_DNS=')).toBeLessThan(at('knest-s1-edge', 'CREATE'))
    expect(code.indexOf('DIST_DOMAIN=')).toBeLessThan(at('knest-s1', 'UPDATE'))
  })

  it('reads every change set before it is executed, and executes none that was not created first', () => {
    const executes = invocations('execute-change-set')
    expect(executes.length).toBe(createChangeSets.length)
    const describes = invocations('describe-change-set')
    for (const create of createChangeSets) {
      const name = nameOf(create.text)
      const read = describes.find((d) => nameOf(d.text) === name)
      const run = executes.find((e) => nameOf(e.text) === name)
      expect(read, `${name} is described`).toBeDefined()
      expect(run, `${name} is executed`).toBeDefined()
      expect(create.at).toBeLessThan(read!.at)
      expect(read!.at, `${name} is read before it is executed`).toBeLessThan(run!.at)
      expect(code.slice(create.at, read!.at), `${name} waits for the change set`).toContain('wait change-set-create-complete')
    }
    // The review states what a person must see; the update must show exactly one benign change.
    expect(runbook).toContain('exactly one change, `Modify ConfigSiteUrl`, replacement `False`')
    expect(runbook).toContain('executed only after a person has read it')
  })

  it('puts the waf stack in us-east-1 and every other stack in the Mumbai default', () => {
    for (const { text } of [...createChangeSets, ...invocations('execute-change-set'), ...invocations('describe-change-set')]) {
      if (stackOf(text) === 'knest-s1-waf') expect(text).toContain('--region us-east-1')
      else expect(text).not.toContain('--region us-east-1')
    }
    expect(code).toContain('AWS_DEFAULT_REGION=ap-south-1')
  })
})

describe('S-1 runbook: discovery, inputs and hard blockers come before anything is created', () => {
  const firstCreate = createChangeSets[0]!.at

  it('looks up the GitHub OIDC provider read-only and reuses it instead of creating a second', () => {
    const lookup = indexOfCode('aws iam list-open-id-connect-providers')
    expect(lookup).toBeGreaterThan(-1)
    expect(lookup).toBeLessThan(firstCreate)
    expect(code).toContain('ParameterKey=CreateOidcProvider,ParameterValue=true')
    expect(code).toContain('ParameterKey=CreateOidcProvider,ParameterValue=false ParameterKey=ExistingOidcProviderArn,ParameterValue=$OIDC_ARN')
    const ci = createChangeSets.find(({ text }) => stackOf(text) === 'knest-s1-ci')!.text
    expect(ci).toContain('$OIDC_PARAMS')
    expect(code).toContain('ClientIDList')
    expect(runbook).toContain('must contain `sts.amazonaws.com`')
    // The parameter names are the template's, so a rename of either side breaks this test rather than a change set.
    const ciTemplate = lf('../cfn/ci.yaml')
    for (const name of ['CreateOidcProvider', 'ExistingOidcProviderArn', 'RepositoryName']) expect(ciTemplate).toContain(`  ${name}:`)
  })

  it('looks up the CloudFront prefix list before the app stack and passes it', () => {
    const lookup = indexOfCode('aws ec2 describe-managed-prefix-lists')
    expect(code.slice(lookup, lookup + 300)).toContain('com.amazonaws.global.cloudfront.origin-facing')
    const app = createChangeSets.find(({ text }) => stackOf(text) === 'knest-s1' && text.includes('CREATE'))!
    expect(lookup).toBeLessThan(app.at)
    expect(app.text).toContain('ParameterKey=CloudFrontPrefixListId,ParameterValue=$PL_ID')
  })

  it('names every owner-only input as a blocker, ahead of the first change set, and passes each from a variable', () => {
    const blockers = runbook.slice(runbook.indexOf('## 2. Hard blockers'), runbook.indexOf('## 3.'))
    for (const input of ['Turnstile site key and secret key', '`EmailFromAddress` is verified in SES', '`AlertEmail`', '`AccessHash`', '`ExpiresOn`']) expect(blockers, input).toContain(input)
    expect(runbook.indexOf('## 2. Hard blockers')).toBeLessThan(runbook.indexOf(createChangeSets[0]!.text))
    const app = createChangeSets.find(({ text }) => stackOf(text) === 'knest-s1' && text.includes('CREATE'))!.text
    for (const pair of ['EmailFromAddress,ParameterValue=$EMAIL_FROM', 'TurnstileSiteKey,ParameterValue=$TURNSTILE_SITE_KEY', 'AlertEmail,ParameterValue=$ALERT_EMAIL', 'ExpiresOn,ParameterValue=$EXPIRES_ON']) expect(app, pair).toContain(pair)
    const edge = createChangeSets.find(({ text }) => stackOf(text) === 'knest-s1-edge')!.text
    expect(edge).toContain('AccessHash,ParameterValue=$ACCESS_HASH')
    // Each is required by the template: no default for the first three, and an empty AccessHash would make the site public.
    const appTemplate = lf('../cfn/app.yaml')
    const parameterBlock = (name: string) => appTemplate.slice(appTemplate.indexOf(`\n  ${name}:\n`) + 1).split(/\n  [A-Za-z]+:\n/)[0]!
    for (const name of ['EmailFromAddress', 'TurnstileSiteKey', 'SiteUrl', 'CloudFrontPrefixListId']) {
      expect(appTemplate, name).toContain(`\n  ${name}:\n`)
      expect(parameterBlock(name), `${name} has no default, so a change set without it fails`).not.toContain('Default:')
    }
    expect(lf('../cfn/edge.yaml')).toMatch(/AccessHash:[\s\S]*?Default: ''/)
    for (const word of ['AccessHash', 'public', 'never public']) expect(blockers).toContain(word)
  })

  it('makes the Phase B teardown utility a hard blocker: plan, then install, then verify, before any CREATE change set executes', () => {
    const blockers = runbook.slice(runbook.indexOf('## 2. Hard blockers'), runbook.indexOf('## 3.'))
    expect(blockers).toContain('B0')
    expect(blockers).toContain('Automated teardown is installed and verified (Phase B utility)')
    expect(blockers).toMatch(/Do not execute any S-1 CREATE change set until all four schedules and both regional schedule groups pass `verify`/)
    expect(blockers).toContain('nothing is installed in AWS yet')
    expect(blockers).toContain('explicitly authorised root bootstrap')
    for (const name of ['knest-s1-expire-edge', 'knest-s1-expire-app', 'knest-s1-expire-ci', 'knest-s1-expire-waf']) expect(blockers, name).toContain(name)
    // The obsolete two-schedule wording is gone.
    expect(runbook).not.toMatch(/knest-s1-expire`/)
    expect(runbook).not.toContain('Phase A does not implement it')

    const plan = indexOfCode('node scripts/s1-teardown.mjs plan --expires-on "$EXPIRES_ON"')
    const install = indexOfCode('node scripts/s1-teardown.mjs install --expires-on "$EXPIRES_ON" --profile claude-deploy --allow-root-bootstrap')
    const verify = indexOfCode('node scripts/s1-teardown.mjs verify --expires-on "$EXPIRES_ON" --profile claude-deploy --allow-root-bootstrap')
    expect(plan).toBeGreaterThan(-1)
    expect(plan).toBeLessThan(install)
    expect(install).toBeLessThan(verify)
    // All of it comes before the first change set is created, let alone executed.
    expect(verify).toBeLessThan(createChangeSets[0]!.at)
    expect(verify).toBeLessThan(invocations('execute-change-set')[0]!.at)
    // The ExpiresOn prompt that feeds it is read first.
    expect(indexOfCode(/read -rp '[^']+' EXPIRES_ON/)).toBeLessThan(plan)
  })

  it('checks all four schedules and both regional groups read-only, and explains the 00:00, 02:00 and 04:00 UTC ordering and DELETE', () => {
    expect(code).toContain('aws scheduler list-schedules --region ap-south-1 --group-name knest-s1')
    expect(code).toContain('aws scheduler list-schedules --region us-east-1 --group-name knest-s1')
    for (const [region, name] of [['ap-south-1', 'edge'], ['ap-south-1', 'app'], ['ap-south-1', 'ci'], ['us-east-1', 'waf']]) {
      expect(code, name).toContain(`aws scheduler get-schedule --region ${region} --group-name knest-s1 --name knest-s1-expire-${name} `)
    }
    expect(runbook).toContain('**00:00 UTC**')
    expect(runbook).toContain('**02:00 UTC**')
    expect(runbook).toContain('**04:00 UTC**')
    expect(runbook).toContain('`ActionAfterCompletion` `DELETE`')
    expect(runbook).toContain('**they do not empty buckets**')
    // The runbook itself creates nothing with the scheduler or IAM CLI; the utility does, under an owner session.
    expect(code).not.toMatch(/aws scheduler (create|update|delete)-/)
    expect(code).not.toMatch(/aws iam (create|put|delete)-/)
  })

  it('re-verifies the teardown guard immediately before the first change set execution', () => {
    const firstExecute = invocations('execute-change-set')[0]!.at
    const before = code.slice(0, firstExecute)
    const verify = before.lastIndexOf('node scripts/s1-teardown.mjs verify --expires-on "$EXPIRES_ON" --profile claude-deploy --allow-root-bootstrap || exit 1')
    expect(verify).toBeGreaterThan(createChangeSets[0]!.at)
    expect(verify).toBeLessThan(firstExecute)
  })

  it('computes the gate digest from a hidden prompt and keeps the credentials out of the environment of later commands', () => {
    expect(code).toContain("read -rsp 'Gate credentials as user:password (hidden, not stored): ' GATE_CRED")
    expect(code).toContain("ACCESS_HASH=$(printf '%s' \"$GATE_CRED\" | sha256sum | cut -d' ' -f1); unset GATE_CRED")
    expect(code).toContain('read -rsp \'Gate credentials, user:password: \' KNEST_VERIFY_BASIC')
    expect(code).toContain('unset KNEST_VERIFY_BASIC')
  })
})

describe('S-1 runbook: the S-1 registry, GitHub variables and exactly one release', () => {
  it('uses knest-s1-app for the ci stack, the app stack pull permission and the GitHub variable, never the production name', () => {
    expect(code).toContain('ParameterKey=RepositoryName,ParameterValue=knest-s1-app')
    expect(code).toContain('ParameterKey=EcrRepositoryName,ParameterValue=knest-s1-app')
    expect(code).toContain('gh variable set ECR_REPOSITORY --env s1 --repo KNEST-KIIT/knest --body knest-s1-app')
    for (const variable of ['AWS_REGION', 'AWS_PUSH_ROLE_ARN', 'AWS_DEPLOY_ROLE_ARN']) expect(code).toContain(`gh variable set ${variable} --env s1`)
    expect(runbook).not.toMatch(/(?<![\w-])knest-app(?![\w-])/)
    // Both stacks default to the production name, which is exactly why the runbook must override them.
    expect(lf('../cfn/ci.yaml')).toMatch(/RepositoryName:\n    Type: String\n    Default: knest-app/)
    expect(lf('../cfn/app.yaml')).toMatch(/EcrRepositoryName:\n    Type: String\n    Default: knest-app/)
    // The names the S-1 roles are scoped to match.
    expect(readFileSync(here('./operator-policy.json'), 'utf8')).toContain('repository/knest-s1*')
    expect(readFileSync(here('./teardown-roles.json'), 'utf8')).toContain('repository/knest-s1*')
  })

  it('dispatches the release once, for s1, after the update, and never retries by dispatching again', () => {
    expect([...code.matchAll(/gh workflow run release-image\.yml/g)].length).toBe(1)
    expect(code).toContain('-f environment=s1 -f deploy=true')
    expect(runbook).toContain('do not dispatch again')
    expect(runbook).toContain('Image tags are immutable')
    expect(code).toContain('--document-name knest-s1-deploy')
    // The manual fallback deploys digests (the document refuses a tag), as the workflow does.
    expect(code).toMatch(/AppImage=<app image from the summary>/)
    expect(lf('../cfn/app.yaml')).toContain('@sha256:[a-f0-9]{64}$')
  })

  it('creates the GitHub Environment before the variables it holds, because the OIDC trust is per Environment', () => {
    expect(code.indexOf('environments/s1')).toBeLessThan(code.indexOf('gh variable set AWS_REGION'))
    const ci = lf('../cfn/ci.yaml')
    expect(ci).toContain("':environment:'")
  })
})

describe('S-1 runbook: cost stops and cleanup', () => {
  it('reads Cost Explorer at named checkpoints and stops at a projected USD 20 of the USD 25 gross ceiling', () => {
    expect(code).toContain('aws ce get-cost-and-usage --region us-east-1')
    for (const phrase of ['USD 25 **gross, before credits**', 'projected USD 20', 'reaches USD 20', 'at most 7 days']) expect(runbook, phrase).toContain(phrase)
    expect(runbook).toContain('Mumbai GuardDuty rate is unpublished')
  })

  it('cleans what a stack delete leaves behind: delete markers, manual snapshots, secrets, the template bucket', () => {
    for (const phrase of ['s1-remove-lone-delete-markers', 'pre-migrate-', '--force-delete-without-recovery', 'knest-s1-templates-166917387892', 'list-object-versions', 'DeleteMarkers', 'REVIEW_IN_PROGRESS']) {
      expect(runbook, phrase).toContain(phrase)
    }
    // Teardown order is edge and waf first, then ci and the app.
    const order = ['delete-stack --stack-name knest-s1-edge', 'delete-stack --region us-east-1 --stack-name knest-s1-waf', 'delete-stack --stack-name knest-s1-ci', 'delete-stack --stack-name knest-s1 ']
    const positions = order.map((o) => code.indexOf(o))
    expect(positions.every((p) => p > -1)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('empties data before stack deletion, and runs the utility cleanup only after the stack inventory gate', () => {
    const buckets = code.indexOf('aws s3api list-object-versions')
    const firstDelete = code.indexOf('delete-stack --stack-name knest-s1-edge')
    expect(buckets).toBeGreaterThan(-1)
    expect(buckets).toBeLessThan(firstDelete)
    const gate = [
      'describe-stacks --region ap-south-1 --stack-name knest-s1-edge',
      'describe-stacks --region us-east-1 --stack-name knest-s1-waf',
      'describe-stacks --region ap-south-1 --stack-name knest-s1-ci',
      'describe-stacks --region ap-south-1 --stack-name knest-s1 ',
    ].map((g) => code.indexOf(g))
    expect(gate.every((p) => p > -1)).toBe(true)
    const cleanup = code.indexOf('node scripts/s1-teardown.mjs cleanup --profile claude-deploy --allow-root-bootstrap')
    expect(cleanup).toBeGreaterThan(Math.max(...gate))
    expect(cleanup).toBeGreaterThan(firstDelete)
    expect(code.match(/s1-teardown\.mjs cleanup/g)).toHaveLength(1)
    expect(runbook).toContain('It refuses while any of the four stacks exists')
    expect(runbook).toContain('**they do not empty buckets**')
    expect(runbook).not.toMatch(/schedules? (automatically )?empt(y|ies) (the )?buckets/i)
  })
})

describe('S-1 runbook: no secret literal, no secret in a command line or history', () => {
  it('passes the repository secret scan and contains no credential-shaped literal', () => {
    expect(scanText(runbook)).toEqual([])
    expect(code).not.toMatch(/[0-9a-f]{64}/)
    expect(code).not.toMatch(/AKIA|ASIA|aws_secret_access_key|BEGIN [A-Z ]*PRIVATE KEY/i)
  })

  it('never writes a secret with a command: the Turnstile secret key is the owner’s console paste', () => {
    expect(code).not.toMatch(/--secret-string|put-secret-value|create-secret|get-secret-value|update-secret/)
    expect(code).not.toMatch(/--debug|set -x|xtrace/)
    expect(runbook).toContain('paste the Turnstile **secret key**')
    expect(runbook).toContain('No secret value in a file or in shell history')
  })

  it('takes typed values at read prompts, never as literals on a command line', () => {
    for (const variable of ['TURNSTILE_SITE_KEY', 'EMAIL_FROM', 'ALERT_EMAIL', 'EXPIRES_ON']) expect(code, variable).toMatch(new RegExp(`read -rp '[^']+' ${variable}\\n`))
    // The only literal assignments are the fixed, non-secret names; the gate variables are never assigned from a literal.
    expect(code).not.toMatch(/^\s*(ACCESS_HASH|GATE_CRED|KNEST_VERIFY_BASIC)=["']?[^$"'(\s]/m)
    expect(code).not.toMatch(/ParameterKey=AccessHash,ParameterValue=(?!\$ACCESS_HASH)/)
    expect(code).not.toMatch(/ParameterKey=TurnstileSiteKey,ParameterValue=(?!\$TURNSTILE_SITE_KEY)/)
    // No echo of the digest or the credentials.
    expect(code).not.toMatch(/echo[^\n]*\$(ACCESS_HASH|GATE_CRED|KNEST_VERIFY_BASIC)/)
  })

  it('writes the S-1 templates and nothing secret to disk', () => {
    const files = [...code.matchAll(/>\s*"?(\$OUT\/[a-z]+\.yaml|docs\/delivery\/EVIDENCE\/[^\s"]+)"?/g)].map((m) => m[1])
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(file).toMatch(/^(\$OUT\/(waf|ci|app|edge)\.yaml|docs\/delivery\/EVIDENCE\/S-1-verify-)/)
    // The rendered templates carry parameters by name only: none holds a value, and the access hash is a NoEcho parameter.
    expect(lf('../cfn/edge.yaml')).toMatch(/AccessHash:\n    Type: String\n    NoEcho: true/)
  })
})

describe('S-1 workflow notes: S-1 and production registries are named correctly, tags and digests stay strict', () => {
  const text = lf('../../.github/workflows/release-image.yml')
  const workflow = parse(text) as { jobs: Record<string, { steps: { id?: string; with?: Record<string, string>; run?: string }[] }> }

  it('documents knest-s1-app for s1 and knest-app for production', () => {
    expect(text).toMatch(/#\s+ECR_REPOSITORY\s+s1: knest-s1-app\s+production: knest-app/)
    expect(text).not.toMatch(/#\s+ECR_REPOSITORY\s+knest-app\s*\n/)
  })

  it('still pushes immutable per-commit tags and hands the host only digests', () => {
    const steps = workflow.jobs['build-and-push']!.steps
    const tags = steps.filter((s) => s.id === 'app' || s.id === 'migrate').map((s) => s.with?.tags ?? '')
    expect(tags).toEqual([expect.stringContaining(':app-${{ github.sha }}'), expect.stringContaining(':migrate-${{ github.sha }}')])
    for (const tag of tags) expect(tag).not.toMatch(/:latest|:s1|:production/)
    const refs = steps.find((s) => s.id === 'refs')!.run!
    expect(refs).toContain('@${{ steps.app.outputs.digest }}')
    expect(refs).toContain('@${{ steps.migrate.outputs.digest }}')
    expect(text).toContain('AppImage=${APP_IMAGE},MigrateImage=${MIGRATE_IMAGE}')
    expect(lf('../cfn/ci.yaml')).toContain('ImageTagMutability: IMMUTABLE')
  })
})
