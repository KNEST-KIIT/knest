import { describe, expect, it, vi } from 'vitest'
import {
  ACCOUNT_ID,
  CFN_SERVICE_ROLE_ARN,
  CFN_SERVICE_ROLE_NAME,
  DELETE_STACK_TARGET_ARN,
  GROUP_NAME,
  REGIONS,
  SCHEDULER_POLICY_NAME,
  SCHEDULER_ROLE_ARN,
  SCHEDULER_ROLE_NAME,
  STACKS,
  buildCreateRoleArgs,
  buildDeleteRoleArgs,
  buildDeleteStackInput,
  buildPutRolePolicyArgs,
  buildSchedulePlan,
  buildSchedulerPermissionsPolicy,
  buildSchedulerTrustPolicy,
  cleanup,
  createAws,
  install,
  main,
  verify,
} from '../../scripts/s1-teardown.mjs'

type CreateAwsOptions = NonNullable<Parameters<typeof createAws>[0]>
type Call = string[]
type Result = { ok: boolean; status: number; stdout: string; stderr: string; json?: any }

const good = (json?: unknown): Result => ({ ok: true, status: 0, stdout: '', stderr: '', json })
const bad = (stderr: string): Result => ({ ok: false, status: 254, stdout: '', stderr })

const MUTATING = /^(create|put|delete|update|attach|detach|tag)-/

function expiresOn(daysAhead = 2): string {
  return new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10)
}

const flag = (args: Call, name: string): string => args[args.indexOf(name) + 1] ?? ''

function liveFromSpec(spec: any) {
  return {
    Name: spec.name,
    GroupName: spec.groupName,
    ScheduleExpression: spec.scheduleExpression,
    ScheduleExpressionTimezone: spec.scheduleExpressionTimezone,
    FlexibleTimeWindow: spec.flexibleTimeWindow,
    ActionAfterCompletion: spec.actionAfterCompletion,
    State: spec.state,
    Description: spec.description,
    Target: JSON.parse(JSON.stringify(spec.target)),
  }
}

interface World {
  identity: { Account: string; Arn: string }
  roles: Map<string, any>
  inline: Map<string, Record<string, any>>
  attached: any[]
  groups: Map<string, { State: string }>
  schedules: Map<string, any>
  stacks: Map<string, string>
}

function emptyWorld(): World {
  const roles = new Map<string, any>()
  roles.set(CFN_SERVICE_ROLE_NAME, { Arn: CFN_SERVICE_ROLE_ARN })
  return {
    identity: { Account: ACCOUNT_ID, Arn: `arn:aws:sts::${ACCOUNT_ID}:assumed-role/operator/me` },
    roles,
    inline: new Map(),
    attached: [],
    groups: new Map(),
    schedules: new Map(),
    stacks: new Map(),
  }
}

function installedWorld(date: string): World {
  const w = emptyWorld()
  w.roles.set(SCHEDULER_ROLE_NAME, {
    Arn: SCHEDULER_ROLE_ARN,
    AssumeRolePolicyDocument: buildSchedulerTrustPolicy(),
  })
  w.inline.set(SCHEDULER_ROLE_NAME, { [SCHEDULER_POLICY_NAME]: buildSchedulerPermissionsPolicy() })
  for (const region of REGIONS) w.groups.set(region, { State: 'ACTIVE' })
  for (const spec of buildSchedulePlan(date)) w.schedules.set(`${spec.region}/${spec.name}`, liveFromSpec(spec))
  return w
}

function fakeAws(world: World) {
  const calls: Call[] = []
  const aws = (args: Call): Result => {
    calls.push(args)
    const [svc, op] = args
    const key = `${svc} ${op}`
    const role = flag(args, '--role-name')
    const region = flag(args, '--region')
    switch (key) {
      case 'sts get-caller-identity':
        return good(world.identity)
      case 'iam get-role': {
        const r = world.roles.get(role)
        return r ? good({ Role: r }) : bad('NoSuchEntity: role not found')
      }
      case 'iam list-role-policies':
        return good({ PolicyNames: Object.keys(world.inline.get(role) ?? {}) })
      case 'iam get-role-policy':
        return good({ PolicyDocument: world.inline.get(role)?.[flag(args, '--policy-name')] })
      case 'iam list-attached-role-policies':
        return good({ AttachedPolicies: world.attached })
      case 'iam create-role':
        world.roles.set(role, {
          Arn: `arn:aws:iam::${ACCOUNT_ID}:role/${role}`,
          AssumeRolePolicyDocument: JSON.parse(flag(args, '--assume-role-policy-document')),
        })
        return good({})
      case 'iam put-role-policy':
        world.inline.set(role, {
          ...(world.inline.get(role) ?? {}),
          [flag(args, '--policy-name')]: JSON.parse(flag(args, '--policy-document')),
        })
        return good({})
      case 'iam delete-role-policy': {
        const m = world.inline.get(role) ?? {}
        delete m[flag(args, '--policy-name')]
        return good({})
      }
      case 'iam delete-role':
        world.roles.delete(role)
        return good({})
      case 'scheduler get-schedule-group': {
        const g = world.groups.get(region)
        return g ? good({ Name: GROUP_NAME, State: g.State }) : bad('ResourceNotFoundException')
      }
      case 'scheduler create-schedule-group':
        world.groups.set(region, { State: 'ACTIVE' })
        return good({})
      case 'scheduler delete-schedule-group':
        world.groups.delete(region)
        return good({})
      case 'scheduler list-schedules': {
        const names = [...world.schedules.keys()].filter((k) => k.startsWith(`${region}/`)).map((k) => ({ Name: k.split('/')[1] }))
        return good({ Schedules: names })
      }
      case 'scheduler get-schedule': {
        const s = world.schedules.get(`${region}/${flag(args, '--name')}`)
        return s ? good(s) : bad('ResourceNotFoundException')
      }
      case 'scheduler create-schedule':
        world.schedules.set(`${region}/${flag(args, '--name')}`, {
          Name: flag(args, '--name'),
          GroupName: flag(args, '--group-name'),
          ScheduleExpression: flag(args, '--schedule-expression'),
          ScheduleExpressionTimezone: flag(args, '--schedule-expression-timezone'),
          FlexibleTimeWindow: JSON.parse(flag(args, '--flexible-time-window')),
          ActionAfterCompletion: flag(args, '--action-after-completion'),
          State: flag(args, '--state'),
          Description: flag(args, '--description'),
          Target: JSON.parse(flag(args, '--target')),
        })
        return good({})
      case 'scheduler delete-schedule':
        world.schedules.delete(`${region}/${flag(args, '--name')}`)
        return good({})
      case 'cloudformation describe-stacks': {
        const status = world.stacks.get(`${region}/${flag(args, '--stack-name')}`)
        return status
          ? good({ Stacks: [{ StackStatus: status }] })
          : bad(`ValidationError: Stack with id ${flag(args, '--stack-name')} does not exist`)
      }
      default:
        return bad(`unexpected call ${key}`)
    }
  }
  const mutations = () => calls.filter((c) => MUTATING.test(c[1] ?? ''))
  return { aws, calls, mutations }
}

const quiet = () => {}

describe('schedule plan builders', () => {
  const date = '2026-11-03'
  const plan = buildSchedulePlan(date)

  it('has exactly four specs with exact regions, names and UTC ordering', () => {
    expect(plan).toHaveLength(4)
    expect(
      plan.map((s: any) => [s.region, s.name, s.stackName, s.scheduleExpression, s.scheduleExpressionTimezone]),
    ).toEqual([
      ['ap-south-1', 'knest-s1-expire-edge', 'knest-s1-edge', 'at(2026-11-03T00:00:00)', 'UTC'],
      ['us-east-1', 'knest-s1-expire-waf', 'knest-s1-waf', 'at(2026-11-03T02:00:00)', 'UTC'],
      ['ap-south-1', 'knest-s1-expire-app', 'knest-s1', 'at(2026-11-03T04:00:00)', 'UTC'],
      ['ap-south-1', 'knest-s1-expire-ci', 'knest-s1-ci', 'at(2026-11-03T04:00:00)', 'UTC'],
    ])
    const hours = plan.map((s: any) => Number(s.scheduleExpression.slice(14, 16)))
    expect(hours).toEqual([...hours].sort((a, b) => a - b))
  })

  it('uses the universal deleteStack target, scheduler role and exact input', () => {
    for (const spec of plan as any[]) {
      expect(spec.target.Arn).toBe('arn:aws:scheduler:::aws-sdk:cloudformation:deleteStack')
      expect(spec.target.Arn).toBe(DELETE_STACK_TARGET_ARN)
      expect(spec.target.RoleArn).toBe(`arn:aws:iam::${ACCOUNT_ID}:role/knest-s1-scheduler`)
      expect(JSON.parse(spec.target.Input)).toEqual({
        StackName: spec.stackName,
        RoleARN: `arn:aws:iam::${ACCOUNT_ID}:role/knest-s1-cfn-service`,
      })
      expect(Object.keys(JSON.parse(spec.target.Input)).sort()).toEqual(['RoleARN', 'StackName'])
      expect(spec.groupName).toBe('knest-s1')
    }
    expect(buildDeleteStackInput(STACKS[0])).toEqual({ StackName: 'knest-s1-edge', RoleARN: CFN_SERVICE_ROLE_ARN })
  })

  it('retries 3 times within 3600s, no flexible window, deletes after completion', () => {
    for (const spec of plan as any[]) {
      expect(spec.target.RetryPolicy).toEqual({ MaximumRetryAttempts: 3, MaximumEventAgeInSeconds: 3600 })
      expect(spec.flexibleTimeWindow).toEqual({ Mode: 'OFF' })
      expect(spec.actionAfterCompletion).toBe('DELETE')
      expect(spec.state).toBe('ENABLED')
    }
  })

  it('names no production resource anywhere', () => {
    const blob = JSON.stringify([
      plan,
      buildSchedulerTrustPolicy(),
      buildSchedulerPermissionsPolicy(),
      buildCreateRoleArgs(),
      buildPutRolePolicyArgs(),
    ])
    expect(blob).not.toMatch(/prod/i)
    expect(STACKS.map((s: any) => s.stackName).sort()).toEqual(['knest-s1', 'knest-s1-ci', 'knest-s1-edge', 'knest-s1-waf'])
  })
})

describe('role documents', () => {
  it('trust policy is restricted to the account and the S-1 schedule group', () => {
    const t = buildSchedulerTrustPolicy()
    expect(t.Statement).toHaveLength(1)
    const s = t.Statement[0]!
    expect(s.Effect).toBe('Allow')
    expect(s.Principal).toEqual({ Service: 'scheduler.amazonaws.com' })
    expect(s.Action).toBe('sts:AssumeRole')
    expect(s.Condition).toEqual({
      StringEquals: { 'aws:SourceAccount': ACCOUNT_ID },
      ArnLike: { 'aws:SourceArn': `arn:aws:scheduler:*:${ACCOUNT_ID}:schedule/knest-s1/*` },
    })
  })

  it('permissions allow only the four S-1 stacks and pass-role of the cfn service role', () => {
    const p = buildSchedulerPermissionsPolicy()
    expect(p.Statement).toHaveLength(2)
    const del = p.Statement[0]!
    const pass = p.Statement[1]!
    expect(del.Action).toBe('cloudformation:DeleteStack')
    expect([...del.Resource].sort()).toEqual(
      [
        `arn:aws:cloudformation:ap-south-1:${ACCOUNT_ID}:stack/knest-s1/*`,
        `arn:aws:cloudformation:ap-south-1:${ACCOUNT_ID}:stack/knest-s1-edge/*`,
        `arn:aws:cloudformation:ap-south-1:${ACCOUNT_ID}:stack/knest-s1-ci/*`,
        `arn:aws:cloudformation:us-east-1:${ACCOUNT_ID}:stack/knest-s1-waf/*`,
      ].sort(),
    )
    expect(pass.Action).toBe('iam:PassRole')
    expect(pass.Resource).toBe(CFN_SERVICE_ROLE_ARN)
    expect(pass.Condition).toEqual({ StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } })
    expect(JSON.stringify(p)).not.toContain('"*"')
  })
})

describe('plan command', () => {
  it('makes zero AWS calls', () => {
    const spawn = vi.fn()
    const log = vi.fn()
    const err = vi.fn()
    expect(main(['plan', '--expires-on', '2026-11-03'], { spawn, log, err })).toBe(0)
    expect(spawn).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
    const out = log.mock.calls.map((c) => c[0]).join('\n')
    for (const s of STACKS as any[]) expect(out).toContain(s.scheduleName)
  })

  it('rejects --profile without calling AWS', () => {
    const spawn = vi.fn()
    expect(main(['plan', '--expires-on', '2026-11-03', '--profile', 'x'], { spawn, log: quiet, err: quiet })).toBe(2)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('rejects --allow-root-bootstrap without calling AWS', () => {
    const spawn = vi.fn()
    expect(main(['plan', '--expires-on', '2026-11-03', '--allow-root-bootstrap'], { spawn, log: quiet, err: quiet })).toBe(2)
    expect(spawn).not.toHaveBeenCalled()
  })
})

describe('verify', () => {
  it('passes on an exact installation and issues no mutating call', () => {
    const date = expiresOn()
    const f = fakeAws(installedWorld(date))
    const r = verify(f.aws, date, quiet)
    expect(r).toEqual({ ok: true, problems: [] })
    expect(f.mutations()).toEqual([])
    expect(f.calls.length).toBeGreaterThan(0)
  })

  const mutate: Record<string, (w: World, date: string) => void> = {
    'wrong schedule hour': (w) => {
      w.schedules.get('us-east-1/knest-s1-expire-waf').ScheduleExpression = 'at(2030-01-01T05:00:00)'
    },
    'wrong retry policy': (w) => {
      w.schedules.get('ap-south-1/knest-s1-expire-app').Target.RetryPolicy.MaximumRetryAttempts = 185
    },
    'flexible window on': (w) => {
      w.schedules.get('ap-south-1/knest-s1-expire-ci').FlexibleTimeWindow = { Mode: 'FLEXIBLE', MaximumWindowInMinutes: 5 }
    },
    'wrong action after completion': (w) => {
      w.schedules.get('ap-south-1/knest-s1-expire-edge').ActionAfterCompletion = 'NONE'
    },
    'wrong target stack': (w) => {
      const t = w.schedules.get('ap-south-1/knest-s1-expire-app').Target
      t.Input = JSON.stringify({ StackName: 'other', RoleARN: CFN_SERVICE_ROLE_ARN })
    },
    'extra target field': (w) => {
      w.schedules.get('ap-south-1/knest-s1-expire-app').Target.DeadLetterConfig = { Arn: 'x' }
    },
    'missing schedule': (w) => {
      w.schedules.delete('us-east-1/knest-s1-expire-waf')
    },
    'stray schedule in group': (w) => {
      w.schedules.set('ap-south-1/extra', {})
    },
    'missing group': (w) => {
      w.groups.delete('us-east-1')
    },
    'altered trust policy': (w) => {
      w.roles.get(SCHEDULER_ROLE_NAME).AssumeRolePolicyDocument.Statement[0].Condition.ArnLike['aws:SourceArn'] = '*'
    },
    'altered inline policy': (w) => {
      w.inline.get(SCHEDULER_ROLE_NAME)![SCHEDULER_POLICY_NAME].Statement[0].Resource.push('*')
    },
    'extra inline policy': (w) => {
      w.inline.get(SCHEDULER_ROLE_NAME)!.extra = {}
    },
    'attached managed policy': (w) => {
      w.attached.push({ PolicyName: 'AdministratorAccess' })
    },
    'missing cfn service role': (w) => {
      w.roles.delete(CFN_SERVICE_ROLE_NAME)
    },
  }

  for (const [name, fn] of Object.entries(mutate)) {
    it(`fails on ${name} without mutating`, () => {
      const date = expiresOn()
      const w = installedWorld(date)
      fn(w, date)
      const f = fakeAws(w)
      const r = verify(f.aws, date, quiet)
      expect(r.ok).toBe(false)
      expect(r.problems.length).toBeGreaterThan(0)
      expect(f.mutations()).toEqual([])
    })
  }

  it('fails when the caller is in another account', () => {
    const date = expiresOn()
    const w = installedWorld(date)
    w.identity.Account = '111111111111'
    expect(() => verify(fakeAws(w).aws, date, quiet)).toThrow(/account/)
  })

  it('rejects root by default and accepts it only with the explicit bootstrap option', () => {
    const date = expiresOn()
    const w = installedWorld(date)
    w.identity.Arn = `arn:aws:iam::${ACCOUNT_ID}:root`
    const f = fakeAws(w)
    expect(() => verify(f.aws, date, quiet)).toThrow(/--allow-root-bootstrap/)
    expect(verify(f.aws, date, quiet, { allowRoot: true })).toEqual({ ok: true, problems: [] })
  })

  it('rejects a root caller in the wrong account even with the explicit bootstrap option', () => {
    const date = expiresOn()
    const w = installedWorld(date)
    w.identity = { Account: '111111111111', Arn: 'arn:aws:iam::111111111111:root' }
    expect(() => verify(fakeAws(w).aws, date, quiet, { allowRoot: true })).toThrow(/account/)
  })
})

describe('install', () => {
  it('creates role, policy, two groups and four schedules on a clean account, then verifies', () => {
    const date = expiresOn()
    const w = emptyWorld()
    const f = fakeAws(w)
    const r = install(f.aws, date, quiet)
    expect(r.ok).toBe(true)
    const verbs = f.mutations().map((c) => `${c[0]} ${c[1]}`)
    expect(verbs.filter((v) => v === 'iam create-role')).toHaveLength(1)
    expect(verbs.filter((v) => v === 'iam put-role-policy')).toHaveLength(1)
    expect(verbs.filter((v) => v === 'scheduler create-schedule-group')).toHaveLength(2)
    expect(verbs.filter((v) => v === 'scheduler create-schedule')).toHaveLength(4)
    expect(verbs).toHaveLength(8)
  })

  it('is idempotent against an exact existing installation', () => {
    const date = expiresOn()
    const f = fakeAws(installedWorld(date))
    expect(install(f.aws, date, quiet).ok).toBe(true)
    expect(f.mutations().map((c) => c[1])).toEqual(['put-role-policy'])
  })

  it('requires the cfn service role before creating anything', () => {
    const date = expiresOn()
    const w = emptyWorld()
    w.roles.delete(CFN_SERVICE_ROLE_NAME)
    const f = fakeAws(w)
    expect(() => install(f.aws, date, quiet)).toThrow(/knest-s1-cfn-service does not exist/)
    expect(f.mutations()).toEqual([])
  })

  const clashes: Record<string, (w: World) => void> = {
    'existing role with a different trust policy': (w) => {
      w.roles.get(SCHEDULER_ROLE_NAME).AssumeRolePolicyDocument = { Version: '2012-10-17', Statement: [] }
    },
    'existing role with a different inline policy': (w) => {
      w.inline.get(SCHEDULER_ROLE_NAME)![SCHEDULER_POLICY_NAME] = { Version: '2012-10-17', Statement: [] }
    },
    'existing role with an attached managed policy': (w) => {
      w.attached.push({ PolicyName: 'AdministratorAccess' })
    },
    'existing group that is not active': (w) => {
      w.groups.get('ap-south-1')!.State = 'DELETING'
    },
    'existing group holding a stray schedule': (w) => {
      w.schedules.set('ap-south-1/stray', {})
    },
    'existing schedule with a different expression': (w) => {
      w.schedules.get('ap-south-1/knest-s1-expire-app').ScheduleExpression = 'at(2030-01-01T09:00:00)'
    },
    'existing schedule with a different target role': (w) => {
      w.schedules.get('us-east-1/knest-s1-expire-waf').Target.RoleArn = 'arn:aws:iam::1:role/other'
    },
  }

  for (const [name, fn] of Object.entries(clashes)) {
    it(`fails closed on ${name}`, () => {
      const date = expiresOn()
      const w = installedWorld(date)
      fn(w)
      const f = fakeAws(w)
      expect(() => install(f.aws, date, quiet)).toThrow()
      expect(f.mutations()).toEqual([])
    })
  }

  it('rejects an expiry more than seven days out or in the past before any AWS call', () => {
    const f = fakeAws(emptyWorld())
    expect(() => install(f.aws, expiresOn(30), quiet)).toThrow(/at most 7/)
    expect(() => install(f.aws, expiresOn(-1), quiet)).toThrow(/already passed/)
    expect(f.calls).toEqual([])
  })
})

describe('cleanup', () => {
  it('refuses if any S-1 stack exists, whatever its status, and mutates nothing', () => {
    for (const s of STACKS as any[]) {
      const w = installedWorld(expiresOn())
      w.stacks.set(`${s.region}/${s.stackName}`, 'DELETE_FAILED')
      const f = fakeAws(w)
      expect(() => cleanup(f.aws, quiet)).toThrow(/refusing to clean up/)
      expect(f.mutations()).toEqual([])
    }
  })

  it('refuses when stack existence cannot be determined', () => {
    const w = installedWorld(expiresOn())
    const f = fakeAws(w)
    const flaky = (args: Call) =>
      args[0] === 'cloudformation' ? bad('AccessDenied: not allowed') : f.aws(args)
    expect(() => cleanup(flaky, quiet)).toThrow(/cannot tell/)
    expect(f.mutations()).toEqual([])
  })

  it('removes schedules, groups, policy and scheduler role but never knest-s1-cfn-service', () => {
    const w = installedWorld(expiresOn())
    const f = fakeAws(w)
    const r = cleanup(f.aws, quiet)
    expect(r.ok).toBe(true)
    expect(w.schedules.size).toBe(0)
    expect(w.groups.size).toBe(0)
    expect(w.roles.has(SCHEDULER_ROLE_NAME)).toBe(false)
    expect(w.roles.has(CFN_SERVICE_ROLE_NAME)).toBe(true)

    const deleteRole = f.calls.filter((c) => c[1] === 'delete-role')
    expect(deleteRole).toEqual([buildDeleteRoleArgs()])
    for (const c of f.calls.filter((c) => MUTATING.test(c[1] ?? ''))) {
      expect(c).not.toContain(CFN_SERVICE_ROLE_NAME)
    }
  })

  it('leaves a group that still holds foreign schedules and reports it', () => {
    const w = installedWorld(expiresOn())
    const f = fakeAws(w)
    w.schedules.set('us-east-1/foreign', {})
    const r = cleanup(f.aws, quiet)
    expect(r.ok).toBe(false)
    expect(w.groups.has('us-east-1')).toBe(true)
    expect(w.schedules.has('us-east-1/foreign')).toBe(true)
  })
})

describe('createAws', () => {
  it('runs aws through spawnSync with an argument array and no shell', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0, stdout: '{"ok":1}', stderr: '' })
    const options = { profile: 'my profile', spawn: spawn as unknown as CreateAwsOptions['spawn'] }
    const aws = createAws(options)
    const r = aws(['sts', 'get-caller-identity'])
    expect(r).toMatchObject({ ok: true, status: 0, json: { ok: 1 } })
    expect(spawn).toHaveBeenCalledTimes(1)
    const [cmd, args, opts] = spawn.mock.calls[0]!
    expect(cmd).toBe('aws')
    expect(Array.isArray(args)).toBe(true)
    expect(args).toEqual(['sts', 'get-caller-identity', '--output', 'json', '--no-cli-pager', '--profile', 'my profile'])
    expect(opts.shell === undefined || opts.shell === false).toBe(true)
  })

  it('reports failure and unparsable output without throwing', () => {
    const spawn = vi.fn().mockReturnValueOnce({ status: 1, stdout: '', stderr: 'boom' }).mockReturnValueOnce({ status: 0, stdout: 'nope', stderr: '' })
    const aws = createAws({ spawn: spawn as unknown as CreateAwsOptions['spawn'] })
    expect(aws(['x'])).toMatchObject({ ok: false, status: 1, stderr: 'boom' })
    expect(aws(['x'])).toMatchObject({ ok: true, json: undefined })
    expect(spawn.mock.calls[0]![1]).not.toContain('--profile')
  })

  it('passes injected spawn through main for verify', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1, stdout: '', stderr: 'denied' })
    const err = vi.fn()
    expect(main(['verify', '--expires-on', expiresOn()], { spawn, log: quiet, err })).toBe(1)
    expect(spawn).toHaveBeenCalled()
    for (const call of spawn.mock.calls) expect(Array.isArray(call[1])).toBe(true)
  })
})
