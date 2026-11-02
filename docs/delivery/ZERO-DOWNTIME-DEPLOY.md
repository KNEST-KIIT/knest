# Deploy outage: what it is, what changed, and the path to none

## Where the time went

A deploy replaces the single app container (`scripts` in `infra/cfn/app.yaml`): pull the image, remove the old
container, start the new one, wait for it to be healthy, roll back if it is not. While that happens the load balancer
has no healthy target and visitors get a gateway error. The outage is the sum of:

| Step | Before | Now |
|---|---|---|
| New container boots and starts answering | about 15 s | about 15 s (unchanged) |
| Load balancer needs two passing checks in a row (`HealthyThresholdCount: 2`) | 2 x 30 s = about 60 s | 2 x 10 s = about 20 s |
| Docker's own check, which the deploy script waits on before it declares success | first check at 30 s | first check at 10 s |
| **Estimated visitor-facing gap** | **about 75 s** | **about 35 s** |

The "before" and "now" figures are arithmetic from the settings, not measurements. Measure the real gap on the first
production deploy: run `curl -s -o /dev/null -w '%{http_code} ' https://<site>/api/health` in a loop during the deploy
and count the non-200s.

The changes: `HealthCheckIntervalSeconds: 10` on the target group (`infra/cfn/origin.yaml`) and
`HEALTHCHECK --interval=10s --start-period=15s` in the `Dockerfile`. `/api/health` is one cheap query, so checking it
three times as often is negligible load.

## Why it is not zero yet

One instance runs one container. With nothing else to take traffic, there is always a gap while its replacement
starts. Closing the gap needs a second place to serve from while the first is replaced. Two ways, in order of effort:

### A. Two slots on the same instance (no extra cost)

1. The target group registers the instance on two ports, 3000 and 3001 (`Targets` in `origin.yaml`), and the instance
   security group admits both from the load balancer.
2. The deploy script keeps a file naming the live slot. It starts the new image on the OTHER port, waits until it
   answers `/api/health` locally, then asks the load balancer (`elbv2 register-targets` / `describe-target-health`)
   to wait until that target is healthy.
3. It then deregisters the old slot (the 60 s `deregistration_delay` already drains in-flight requests), waits out the
   drain, and stops the old container. Rollback is the same swap in reverse.
4. The instance role needs `elasticloadbalancing:RegisterTargets`, `DeregisterTargets` and `DescribeTargetHealth` on
   the target group, and the deploy document needs the target group ARN as a parameter.

Costs: memory for two containers during the swap (the 2 GB host needs the memory limit set first; see the container
memory setting in the audit document), and a migration window in which both versions run against one schema, which
the migration-safety test (`src/db/migration-safety.test.ts`) already enforces.

### B. A second instance behind the same load balancer

Roll one instance at a time. No port juggling, and it also removes the single-host failure, but it doubles the app
cost and needs a shared place for anything the container writes locally (nothing in the app does today).

## What exists now

`scripts/ops/deploy-slot.sh <image>` is Option A's swap, written and tested on its own. `infra/deploy-slot.test.ts` runs
it with stand-in `docker`, `aws` and `sleep` commands and checks the ORDER of operations, which is what matters:

- the release starts in the idle slot (a on 3000, b on 3001; the old single `knest` container counts as live on 3000);
- it is proven healthy by Docker, registered, and proven healthy by the load balancer, **before** the old slot is touched;
- the old slot is deregistered, drained for the full delay, and only then removed;
- if the new container never becomes healthy, or the load balancer never agrees, the new slot is removed (and taken out of
  rotation if it was registered) and the old slot is left exactly as it was, with a non-zero exit;
- if both slots are somehow running it refuses to guess.

It is also wired into the deploy document, OFF by default:

- `infra/cfn/app.yaml`: stack parameter `ZeroDowntimeDeploy` (`on`/`off`, default `off`) stored as the SSM setting
  `/knest-production/config/zero-downtime-deploy`; the deploy script reads it and, only when it is `on`, runs the swap. Otherwise
  the in-place replacement runs exactly as before. The script is embedded in the document (it cannot include a file) and
  `infra/deploy-slot-embedded.test.ts` fails if the copy differs from the file; `node scripts/sync-deploy-slot.mjs`
  refreshes it. The same test syntax-checks the entire document script and checks the swap script contains no pair of
  opening braces, which SSM would read as a parameter placeholder (this is why it uses `jq` instead of Docker templates).
- `infra/cfn/app.yaml`: the instance role may register and deregister targets in this account and region, and read target health.
- `infra/cfn/origin.yaml`: the target group lists the instance on both ports (3000 and 3001), the security groups admit 3001
  from the load balancer, and the target group's ARN is published as `/knest-production/config/target-group-arn`.
  The second port stays unhealthy and receives nothing until a swap deploy starts a container there.

What is NOT done, and why each needs a real account:

1. **Prove it on the S-1 stack** with a real load balancer: set `ZeroDowntimeDeploy` to `on`, run two deploys in a row while
   looping on `/api/health`, and count non-200 responses. That count is the number to put in this document. S-1 has no
   production load balancer today, so it needs one added for the trial, or the trial runs on a short-lived production-shaped stack.
2. **Apply the origin stack change** (additive: two security group rules, one target, one parameter). It is safe with the switch off.
3. **Set the container memory limit first**: two containers briefly share the 2 GB host.
4. The setting is read at deploy time, so the first swap deploy is also the first time the new branch runs on a host.
   Keep a console session open for it, and know that the failure mode is "the old container keeps serving and the deploy
   reports failure", which the tests cover.

## Why it is off by default

Option A changes the deploy script that every future release runs through. The tests prove its order of operations and
that it cannot break the document, but only a real load balancer proves the whole. So it ships off, and is switched on
only after the trial above.
