# Release drills: evidence and what is still open

Date: 2026-10-11. A drill counts only when it has a date, the exact SHA or snapshot, the command and the result. Anything not run here is marked **NOT RUN** with the command that runs it. No drill below deleted data, a snapshot or a stack.

## D1. Populated-data upgrade: RUN (local, throwaway PostgreSQL 16)

Command: `pnpm exec tsx scripts/drills/populated-upgrade.mts 1` at branch `codex/production-v1`, 2026-10-11.

| Step | Detail | Result |
|---|---|---|
| previous release applied | 11 of 12 migrations | ok |
| rows seeded before upgrade | users=200 enquiries=50 | ok |
| rows after upgrade | users=200 enquiries=50 | ok |
| new release applied | 12 of 12 migrations | ok |
| sample row intact | drill-7@example.test | ok |
| migrating again is a no-op | | ok |

Limits: local database, synthetic rows, engine version 16 as on RDS. It proves the migration is additive and idempotent for the rows seeded; it is not a copy of production data (there is none yet).

## D2. Least-privilege runtime role: RUN (local) and exercised by the whole integration suite

2026-10-11. Provisioned with `src/db/runtime-role.ts` twice (create, then idempotent update). Connected as `knest_app`:

| Attempt | Result |
|---|---|
| insert, select, update, delete on `app` and `cms`; on a table created after the grant | allowed |
| CREATE TABLE in `app` and `public`, DROP, ALTER, TRUNCATE | denied |
| read schema `drizzle` | denied |
| CREATE ROLE, CREATE SCHEMA | denied |

`tests/integration/global-setup.ts` now runs the production server as this role, so every integration test also proves the application needs no schema rights.

## D3. Snapshot taken before every migration: RUN on AWS

`pre-migrate-20261011074349`, `pre-migrate-20261011075449` and `pre-migrate-20261011125627` exist and are `available` (one per deploy, taken by the deploy document, which stops if the snapshot cannot be made).

## D4. Snapshot restore: NOT RUN

Purpose: prove a restore point yields a working database. Commands (creates a temporary billable instance named `knest-drill-*`; deleting it afterwards is a separate, owner-approved step):

```
aws rds restore-db-instance-from-db-snapshot --db-instance-identifier knest-drill-restore \
  --db-snapshot-identifier pre-migrate-20261011125627 --db-subnet-group-name <knest-production subnet group> \
  --vpc-security-group-ids <database security group> --db-instance-class db.t4g.micro --no-publicly-accessible
aws rds wait db-instance-available --db-instance-identifier knest-drill-restore
```
Then, from the app host with the runtime secret, count rows in `app.users` and compare with production. Record both counts and the time to available. RPO is the snapshot time; RTO is the measured restore time plus the DNS or parameter change to point the app at it.

## D5. Schema-compatible rollback: NOT RUN end to end

The deploy document restarts the previous container if the new one is not healthy within 90 seconds (read in `app.yaml`; the migration is additive in this release). Drill: deploy a deliberately unhealthy image digest and confirm the log line `restored <previous image>` and `/api/health` 200. Only run with the owner's approval of a short outage.

## D6. Alarm to a person: PARTIALLY DONE

Done: the alert topic has a subscription for `pinakipattnaik@gmail.com` (pending the click on the confirmation mail). Open: after confirmation, `aws cloudwatch set-alarm-state --alarm-name <EmailDeadAlarm> --state-value ALARM --state-reason drill` and record the time the mail arrived; then the alarm returns to OK on its own at the next evaluation.

## D7. Capacity: NOT RUN

Target for V1 is a single `t4g.small` and a `db.t4g.micro`. A bounded read-only run against the preview (for example 20 concurrent clients for 5 minutes on `/`, `/programs`, `/events`) with the gate credentials, watching CPU and the DB connection count, is required before a campaign. Writes are covered by the rate limits, not by this run.

## D8. Hosted accessibility: NOT RUN

`scripts/axe_audit.mjs` and the keyboard and target-size scripts exist and have local results; the exact release SHA has not been audited at the hosted address. Needs the gate credentials.
