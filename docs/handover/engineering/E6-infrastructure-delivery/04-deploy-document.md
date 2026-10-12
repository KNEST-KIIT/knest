# E6.04 The SSM deploy document, step by step

Source: `infra/cfn/app.yaml:496-649`, resource `DeployDocument`, an `AWS::SSM::Document` of type `Command`, schema 2.2, named `knest-${Environment}-deploy`. It runs one `aws:runShellScript` step with a 900 second timeout (`app.yaml:527-531`). All line references below are to `app.yaml`.

Hosted-evidence caveat: the document ran to the snapshot, migrate and start steps at least three times (three `pre-migrate-*` snapshots, `DRILLS.md:33-35`). The branch that provisions and switches to the runtime role, and the rollback branch (`:644-649`), have no hosted run on record (`DRILLS.md:49-51` D5 NOT RUN; `OPERATOR-COMMANDS.md:52-56`).

## 1. Resource-level properties

- `UpdateMethod: NewVersion` (`:503`). Without it, a content change replaces the document, and a custom name forbids replacement: CloudFormation rolled the whole stack update back on 2026-10-11 (`OPERATOR-COMMANDS.md:55`). With it, a content change creates a new document version in place.
- Because the document keeps its name across versions, the default version is what `aws ssm send-command --document-name` runs unless a version is named. Not determined from the code whether `NewVersion` also sets the new version as default; the 2026-10-11 reports expect so and do not record a hosted check.

## 2. Parameters (`:509-525`)

| Name | Default | Validation | Notes |
|---|---|---|---|
| `Environment` | `!Ref Environment` | **none** | Interpolated raw into the script (`:534`). See defect D-03. |
| `HostPort` | `'${AppPort}'` | `^[0-9]{4,5}$` | Must equal the target group and security group port. |
| `AppImage` | none | `^[0-9]+\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$` | A tag is refused at the SSM layer, before any shell runs. The pattern does not pin the account or repository; the instance role's `ecr:` permissions are scoped to one repository (`app.yaml:385-388`), which is what actually prevents pulling someone else's image. |
| `MigrateImage` | none | same pattern | Built from the same commit as `AppImage` by the release workflow. |

SSM Run Command substitutes `{{ Name }}` textually before the script is passed to the shell, which is why validation of every parameter matters.

## 3. Steps

### Step 0: setup (`:533-541`)

`set -euo pipefail`; read IMDSv2 token and region; define two helpers: `param <name>` reads `/knest-$ENVIRONMENT/config/<name>` from SSM, `secret <id>` reads `SecretString` from Secrets Manager. Failure mode: any helper failure aborts the script (errexit), before anything is changed.

### Step 1: registry login (`:543-545`)

`aws ecr get-login-password | docker login` with the registry derived from `AppImage` (`${APP_IMAGE%%/*}`). Uses the instance role; no stored credentials.

### Step 2: build the environment in memory (`:547-604`)

- `umask 077`, directory `/run/knest` (tmpfs on AL2023 by default; not asserted by the template), and `trap ... EXIT` deleting `common.env`, `migrate.env`, `app.env` however the script ends (`:553`).
- Master identity: `MASTER_SECRET` from the secret ARN stored in `db-secret-arn`; user taken verbatim, password URL-encoded with `jq @uri` (`:558-560`).
- Runtime identity: `db-runtime-secret-arn` is read with `2>/dev/null || true` and `"None"` handled (`:561-568`), so a stack from before this feature still deploys (the fallback documented in `V1-DEPLOYMENT-REPORT.md:99`).
- `common.env` (`:570-591`): `NODE_ENV=production`, `DATABASE_SSL=verify`, `DATABASE_SSL_CA_FILE=/etc/knest/rds-global-bundle.pem`, `AUTH_SECRET`, `PAYLOAD_SECRET`, `ORIGIN_VERIFY_SECRET`, `SITE_URL`, `AUTH_URL`, `AUTH_TRUST_HOST=true`, `CLIENT_IP_SOURCE=cloudfront`, Turnstile site and secret key, `S3_BUCKET`, `S3_REGION`, `EMAIL_TRANSPORT=ses`, `EMAIL_FROM`, `FEATURE_LAB_BOOKING`, `SITE_INDEXING`, and `ENQUIRY_NOTIFY_EMAIL` when set. No S3 key pair is written: the SDK uses the instance role. No `FEATURE_LAB_ATTENDANCE_QR` is written, so QR attendance cannot be switched on from this template (reference in `docs/handover/00-HANDOVER-PACK.md`: flag default off). No `AUTH_GOOGLE_*`.
- `migrate.env` (`:592-599`) = common + master `DATABASE_URL` + `DB_RUNTIME_USER`/`DB_RUNTIME_PASSWORD` when a runtime secret exists.
- `app.env` initially = common + **master** `DATABASE_URL` (`:600-604`). It is replaced after a successful migration if the runtime role was provisioned (Step 5).

Why two identities: the migration job must change the schema; the web container should not be able to (`src/db/runtime-role.ts:1-17`). Why the app env starts as master: a first deploy of this template onto an older stack, or a release whose migrate image lacks the role script, must not break (`V1-DEPLOYMENT-REPORT.md:99`). The cost: silent downgrade of the security property. The script prints `WARNING: runtime role not provisioned...` to stderr (`:627`); nothing alarms on it. Gate G5 of the cutover preflight checks only that the secret reference exists, not that the running container uses it (`cutover-preflight.sh:57-58`).

### Step 3: remember the previous image (`:606-608`)

`PREVIOUS=$(docker inspect knest | jq -r '.[0].Config.Image // empty')`, errors ignored. This is the image reference of the container currently running (or empty on first deploy). It is taken before any change.

### Step 4: snapshot (`:610-614`)

`aws rds create-db-snapshot` with identifier `pre-migrate-<UTC yyyymmddHHMMSS>` then `aws rds wait db-snapshot-available`. "Migrations only move forward, so take a restore point first and stop if it cannot be made." (`:610`). Failure modes:

- IAM or throttling failure: errexit; nothing migrated; old container untouched. Good.
- Waiter timeout: the AWS CLI waiter for `db-snapshot-available` polls on a fixed delay for a bounded number of attempts (30 s x 60 as published for the CLI; not verified in this environment). A first snapshot of a larger database can take longer than the SSM script's own 900 s timeout (`:530`), in which case SSM kills the script mid-wait. The result is a failed deploy with nothing changed, but the snapshot keeps running and a retry creates another snapshot. Not observed; flagged from the numbers.
- The snapshot costs: RDS snapshot storage beyond the free allocation (equal to database size) is billed; the template never deletes `pre-migrate-*` snapshots, so they accumulate (one per deploy attempt). No retention job exists. The operator policy denies `rds:DeleteDBSnapshot` (`infra/iam/operator-policy.json:166-168`), so removal is a root or admin action.

### Step 5: migrate (`:616-629`)

Pull `MigrateImage` and run it with `--rm`, `migrate.env`, the CA bundle mounted read-only, output captured to a temp file. The image's command is `pnpm migrate` (`Dockerfile:42`) which, per `package.json`, runs three commands in order: `tsx src/db/migrate.ts` (Drizzle, schema `app`), `payload migrate` (Payload, schema `cms`), `tsx src/db/runtime-role.ts`.

- Non-zero exit: print captured output to stderr, print "migration failed; the previous version keeps running", exit 1. The old container was never touched. Partial migration is possible: Drizzle and Payload migrations are separate transactions per migration; if Drizzle succeeds and Payload fails the database is half-forward. The snapshot taken in Step 4 is the only undo. This is why `RUNBOOK.md:151-158` demands additive-only migrations.
- Success and `DB_RUNTIME_USER` set: the script greps the captured log for `runtime role: <user> .*privileges applied` (`:620`), which matches the exact line printed by `src/db/runtime-role.ts:93` (`runtime role: knest_app created; owner knest_admin; privileges applied`). If the format of that line is changed, the grep fails silently and the app runs as master. There is no test linking the two (D-07). On match, `app.env` is rewritten with `DATABASE_URL` for the runtime role (password URL-encoded) (`:621-625`).
- `migrate.env` and the log are removed (`:629`).

### Step 6: start the new container (`:631-638`)

`docker pull "$APP_IMAGE"`, `docker rm -f knest` (so the old container stops here; downtime begins), then `docker run -d --name knest --restart unless-stopped --env-file app.env -v <CA bundle> -p ${HOST_PORT}:3000 --log-driver awslogs ...`. Log stream `app-<epoch>`.

Why remove before start: the host port can be bound by only one container, and the instance has 2 GiB of RAM; there is no overlap design (`S-1-SPEC.md` planned an overlap test that was never run).

### Step 7: wait for health (`:639-643`)

Loop up to 45 times, 2 s apart (90 s): `docker inspect knest | jq .State.Health.Status`. The image `HEALTHCHECK` is `--interval=30s --timeout=5s --start-period=30s --retries=3` calling `/api/health` (`Dockerfile:59-60`). Docker evaluates the first check one interval after start, so the earliest possible `healthy` is about 30 s and subsequent attempts are 30 s apart: effectively the loop sees three check opportunities (about 30, 60 and 90 s). A cold start that is not ready for `/api/health` by about 60 s may race the 90 s limit (derived from the numbers; not measured on the host). `/api/health` answers 200 only when `select 1` succeeds against the database (`src/app/api/health/route.ts`), so "healthy" means "can reach the database", not "pages render".

- Healthy: delete `common.env` and `app.env`, write `$APP_IMAGE` to `/opt/knest/current`, write `$PREVIOUS` to `/opt/knest/previous` if non-empty, `exit 0`.

### Step 8: rollback (`:644-649`)

After 90 s unhealthy: print `docker logs --tail 40`, remove the new container, and if `PREVIOUS` is set run `start "$PREVIOUS"` and print `restored $PREVIOUS`; remove `app.env`; `exit 1`. The run is marked failed so the pipeline job fails.

Properties and limits of the rollback:

1. **It does not roll the database back.** Migrations already applied stay applied. The previous image must tolerate the new schema; additive-only migrations are the protection (`RUNBOOK.md:151-158`).
2. **No health wait after the rollback start.** The script exits 1 immediately after `start "$PREVIOUS"`; whether the restored container becomes healthy is not checked. After a first-ever deploy `PREVIOUS` is empty and nothing is restored: the site is down.
3. **The restored container uses the new `app.env`**, which at this point may carry the runtime role credentials: acceptable because the role exists and is idempotent.
4. **Docker `--restart unless-stopped`** will restart a crashing container indefinitely; a crash loop is visible only in logs and in `HealthyTargetsAlarm`.
5. The previous image is available locally because nothing prunes images; if the host were rebuilt there is no `PREVIOUS` anyway.

## 4. Sequence diagram

```
workflow -> SSM send-command (digests)
host: login ECR; read params/secrets; PREVIOUS := running image
host: rds create-db-snapshot pre-migrate-<ts>; wait available       [stop if fails]
host: docker run migrate image: drizzle -> payload -> runtime role  [stop if fails; old app untouched]
host: if log says "privileges applied": app DB identity := knest_app else master + WARNING
host: docker rm -f knest; docker run new image                      [outage starts]
host: poll health <= 90 s
        healthy  -> record current/previous; exit 0                 [outage ends]
        unhealthy-> remove; start PREVIOUS; exit 1
```

## 5. Defects and hazards specific to this document

- **D-03, `Environment` parameter is unvalidated** (`:510-512`) and is interpolated into the shell (`:534`). The pipeline's deploy role is documented as able to "only run the deploy document" (`ci.yaml:3-8`), but anyone holding `ssm:SendCommand` on this document can pass `Environment` as a shell fragment and execute arbitrary commands as root on the host (which can read every secret the instance role can). `HostPort` and the image parameters do have patterns. A one-line `allowedPattern: '^(s1|production)$'` closes it. Not exploited, not tested.
- **D-04, success path leaves `docker` images and snapshots unbounded** (Step 4, `03-...md` section 6).
- **D-05, the runtime-role success test is a grep on a log line** (Step 5), unlinked to the printing code by any test.
- **Concurrent deploys.** Nothing locks. The workflow serialises per environment with a concurrency group (`release-image.yml:34-36`), but an operator running `aws ssm send-command` by hand at the same time as the workflow would interleave two scripts on one host; both would `docker rm -f knest`. Not guarded.
- **Secret exposure on the host.** `docker inspect knest` shows the full environment, including `AUTH_SECRET`, the database password and the Turnstile secret, to root and members of the `docker` group. SSM Session Manager sessions run as `ssm-user`, which is in `sudoers` on Amazon Linux by default; not determined from the template whether the Session Manager preferences restrict this.
- **Command output is truncated by SSM** (the console and `get-command-invocation` keep only the last 24,000 characters of stdout, SSM service behaviour, not verified here). The migration log is printed whole; a very chatty migration could push the `runtime role:` line out of the visible record even though the grep saw it. The log stream in CloudWatch is for the application, not the deploy script.
