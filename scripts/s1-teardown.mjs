#!/usr/bin/env node
// S-1 automated teardown: four EventBridge Scheduler one-time schedules that call
// cloudformation:DeleteStack through the universal target, using the knest-s1-scheduler role,
// which passes the knest-s1-cfn-service role to CloudFormation.
//
//   node scripts/s1-teardown.mjs plan    --expires-on YYYY-MM-DD
//   node scripts/s1-teardown.mjs install --expires-on YYYY-MM-DD [--profile NAME]
//   node scripts/s1-teardown.mjs verify  --expires-on YYYY-MM-DD [--profile NAME]
//   node scripts/s1-teardown.mjs cleanup [--profile NAME]
//
// plan makes no AWS call. install creates only the knest-s1-scheduler role and its inline policy,
// the schedule groups and the four schedules, and refuses to continue when a resource of the same
// name already exists with different content. verify is read-only and exact. cleanup refuses while
// any of the four S-1 stacks exists and deletes only scheduler resources and the scheduler role;
// it never touches knest-s1-cfn-service.
//
// Every aws call is spawnSync with an argument array, never a shell string.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const ACCOUNT_ID = '166917387892';
export const GROUP_NAME = 'knest-s1';
export const SCHEDULER_ROLE_NAME = 'knest-s1-scheduler';
export const SCHEDULER_POLICY_NAME = 'knest-s1-scheduler-delete-stacks';
export const SCHEDULER_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/${SCHEDULER_ROLE_NAME}`;
export const CFN_SERVICE_ROLE_NAME = 'knest-s1-cfn-service';
export const CFN_SERVICE_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/${CFN_SERVICE_ROLE_NAME}`;
export const DELETE_STACK_TARGET_ARN = 'arn:aws:scheduler:::aws-sdk:cloudformation:deleteStack';
export const RETRY_POLICY = Object.freeze({ MaximumRetryAttempts: 3, MaximumEventAgeInSeconds: 3600 });
export const MAX_DAYS_AHEAD = 7;

// The four stacks, with the region each lives in, the schedule name and the UTC hour of deletion.
// Delete in three stages. CloudFront must release the WAF ACL before the WAF stack is deleted;
// the application and CI stacks follow only after both edge layers have had time to disappear.
export const STACKS = Object.freeze([
  { key: 'edge', stackName: 'knest-s1-edge', region: 'ap-south-1', scheduleName: 'knest-s1-expire-edge', hourUtc: 0 },
  { key: 'waf', stackName: 'knest-s1-waf', region: 'us-east-1', scheduleName: 'knest-s1-expire-waf', hourUtc: 2 },
  { key: 'app', stackName: 'knest-s1', region: 'ap-south-1', scheduleName: 'knest-s1-expire-app', hourUtc: 4 },
  { key: 'ci', stackName: 'knest-s1-ci', region: 'ap-south-1', scheduleName: 'knest-s1-expire-ci', hourUtc: 4 },
]);

export const REGIONS = Object.freeze([...new Set(STACKS.map((s) => s.region))]);

// ---------------------------------------------------------------- pure builders

export function parseExpiresOn(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--expires-on must be a date written YYYY-MM-DD');
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`--expires-on ${value} is not a real calendar date`);
  }
  return value;
}

// Install only: the date must be in the future and at most 7 days after today (UTC).
export function assertExpiryWindow(expiresOn, now = new Date()) {
  parseExpiresOn(expiresOn);
  const edgeAt = Date.parse(`${expiresOn}T00:00:00Z`);
  if (!(edgeAt > now.getTime())) {
    throw new Error(`--expires-on ${expiresOn}: 00:00 UTC on that date has already passed, so a one-time schedule cannot be created`);
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - today) / 86400000);
  if (days > MAX_DAYS_AHEAD) {
    throw new Error(`--expires-on ${expiresOn} is ${days} days away; S-1 allows at most ${MAX_DAYS_AHEAD}`);
  }
}

export function scheduleExpression(expiresOn, hourUtc) {
  parseExpiresOn(expiresOn);
  return `at(${expiresOn}T${String(hourUtc).padStart(2, '0')}:00:00)`;
}

export function buildStackArn(stack) {
  return `arn:aws:cloudformation:${stack.region}:${ACCOUNT_ID}:stack/${stack.stackName}/*`;
}

export function buildDeleteStackInput(stack) {
  return { StackName: stack.stackName, RoleARN: CFN_SERVICE_ROLE_ARN };
}

export function buildTarget(stack) {
  return {
    Arn: DELETE_STACK_TARGET_ARN,
    RoleArn: SCHEDULER_ROLE_ARN,
    Input: JSON.stringify(buildDeleteStackInput(stack)),
    RetryPolicy: { ...RETRY_POLICY },
  };
}

export function buildScheduleSpec(stack, expiresOn) {
  return {
    region: stack.region,
    groupName: GROUP_NAME,
    name: stack.scheduleName,
    stackName: stack.stackName,
    description: `S-1 teardown: delete stack ${stack.stackName} in ${stack.region}`,
    scheduleExpression: scheduleExpression(expiresOn, stack.hourUtc),
    scheduleExpressionTimezone: 'UTC',
    flexibleTimeWindow: { Mode: 'OFF' },
    actionAfterCompletion: 'DELETE',
    state: 'ENABLED',
    target: buildTarget(stack),
  };
}

export function buildSchedulePlan(expiresOn) {
  return STACKS.map((s) => buildScheduleSpec(s, expiresOn));
}

export function buildSchedulerTrustPolicy() {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'scheduler.amazonaws.com' },
        Action: 'sts:AssumeRole',
        Condition: {
          StringEquals: { 'aws:SourceAccount': ACCOUNT_ID },
          ArnLike: { 'aws:SourceArn': `arn:aws:scheduler:*:${ACCOUNT_ID}:schedule-group/${GROUP_NAME}` },
        },
      },
    ],
  };
}

export function buildSchedulerPermissionsPolicy() {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'DeleteOnlyTheS1Stacks',
        Effect: 'Allow',
        Action: 'cloudformation:DeleteStack',
        Resource: [
          buildStackArn(STACKS.find((s) => s.key === 'app')),
          buildStackArn(STACKS.find((s) => s.key === 'edge')),
          buildStackArn(STACKS.find((s) => s.key === 'ci')),
          buildStackArn(STACKS.find((s) => s.key === 'waf')),
        ],
      },
      {
        Sid: 'HandTheDeleteToTheServiceRoleOnly',
        Effect: 'Allow',
        Action: 'iam:PassRole',
        Resource: CFN_SERVICE_ROLE_ARN,
        Condition: { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } },
      },
    ],
  };
}

export const SCHEDULER_ROLE_DESCRIPTION = 'S-1 teardown: lets EventBridge Scheduler delete the four S-1 stacks and nothing else';

export function buildCreateGroupArgs(region) {
  return ['scheduler', 'create-schedule-group', '--name', GROUP_NAME, '--region', region];
}

export function buildCreateScheduleArgs(spec) {
  return [
    'scheduler', 'create-schedule',
    '--name', spec.name,
    '--group-name', spec.groupName,
    '--description', spec.description,
    '--schedule-expression', spec.scheduleExpression,
    '--schedule-expression-timezone', spec.scheduleExpressionTimezone,
    '--flexible-time-window', JSON.stringify(spec.flexibleTimeWindow),
    '--action-after-completion', spec.actionAfterCompletion,
    '--state', spec.state,
    '--target', JSON.stringify(spec.target),
    '--region', spec.region,
  ];
}

export function buildCreateRoleArgs() {
  return [
    'iam', 'create-role',
    '--role-name', SCHEDULER_ROLE_NAME,
    '--description', SCHEDULER_ROLE_DESCRIPTION,
    '--assume-role-policy-document', JSON.stringify(buildSchedulerTrustPolicy()),
  ];
}

export function buildPutRolePolicyArgs() {
  return [
    'iam', 'put-role-policy',
    '--role-name', SCHEDULER_ROLE_NAME,
    '--policy-name', SCHEDULER_POLICY_NAME,
    '--policy-document', JSON.stringify(buildSchedulerPermissionsPolicy()),
  ];
}

// Cleanup builders. The only role they can name is the scheduler role.
export function buildDeleteScheduleArgs(region, name) {
  return ['scheduler', 'delete-schedule', '--name', name, '--group-name', GROUP_NAME, '--region', region];
}
export function buildDeleteGroupArgs(region) {
  return ['scheduler', 'delete-schedule-group', '--name', GROUP_NAME, '--region', region];
}
export function buildDeleteRolePolicyArgs() {
  return ['iam', 'delete-role-policy', '--role-name', SCHEDULER_ROLE_NAME, '--policy-name', SCHEDULER_POLICY_NAME];
}
export function buildDeleteRoleArgs() {
  return ['iam', 'delete-role', '--role-name', SCHEDULER_ROLE_NAME];
}

// Key-sorted JSON so two documents compare equal regardless of property order.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Returns a list of human-readable mismatches; empty means the live schedule is exactly the spec.
export function diffSchedule(actual, spec) {
  const out = [];
  const eq = (label, got, want) => {
    if (canonical(got) !== canonical(want)) out.push(`${label}: found ${canonical(got)}, expected ${canonical(want)}`);
  };
  if (!actual || typeof actual !== 'object') return ['schedule response is not an object'];
  eq('Name', actual.Name, spec.name);
  eq('GroupName', actual.GroupName, spec.groupName);
  eq('ScheduleExpression', actual.ScheduleExpression, spec.scheduleExpression);
  eq('ScheduleExpressionTimezone', actual.ScheduleExpressionTimezone, spec.scheduleExpressionTimezone);
  eq('FlexibleTimeWindow', actual.FlexibleTimeWindow, spec.flexibleTimeWindow);
  eq('ActionAfterCompletion', actual.ActionAfterCompletion, spec.actionAfterCompletion);
  eq('State', actual.State, spec.state);
  eq('Description', actual.Description, spec.description);
  for (const k of ['StartDate', 'EndDate', 'KmsKeyArn']) {
    if (actual[k] !== undefined && actual[k] !== null) out.push(`${k}: present, expected absent`);
  }
  const t = actual.Target;
  if (!t || typeof t !== 'object') {
    out.push('Target: missing');
    return out;
  }
  const allowed = new Set(['Arn', 'RoleArn', 'Input', 'RetryPolicy']);
  for (const k of Object.keys(t)) if (!allowed.has(k)) out.push(`Target.${k}: present, expected absent`);
  eq('Target.Arn', t.Arn, spec.target.Arn);
  eq('Target.RoleArn', t.RoleArn, spec.target.RoleArn);
  eq('Target.RetryPolicy', t.RetryPolicy, spec.target.RetryPolicy);
  let input;
  try {
    input = JSON.parse(t.Input);
  } catch {
    input = t.Input;
  }
  eq('Target.Input', input, JSON.parse(spec.target.Input));
  return out;
}

export function diffDocument(label, actual, expected) {
  return canonical(actual) === canonical(expected) ? [] : [`${label}: differs from the expected document`];
}

export function parseArgs(argv) {
  const out = { command: undefined, expiresOn: undefined, profile: undefined, allowRootBootstrap: false, help: false };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    const take = (name) => {
      if (a === name) {
        const v = rest.shift();
        if (v === undefined || v.startsWith('--')) throw new Error(`${name} needs a value`);
        return v;
      }
      return a.slice(name.length + 1);
    };
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--expires-on' || a.startsWith('--expires-on=')) out.expiresOn = take('--expires-on');
    else if (a === '--profile' || a.startsWith('--profile=')) out.profile = take('--profile');
    else if (a === '--allow-root-bootstrap') out.allowRootBootstrap = true;
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else if (out.command === undefined) out.command = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (out.profile !== undefined && !/^[A-Za-z0-9_.@:+=,\- ]+$/.test(out.profile)) {
    throw new Error('--profile contains characters that are not valid in a profile name');
  }
  return out;
}

// ---------------------------------------------------------------- aws runner

export function createAws({ profile, spawn = spawnSync } = {}) {
  return function aws(args) {
    const full = [...args, '--output', 'json', '--no-cli-pager'];
    if (profile) full.push('--profile', profile);
    const r = spawn('aws', full, { encoding: 'utf8', windowsHide: true, env: { ...process.env, AWS_PAGER: '' } });
    const stdout = r.stdout ?? '';
    const stderr = r.stderr ?? (r.error ? String(r.error.message) : '');
    let json;
    if (r.status === 0 && stdout.trim()) {
      try {
        json = JSON.parse(stdout);
      } catch {
        json = undefined;
      }
    }
    return { ok: r.status === 0, status: r.status, stdout, stderr, json };
  };
}

const notFound = (r) => /ResourceNotFoundException|NoSuchEntity|does not exist/i.test(r.stderr);

function must(r, what) {
  if (!r.ok) throw new Error(`${what} failed: ${r.stderr.trim() || `exit ${r.status}`}`);
  return r.json;
}

// ---------------------------------------------------------------- operations

export function checkIdentity(aws, { allowRoot = false } = {}) {
  const id = must(aws(['sts', 'get-caller-identity']), 'sts get-caller-identity');
  if (id.Account !== ACCOUNT_ID) throw new Error(`caller is in account ${id.Account}; S-1 is ${ACCOUNT_ID}`);
  if (/:root$/.test(id.Arn) && !allowRoot) {
    throw new Error('caller is the account root; pass --allow-root-bootstrap only with explicit owner authorization');
  }
  return id;
}

function getRole(aws, name) {
  const r = aws(['iam', 'get-role', '--role-name', name]);
  if (!r.ok && notFound(r)) return undefined;
  return must(r, `iam get-role ${name}`).Role;
}

// Mismatches for the scheduler role; undefined role is reported as a single "missing" entry.
export function inspectSchedulerRole(aws) {
  const role = getRole(aws, SCHEDULER_ROLE_NAME);
  if (!role) return { exists: false, problems: [`role ${SCHEDULER_ROLE_NAME} does not exist`] };
  const problems = [];
  if (role.Arn !== SCHEDULER_ROLE_ARN) problems.push(`role ARN ${role.Arn} is not ${SCHEDULER_ROLE_ARN}`);
  problems.push(...diffDocument('trust policy', role.AssumeRolePolicyDocument, buildSchedulerTrustPolicy()));
  if (role.PermissionsBoundary) problems.push('a permissions boundary is set');
  const inline = must(aws(['iam', 'list-role-policies', '--role-name', SCHEDULER_ROLE_NAME]), 'iam list-role-policies').PolicyNames;
  if (canonical([...inline].sort()) !== canonical([SCHEDULER_POLICY_NAME])) {
    problems.push(`inline policies are ${canonical(inline)}, expected only ${SCHEDULER_POLICY_NAME}`);
  } else {
    const doc = must(
      aws(['iam', 'get-role-policy', '--role-name', SCHEDULER_ROLE_NAME, '--policy-name', SCHEDULER_POLICY_NAME]),
      'iam get-role-policy',
    ).PolicyDocument;
    problems.push(...diffDocument(`inline policy ${SCHEDULER_POLICY_NAME}`, doc, buildSchedulerPermissionsPolicy()));
  }
  const attached = must(aws(['iam', 'list-attached-role-policies', '--role-name', SCHEDULER_ROLE_NAME]), 'iam list-attached-role-policies').AttachedPolicies;
  if (attached.length) problems.push(`managed policies attached: ${attached.map((p) => p.PolicyName).join(', ')}`);
  return { exists: true, problems };
}

function requireServiceRole(aws) {
  if (!getRole(aws, CFN_SERVICE_ROLE_NAME)) {
    throw new Error(`${CFN_SERVICE_ROLE_NAME} does not exist; the schedules would have nothing to pass to CloudFormation`);
  }
}

function getGroup(aws, region) {
  const r = aws(['scheduler', 'get-schedule-group', '--name', GROUP_NAME, '--region', region]);
  if (!r.ok && notFound(r)) return undefined;
  return must(r, `scheduler get-schedule-group (${region})`);
}

function listGroupScheduleNames(aws, region) {
  const r = aws(['scheduler', 'list-schedules', '--group-name', GROUP_NAME, '--region', region]);
  return must(r, `scheduler list-schedules (${region})`).Schedules.map((s) => s.Name);
}

function getSchedule(aws, region, name) {
  const r = aws(['scheduler', 'get-schedule', '--name', name, '--group-name', GROUP_NAME, '--region', region]);
  if (!r.ok && notFound(r)) return undefined;
  return must(r, `scheduler get-schedule ${name} (${region})`);
}

export function planText(expiresOn) {
  const lines = [`S-1 teardown plan for ExpiresOn ${expiresOn} (nothing is created by this command)`, ''];
  lines.push(`role   ${SCHEDULER_ROLE_ARN}  (trust: scheduler.amazonaws.com for schedule-group/${GROUP_NAME} in ${ACCOUNT_ID})`);
  lines.push(`policy ${SCHEDULER_POLICY_NAME}  (cloudformation:DeleteStack on the four stacks; iam:PassRole on ${CFN_SERVICE_ROLE_NAME} to cloudformation only)`);
  for (const region of REGIONS) lines.push(`group  ${GROUP_NAME} in ${region}`);
  lines.push('');
  for (const spec of buildSchedulePlan(expiresOn)) {
    lines.push(`${spec.region.padEnd(10)} ${spec.name.padEnd(22)} ${spec.scheduleExpression} UTC  DeleteStack ${spec.stackName}  (retry ${spec.target.RetryPolicy.MaximumRetryAttempts}x within ${spec.target.RetryPolicy.MaximumEventAgeInSeconds}s, deleted after it runs)`);
  }
  return lines.join('\n');
}

export function install(aws, expiresOn, log = console.log, { allowRoot = false } = {}) {
  assertExpiryWindow(expiresOn);
  const id = checkIdentity(aws, { allowRoot });
  log(`caller ${id.Arn}`);
  requireServiceRole(aws);
  const plan = buildSchedulePlan(expiresOn);

  // Inspect everything first so a mismatch stops the run before anything is created.
  const role = inspectSchedulerRole(aws);
  if (role.exists && role.problems.length) throw new Error(`existing ${SCHEDULER_ROLE_NAME} does not match:\n  ${role.problems.join('\n  ')}`);
  const groups = new Map();
  const existing = new Map();
  for (const region of REGIONS) {
    const g = getGroup(aws, region);
    groups.set(region, g);
    if (g && g.State !== 'ACTIVE') throw new Error(`schedule group ${GROUP_NAME} in ${region} is ${g.State}, not ACTIVE`);
    if (g) {
      const expected = new Set(plan.filter((p) => p.region === region).map((p) => p.name));
      const stray = listGroupScheduleNames(aws, region).filter((n) => !expected.has(n));
      if (stray.length) throw new Error(`group ${GROUP_NAME} in ${region} holds unexpected schedules: ${stray.join(', ')}`);
    }
  }
  for (const spec of plan) {
    const live = groups.get(spec.region) ? getSchedule(aws, spec.region, spec.name) : undefined;
    if (live) {
      const diffs = diffSchedule(live, spec);
      if (diffs.length) throw new Error(`existing schedule ${spec.name} (${spec.region}) does not match:\n  ${diffs.join('\n  ')}`);
    }
    existing.set(spec.name, Boolean(live));
  }

  if (!role.exists) {
    must(aws(buildCreateRoleArgs()), `create role ${SCHEDULER_ROLE_NAME}`);
    log(`created role ${SCHEDULER_ROLE_NAME}`);
  } else {
    log(`role ${SCHEDULER_ROLE_NAME} already matches`);
  }
  // put-role-policy is idempotent and the inspection above proved any existing policy is identical.
  if (!role.exists || !role.problems.length) must(aws(buildPutRolePolicyArgs()), `put policy ${SCHEDULER_POLICY_NAME}`);

  for (const region of REGIONS) {
    if (groups.get(region)) log(`group ${GROUP_NAME} (${region}) already exists`);
    else {
      must(aws(buildCreateGroupArgs(region)), `create schedule group (${region})`);
      log(`created group ${GROUP_NAME} (${region})`);
    }
  }
  for (const spec of plan) {
    if (existing.get(spec.name)) log(`schedule ${spec.name} (${spec.region}) already matches`);
    else {
      must(aws(buildCreateScheduleArgs(spec)), `create schedule ${spec.name}`);
      log(`created schedule ${spec.name} (${spec.region}) ${spec.scheduleExpression} UTC`);
    }
  }
  return verify(aws, expiresOn, log, { allowRoot });
}

// Read-only. Returns { ok, problems }.
export function verify(aws, expiresOn, log = console.log, { allowRoot = false } = {}) {
  parseExpiresOn(expiresOn);
  const id = checkIdentity(aws, { allowRoot });
  log(`caller ${id.Arn}`);
  const problems = [];
  const svc = getRole(aws, CFN_SERVICE_ROLE_NAME);
  if (!svc) problems.push(`${CFN_SERVICE_ROLE_NAME} does not exist`);
  else if (svc.Arn !== CFN_SERVICE_ROLE_ARN) problems.push(`${CFN_SERVICE_ROLE_NAME} ARN is ${svc.Arn}`);
  const role = inspectSchedulerRole(aws);
  problems.push(...role.problems.map((p) => `${SCHEDULER_ROLE_NAME}: ${p}`));
  const plan = buildSchedulePlan(expiresOn);
  for (const region of REGIONS) {
    const g = getGroup(aws, region);
    if (!g) {
      problems.push(`schedule group ${GROUP_NAME} (${region}) does not exist`);
      continue;
    }
    if (g.State !== 'ACTIVE') problems.push(`schedule group ${GROUP_NAME} (${region}) is ${g.State}`);
    const expected = plan.filter((p) => p.region === region).map((p) => p.name);
    const names = listGroupScheduleNames(aws, region);
    const stray = names.filter((n) => !expected.includes(n));
    if (stray.length) problems.push(`group ${GROUP_NAME} (${region}) holds unexpected schedules: ${stray.join(', ')}`);
  }
  for (const spec of plan) {
    const live = getSchedule(aws, spec.region, spec.name);
    if (!live) {
      problems.push(`schedule ${spec.name} (${spec.region}) does not exist`);
      continue;
    }
    problems.push(...diffSchedule(live, spec).map((d) => `${spec.name} (${spec.region}): ${d}`));
  }
  for (const p of problems) log(`FAIL ${p}`);
  if (!problems.length) log(`PASS scheduler role, ${REGIONS.length} groups and ${plan.length} schedules match exactly`);
  return { ok: problems.length === 0, problems };
}

export function cleanup(aws, log = console.log, { allowRoot = false } = {}) {
  const id = checkIdentity(aws, { allowRoot });
  log(`caller ${id.Arn}`);
  // Refuse while any S-1 stack exists, whatever its status. An unreadable answer also refuses.
  const present = [];
  for (const s of STACKS) {
    const r = aws(['cloudformation', 'describe-stacks', '--stack-name', s.stackName, '--region', s.region]);
    if (r.ok) present.push(`${s.stackName} (${s.region}) ${r.json?.Stacks?.[0]?.StackStatus ?? 'unknown status'}`);
    else if (!/does not exist/i.test(r.stderr)) throw new Error(`cannot tell whether ${s.stackName} exists: ${r.stderr.trim() || `exit ${r.status}`}`);
  }
  if (present.length) throw new Error(`refusing to clean up while S-1 stacks exist:\n  ${present.join('\n  ')}`);

  const ours = new Map(REGIONS.map((r) => [r, STACKS.filter((s) => s.region === r).map((s) => s.scheduleName)]));
  const leftovers = [];
  for (const [region, names] of ours) {
    if (!getGroup(aws, region)) {
      log(`group ${GROUP_NAME} (${region}) not present`);
      continue;
    }
    for (const name of names) {
      const r = aws(buildDeleteScheduleArgs(region, name));
      if (r.ok) log(`deleted schedule ${name} (${region})`);
      else if (notFound(r)) log(`schedule ${name} (${region}) already gone`);
      else throw new Error(`delete schedule ${name} (${region}) failed: ${r.stderr.trim()}`);
    }
    const remaining = listGroupScheduleNames(aws, region);
    if (remaining.length) {
      leftovers.push(`group ${GROUP_NAME} (${region}) still holds ${remaining.join(', ')}; left in place`);
      continue;
    }
    const r = aws(buildDeleteGroupArgs(region));
    if (r.ok) log(`deleted group ${GROUP_NAME} (${region})`);
    else if (!notFound(r)) throw new Error(`delete group (${region}) failed: ${r.stderr.trim()}`);
  }

  if (getRole(aws, SCHEDULER_ROLE_NAME)) {
    const pol = must(aws(['iam', 'list-role-policies', '--role-name', SCHEDULER_ROLE_NAME]), 'iam list-role-policies').PolicyNames;
    if (pol.includes(SCHEDULER_POLICY_NAME)) {
      must(aws(buildDeleteRolePolicyArgs()), `delete role policy ${SCHEDULER_POLICY_NAME}`);
      log(`deleted policy ${SCHEDULER_POLICY_NAME}`);
    }
    // delete-role fails by itself if anything else is still attached, which is the safe outcome.
    must(aws(buildDeleteRoleArgs()), `delete role ${SCHEDULER_ROLE_NAME}`);
    log(`deleted role ${SCHEDULER_ROLE_NAME}`);
  } else {
    log(`role ${SCHEDULER_ROLE_NAME} not present`);
  }
  log(`${CFN_SERVICE_ROLE_NAME} was not touched`);
  for (const l of leftovers) log(`NOTE ${l}`);
  return { ok: leftovers.length === 0, problems: leftovers };
}

const USAGE = `usage:
  node scripts/s1-teardown.mjs plan    --expires-on YYYY-MM-DD
  node scripts/s1-teardown.mjs install --expires-on YYYY-MM-DD [--profile NAME] [--allow-root-bootstrap]
  node scripts/s1-teardown.mjs verify  --expires-on YYYY-MM-DD [--profile NAME] [--allow-root-bootstrap]
  node scripts/s1-teardown.mjs cleanup [--profile NAME] [--allow-root-bootstrap]`;

export function main(argv = process.argv.slice(2), { spawn = spawnSync, log = console.log, err = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv);
    if (args.help) {
      log(USAGE);
      return 0;
    }
    if (!['plan', 'install', 'verify', 'cleanup'].includes(args.command)) throw new Error('command must be plan, install, verify or cleanup');
    if (args.command !== 'cleanup') {
      if (!args.expiresOn) throw new Error(`${args.command} needs --expires-on`);
      parseExpiresOn(args.expiresOn);
    } else if (args.expiresOn) {
      throw new Error('cleanup does not take --expires-on');
    }
    if (args.command === 'plan' && (args.profile || args.allowRootBootstrap)) {
      throw new Error('plan makes no AWS call and does not take --profile or --allow-root-bootstrap');
    }
  } catch (e) {
    err(`${e.message}\n${USAGE}`);
    return 2;
  }
  try {
    if (args.command === 'plan') {
      log(planText(args.expiresOn));
      return 0;
    }
    const aws = createAws({ profile: args.profile, spawn });
    const identityOptions = { allowRoot: args.allowRootBootstrap };
    const result =
      args.command === 'install' ? install(aws, args.expiresOn, log, identityOptions)
      : args.command === 'verify' ? verify(aws, args.expiresOn, log, identityOptions)
      : cleanup(aws, log, identityOptions);
    return result.ok ? 0 : 1;
  } catch (e) {
    err(`FAIL ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
