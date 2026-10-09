# KNEST runbook

Audience: the operator who deploys, migrates, rolls back, backs up and watches the KNEST platform.

After reading this you will know how a release is meant to go out, how to undo it, what is backed up, and what to do when something fails. You will also know what has never been tried.

## Read this first: nothing here has been run on AWS

- **Nothing is deployed.** The CloudFormation templates in `infra/cfn/` and the release workflow `.github/workflows/release-image.yml` are written. They are checked statically (tests, and a `cfn-lint` run reported clean in commit `fac5d49`). CloudFormation itself has not validated them. No AWS resource, DNS record or production database exists for KNEST. Sources: the headers of each template, `docs/delivery/AWS-NATIVE-ARCHITECTURE.md`, `docs/delivery/DNS-MIGRATION.md`, `docs/delivery/TRACKER.md`.
- **Public production today is a maintenance page on Vercel.**
- **Every procedure below is derived from the templates and scripts.** None was rehearsed. Where a step is my inference and not written in the repository, it says so.
- The first rehearsal is the planned hosting spike ("S-1", `docs/delivery/S-1-SPEC.md`). It has not started. It waits on owner decisions (`docs/delivery/S-1-PREFLIGHT.md`).
- There is one production environment. There is no staging. This was a decision of the owner on 2026-10-09.

## 1. People and contacts

No contact has been supplied. Do not guess. Fill these in.

| Role | Name | Email | Phone | Hours |
|---|---|---|---|---|
| Engineering lead | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| On-call or second engineer | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| AWS account owner (HD-19: whose account is it) | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | n/a |
| KNEST product owner | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | n/a |
| Priority-1 incident support contact (AMC) | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| Alert email address for AWS alarms | [PLACEHOLDER] | n/a | n/a | n/a |
| Privacy contact (HD-06) | [PLACEHOLDER] | [PLACEHOLDER] | n/a | n/a |
| Domain registrar login holder (GoDaddy) | [PLACEHOLDER] | [PLACEHOLDER] | n/a | n/a |
| Cloudflare Turnstile account holder | [PLACEHOLDER] | [PLACEHOLDER] | n/a | n/a |

The alert address, the support contact and the account owner are recorded as "not provided" in `docs/delivery/DECISIONS-2026-10-09.md`.

## 2. What runs where

| Piece | Where | Notes |
|---|---|---|
| Source and CI | GitHub, `KNEST-KIIT/knest` (the template default) | CI never deploys and holds no cloud credentials |
| Images | Private ECR repository `knest-app` | Tags are immutable. Releases deploy by digest. The repository keeps the last 20 images. Each release pushes two images (app and migrate), so about ten releases stay available. |
| Host | One EC2 `t4g.small` (Graviton), Docker, container name `knest`, port 3000 | No SSH. Access by SSM Session Manager. |
| Database | RDS PostgreSQL 16, `db.t4g.micro`, single AZ by default | Private. Name `knest`, master user `knest_admin`, password managed by RDS in Secrets Manager. |
| Files | One S3 bucket (documents, and CMS media under `media/`) | Private, encrypted, versioned in production |
| Secrets | Secrets Manager: `knest-production/origin-verify`, `auth-secret`, `payload-secret`, `turnstile-secret`, plus the RDS-managed secret | |
| Settings | SSM Parameter Store, path `/knest-production/config/` | site-url, bucket, db-endpoint, db-secret-arn, email-from, turnstile-site-key |
| Logs | CloudWatch log group `/knest-production`, 7 days by default | |
| Alerts | SNS topic `knest-production-alerts` | Has a subscriber only if the `AlertEmail` parameter was set |

## 3. One-time setup (owner and engineer)

All items need the owner's approval at the time. Do not start without it.

1. **Render the templates for production.** `node scripts/render-cfn.mjs production app > app.rendered.yaml` and the same for `ci`. The template in the repository is already the production form. The `s1` form only changes the lines marked `# DELETION`.
2. **Deploy the stacks.** The order below is derived from the parameters the templates need. It has not been rehearsed.

   | Order | Template | Region | Needs |
   |---|---|---|---|
   | 1 | `ci.yaml` | ap-south-1 | GitHub repository name. Creates the ECR repository, the GitHub OIDC provider (one per account), a push role and a deploy role. |
   | 2 | `app.yaml` | ap-south-1 | The AWS-managed CloudFront prefix list id, `SiteUrl` (https), `EmailFromAddress` (an SES-verified address), `TurnstileSiteKey`, optionally `AlertEmail` |
   | 3 | `waf.yaml` | us-east-1 | Nothing from the others |
   | 4 | `cert.yaml` | us-east-1 | DNS validation records must exist before it completes (see `DNS-MIGRATION.md` phase B) |
   | 5 | `edge.yaml` | see its header | The origin DNS name from `app.yaml`, the web ACL ARN from `waf.yaml`, the certificate ARN, the origin-verify secret name |
   | 6 | `dns.yaml` | see its header | Only at cutover |

3. **Paste the Turnstile secret key** into the Secrets Manager secret `knest-production/turnstile-secret`. `app.yaml` creates it empty. If you skip this, the first deploy fails when it reads the secret. The failure is loud, not silent.
4. **Set up the GitHub Environment `production`.** In GitHub, Settings, Environments, add required reviewers, so a person approves every production deploy. Add these variables: `AWS_REGION` (`ap-south-1`), `AWS_PUSH_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN` (outputs of the `ci` stack), `ECR_REPOSITORY` (`knest-app`). They are not secrets. That the reviewers rule is on cannot be checked from the repository. [PLACEHOLDER: who confirmed required reviewers are set, and when]
5. **Verify SES.** Verify the sending domain identity with DKIM. The existing SPF record is not edited. Confirm a test message shows `dkim=pass` and `dmarc=pass`. Steps: `DNS-MIGRATION.md` phase B. A new SES account starts in a sandbox that only sends to verified addresses. Ask AWS for production access before launch. [PLACEHOLDER: date SES production access was granted]
6. **Open decision: origin TLS.** `edge.yaml` refuses a production deployment unless the origin protocol is `https-only`. The container serves plain HTTP. A TLS-terminating proxy or load balancer in front of it is not designed. Choose and test it first. Options and costs: `AWS-PRODUCTION-BUDGET.md` section 4.
7. **Create the first super admin.** See section 5.4.

## 4. Deploy

### 4.1 Before you deploy

- [ ] The commit to release has a green CI run on GitHub (`CI` workflow: static checks, integration tests, image build).
- [ ] You know whether the commit contains a new migration (section 5). If yes, read section 6 before going on.
- [ ] You have the release note: what changes, what the public will see. [PLACEHOLDER: link to the release note]
- [ ] For the first public release: the owner has approved the release manifest. The privacy notice and terms are approved (HD-06). `docs/delivery/DNS-MIGRATION.md` phase C is complete.

### 4.2 Run the release

1. In GitHub, open Actions, then **Release image**, then **Run workflow**.
2. Choose the branch or tag of the commit. Choose environment `production`. Tick **deploy** to deploy after pushing. Leave it unticked to build and push only.
3. A reviewer approves the run (the Environment's required-reviewers rule).
4. **Job 1, build and push:** checks the Environment variables, scans the source for secrets, signs in to AWS with a short-lived token (OIDC), builds two images for linux/arm64 from one Dockerfile (targets `runner` and `migrate`), and pushes them tagged `app-<sha>` and `migrate-<sha>`. It prints both **digests** in the run summary. Write the digests in the release note.
5. **Job 2, deploy (if ticked):** sends the SSM document `knest-production-deploy` to the instance tagged `knest-deploy-target=production`, with the two digests. A reviewer may be asked again for this job.

### 4.3 What the deploy document does on the host

In this order:

1. Logs in to ECR with the instance role.
2. Builds the environment file in memory-backed storage (`/run/knest/app.env`, root only). It is removed when the script ends, however it ends. It reads secrets from Secrets Manager and settings from SSM.
3. Records the image of the container that is running now (as the "previous" image).
4. Pulls the migrate image and **runs it to completion**. This applies the Drizzle then the Payload migrations. If it fails, the script stops. The running app is untouched.
5. Pulls the app image, **removes the running container** (`docker rm -f knest`), and starts the new one. Logs go to CloudWatch.
6. Waits up to 90 seconds (45 checks, 2 seconds apart) for the container's health check to pass.
7. If healthy: records the new image in `/opt/knest/current` and the old one in `/opt/knest/previous`, and finishes.
8. If not healthy after 90 seconds: removes the new container and starts the previous image again. The run is marked failed.

Expect a **short gap** on every deploy, from seconds up to 90 seconds if the new image is unhealthy. The host is a single instance. It is not zero-downtime. The "blue/green" test in the spike plan is a test to run, not a feature.

### 4.4 After you deploy

1. In GitHub, confirm the deploy job shows success and the output says `healthy`.
2. Check `https://<site>/api/health`. It returns `{"status":"ok"}` if the app reaches the database. It returns 503 `{"status":"unavailable"}` if not.
3. Run the verification script from your own machine. It makes only read requests plus one refused cross-origin POST. Example (from the script header):

   ```
   node scripts/verify-production.mjs --url https://kiitnest.com --waf --origin <origin address> --alt www.kiitnest.com,kiitnest.in,www.kiitnest.in --evidence out.md
   ```

   Add `--gate` while the private-first password gate is on. Put the gate credentials in the environment variable `KNEST_VERIFY_BASIC`, never on the command line. Keep the evidence file.
4. Open the site. Sign in as a test staff account. Open `/admin`. Check one public page.
5. Read the first minutes of logs (section 8).

### 4.5 Changing a setting

The environment file is rebuilt on every deploy. To change a setting:

1. Change it at its source: a stack parameter, an SSM parameter, or a secret value.
2. Run a deploy again (section 4.2).

Settings the deploy document **does not write today**. The container never sees them, whatever you set elsewhere:

| Setting | Effect of the gap |
|---|---|
| `FEATURE_LAB_BOOKING` | Lab booking cannot be switched on. It stays off. |
| `SITE_INDEXING` | The site stays hidden from search engines (a safe default). Turning it on at launch needs a change to the deploy document. |
| `ENQUIRY_NOTIFY_EMAIL` | Contact messages are stored but nobody is emailed. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in stays disabled. |
| `SES_CONFIGURATION_SET` | Not used |

Adding any of these is a template change: [PLACEHOLDER: ticket or decision reference].

## 5. Migrate

### 5.1 How migrations run

`pnpm migrate` runs two steps in order. In production the `migrate` image runs it for you during every deploy.

1. `tsx src/db/migrate.ts` applies Drizzle migrations from `src/db/migrations` to the `app` schema (0000 to 0010 today).
2. `payload migrate` applies Payload migrations from `src/migrations` to the `cms` schema (three today).

Running it again when nothing is new does nothing.

### 5.2 Write a new migration

- **Operational tables (`app`):** change `src/db/schema/*.ts`, then run `pnpm db:generate`. Commit the generated SQL and the snapshot with the code. Drizzle cannot express some things, such as the lab exclusion constraint. Those are edited into the SQL by hand (see `0010_lab_booking.sql`).
- **Content types (`cms`):** change the collection, then run `pnpm payload migrate:create <name>`. Commit the new file and the updated `src/migrations/index.ts`. Payload's automatic schema push is off, so a collection change without a migration breaks. CI checks for this.
- Test from zero locally: `pnpm test:integration` starts an empty PostgreSQL 16, runs all migrations, and checks for drift.

### 5.3 Make every migration safe to undo by redeploying the old image

Drizzle has no "down" step. Rolling the container back does not roll the database back (section 6). So:

- Add things first (a new nullable column, a new table). Remove things in a later release, after no running code uses them.
- Never rename or drop a column in the same release that stops using it.
- Before any migration that rewrites or deletes data, take a manual database snapshot (section 7).
- An upgrade rehearsal on a database holding data has **not** been done for any migration (`docs/delivery/TRACKER.md`, rows KN-04 and R-04). Do one on a restored copy of production before the first real data migration.

### 5.4 Create the first super admin

The seed script creates the first super admin. There is no documented production procedure, and the image tooling for it has not been tried. This is my reading of the Dockerfile and `src/db/seed.ts`:

- The `migrate` image is the full build stage, so it contains `tsx` and the seed script. Its default command is `pnpm migrate`.
- Run it once with the command `pnpm db:seed` and these inputs: `DATABASE_URL`, the database TLS settings, `PAYLOAD_SECRET`, `SEED_ADMIN_EMAIL`, and `SEED_PASSWORD` (at least 12 characters, not the published default). In production the seed refuses to run without `SEED_PASSWORD`.
- The deploy script deletes its environment file when it ends, so you must supply these values yourself, in a one-off command through SSM Session Manager. Do not write them to disk, to chat or to a ticket.
- The seed also writes the default homepage copy if the homepage is empty. It never overwrites an existing account or existing homepage text.
- After sign-in, change the password. Create the other staff through the Members screen.

[PLACEHOLDER: who ran the first-admin seed, and when]

## 6. Roll back

Decide which case you are in.

| Case | What happened | Action |
|---|---|---|
| A | The new container never became healthy | Nothing to do. The deploy document already restored the previous image. Read the logs, fix, and release again. |
| B | The new container is healthy but behaves wrongly, and the release had **no migration** or only an additive one | Redeploy the previous release's digests (below) |
| C | The release had a migration that is **not** backward compatible, and the old image cannot run against the new schema | Prefer a fix-forward release. If data was damaged, restore the database (section 7.3). Needs the engineering lead. |
| D | Wrong website content | Unpublish or revert in the CMS. See `CONTENT-EDITING-GUIDE.md`. Use the Versions tab. |
| E | Domain or mail problem after cutover | The rollback table in `docs/delivery/DNS-MIGRATION.md` |

### Case B: redeploy a previous release

The host remembers the previous app image in `/opt/knest/previous`. The digests for older releases are in each Release image run's summary and in your release notes.

1. Find the previous app digest and the previous migrate digest.
2. Run the SSM document yourself with the deploy role, or re-run the workflow from the earlier commit. The document needs full ECR addresses ending in `@sha256:` and 64 hex characters. A tag is refused.

   ```
   aws ssm send-command --document-name knest-production-deploy \
     --targets "Key=tag:knest-deploy-target,Values=production" \
     --parameters "Environment=production,AppImage=<app image by digest>,MigrateImage=<migrate image by digest>"
   ```

3. The old migrate image runs first. It applies only migrations it knows. It leaves newer ones in place.
4. Verify (section 4.4).

Re-running the workflow from the earlier commit builds fresh images from that commit. They have new digests and are not byte-identical to the earlier release. The ECR repository keeps only the last 20 images, so a very old digest may be gone.

### Turn off a feature fast

Lab booking is off unless `FEATURE_LAB_BOOKING` is `true`, and the deploy document does not set it (section 4.5). If it is ever enabled and you must switch it off, remove the setting and deploy. An administrator closing a single lab has a trap. See the warning in `LAB-OPERATIONS-GUIDE.md`.

### Put the site back behind the password gate or the maintenance page

- The private-first gate is the `AccessHash` parameter of `edge.yaml` (a SHA-256 digest of "user:password"). Setting it requires a login to reach any page. Empty means public. Redeploy the edge stack to change it.
- Until DNS moves, the Vercel maintenance page is the public face.

## 7. Backups and restore

### 7.1 What is backed up (from the templates)

| Data | Mechanism | Detail |
|---|---|---|
| Database (`app` and `cms`) | RDS automated backups | 7-day retention. Daily window 21:00 to 22:00. RDS reads this window as UTC. |
| Database deletion | Deletion protection on in production. `DeletionPolicy: Snapshot`, so deleting the stack takes a final snapshot. | |
| Documents and media | S3 versioning on in production | Old versions expire after 90 days. The bucket is retained if the stack is deleted. |
| Host | Not backed up | The host holds no data. Data is in RDS and S3. The host is rebuilt from the stack. The budget file lists EBS snapshots, but no template creates them. |
| Secrets | Secrets Manager | The database password is RDS-managed |
| Images | ECR, last 20 images | |
| Logs | CloudWatch, 7 days | |

Not covered: copies in another region, and Multi-AZ (the default is single AZ). If the region fails, there is no standby. The owner has to accept this or change it (`AWS-PRODUCTION-BUDGET.md` section 3 prices Multi-AZ).

### 7.2 Before a risky release, take a manual snapshot

Name it for the release. Wait until it is available before you migrate. [PLACEHOLDER: snapshot naming convention]

```
aws rds create-db-snapshot --db-instance-identifier <instance id> --db-snapshot-identifier knest-pre-<release>
```

The instance id is in the `app` stack resources.

### 7.3 Restore the database (not rehearsed)

RDS restores to a **new** instance with a new endpoint. It does not overwrite the old one. The steps below are general AWS practice and my inference about KNEST's wiring. Treat them as a draft until a drill proves them.

1. Stop and think. Restoring loses everything written after the restore point. Get the engineering lead and the product owner to agree on the time.
2. Restore a snapshot, or restore to a point in time within the 7 days, into a new instance in the same private subnets and with the database security group.
3. The deploy document reads the database address and secret from the SSM parameters `/knest-production/config/db-endpoint` and `/knest-production/config/db-secret-arn`. Pointing the app at the restored instance means updating them and redeploying. The credentials of a restored instance come with the snapshot. Confirm how the managed master password behaves for the restored instance.
4. Verify with `/api/health`, sign-in, and a count of applications against what you expect.
5. Keep the damaged instance until the incident is closed.

**A restore drill has not been done.** The contract item "automated backups and point-in-time recovery" has a "restore drill" listed as not done (`docs/delivery/CONTRACT-TRACEABILITY.md`, module 45). Do the first drill before real student data arrives. [PLACEHOLDER: date and result of the first restore drill]

### 7.4 Restore a file

If an S3 object was overwritten or deleted, list the object's versions and restore the earlier version. [PLACEHOLDER: procedure, to be written and tested]

## 8. Watch the system

### 8.1 Health

- `/api/health` answers whether the app can reach the database, and nothing else.
- The container has the same health check built in (every 30 seconds, 5-second timeout, 3 retries, 30-second start period).
- The origin check exempts `/api/health`, so the host can check itself.

### 8.2 Alarms that exist in the template

| Alarm | Fires when |
|---|---|
| Host status | The instance fails its status checks for 3 minutes. Missing data counts as breaching. |
| Database CPU | Above 80 percent for 15 minutes |
| Database storage | Free storage below 4 GB |

They send to the SNS topic. With no `AlertEmail` nobody is told. **Gaps:** there is no alarm for server errors (5xx), WAF blocks, CloudFront errors, failed mail, certificate expiry or budget. Add them. A budget alert is also still to be created, and its email address has not been provided. [PLACEHOLDER: budget amount approved by the owner. The budget file suggests USD 75 per month. That is a suggestion and is not approved.]

### 8.3 Logs

- CloudWatch log group `/knest-production`. Each container start opens a new stream named `app-<time>`.
- On the host: use SSM Session Manager, then `docker logs --tail 100 knest`.
- Application logs never contain secret values. The start-up check prints variable names only.
- The database logs slow statements over 1 second to its own log.

### 8.4 Common failures

| What you see | Likely cause | What to do |
|---|---|---|
| Container exits at once, log says `Invalid production environment` followed by variable names | A required variable is missing or malformed | Fix the named setting and deploy. The list is in `ARCHITECTURE.md` section 8. |
| Health is 503 `unavailable` | The app cannot reach the database | Check the RDS instance state, the database security group, the TLS bundle at `/opt/knest/rds-global-bundle.pem`, and the credentials. If it worked after the last deploy and then stopped, suspect a rotated database password (see known gap 12). A deploy rebuilds the settings with the current password. |
| Every page answers 403 "Forbidden" | The origin check is failing. The `X-Origin-Verify` value in CloudFront does not match the app's `ORIGIN_VERIFY_SECRET`. | They both come from `knest-production/origin-verify`. CloudFront resolves it when the edge stack deploys. If the secret changed, redeploy the edge stack and then the app. |
| Sign-in, sign-up, contact or booking returns "We couldn't run the human check right now" (503) | The server cannot reach Cloudflare Turnstile, or the secret is empty or wrong | Check the `turnstile-secret` value, and that the host can make outbound HTTPS requests |
| People report no verification or notification emails | SES not out of the sandbox, the domain not verified, or the sender address differs from `EmailFromAddress` | Check SES status and the instance role's condition on the "from" address |
| Uploads fail | S3 permission or bucket setting | Check the bucket name setting and the instance role |
| Admin shows "not found" for a staff member | Their role is missing, or the account is deactivated | Members screen, as a super admin |
| Rate-limit messages for many people at once | Everyone shares one address because the client address header is missing | Confirm requests pass through CloudFront and `CLIENT_IP_SOURCE` is `cloudfront` |
| Users cannot reach the site after DNS work | See the DNS rollback table | `docs/delivery/DNS-MIGRATION.md` |

### 8.5 Incident steps

1. Say who is leading. Write the time and what you see.
2. Contain: if data may be exposed, deactivate affected accounts on the Members screen and consider the maintenance page.
3. Fix or roll back (section 6).
4. Tell the product owner: [PLACEHOLDER: contact]. If personal data was involved, tell the privacy contact. Legal duties to notify are for KIIT to decide: [PLACEHOLDER: KIIT process].
5. Write what happened and what you will change.

## 9. Routine work

| Task | How |
|---|---|
| Add or remove staff, change a role | Members screen, as super admin. See `STAFF-WALKTHROUGH.md`. |
| Renew the TLS certificate | ACM renews it as long as its DNS validation records stay in Route 53 (`dns.yaml`) |
| Update dependencies | CI runs `pnpm audit --prod --audit-level=moderate`. Two un-patchable advisories are ignored by id in `pnpm-workspace.yaml`. Review them each quarter. |
| Patch the host OS | No procedure is written. The host runs Amazon Linux 2023. [PLACEHOLDER: patching plan] |
| Database minor versions | RDS applies minor upgrades itself (`AutoMinorVersionUpgrade`). Maintenance window: Sunday 22:30 to 23:30. |
| Rotate secrets | No rotation procedure is written. [PLACEHOLDER: rotation plan for `auth-secret`, `payload-secret`, `origin-verify`, Turnstile keys] Check the effect on signed-in people before you rotate. |
| Cost watch | The budget file's headline is about USD 45 to 51 per month. **That figure leaves out the cost of origin TLS.** The edge template forces HTTPS to the origin in production, which needs a load balancer or a host certificate. The budget file (section 4) puts a load balancer at about USD 18 to 25 more. Its own text says the bill would then be about USD 65 to 76. Check Cost Explorer monthly. |
| Review the audit trail | Audit screen, as super admin |

### The old long-lived AWS key

Per `docs/delivery/DECISIONS-2026-10-09.md`, an IAM user named `knest-app` with one long-lived access key exists in the AWS account. It was created before this work and its values live in two git-ignored local files, `.env` and `.env.local`. Its history is unknown. The production design uses the instance role instead and stores no key. The owner has not yet decided what to do with the key. [PLACEHOLDER: decision and date on the `knest-app` key]. Do not put any key into the production settings.

## 10. Go-live gates (summary)

The detailed steps are in `docs/delivery/DNS-MIGRATION.md` and `AWS-NATIVE-ARCHITECTURE.md` section 4.

- [ ] Origin TLS decided and tested
- [ ] Hosting spike (S-1) run and its results recorded
- [ ] Private production smoke test with synthetic accounts only: `verify-production.mjs`
- [ ] Privacy notice and terms approved (HD-06)
- [ ] Public copy approved (HD-04)
- [ ] Support contact named
- [ ] SES delivery and domain authentication proven
- [ ] A restore drill done
- [ ] Alarms and a budget alert in place
- [ ] Owner has approved the exact cutover manifest
- [ ] Search indexing turned on deliberately (needs a deploy-document change, section 4.5)
- [ ] Lab booking stays off until HD-16 is signed

## 11. Known gaps and open decisions

| # | Item | Source |
|---|---|---|
| 1 | Origin TLS is undecided. The production edge stack cannot deploy as written. | `fac5d49`, `AWS-PRODUCTION-BUDGET.md` |
| 2 | The deploy document does not write `FEATURE_LAB_BOOKING`, `SITE_INDEXING`, `ENQUIRY_NOTIFY_EMAIL` or the Google sign-in settings | `infra/cfn/app.yaml` |
| 3 | Each deploy has a short outage, and a container rollback does not undo a migration | `infra/cfn/app.yaml` |
| 4 | No restore drill. No cross-region copy. Single-AZ database by default. | templates, `CONTRACT-TRACEABILITY.md` |
| 5 | No alarms for errors, WAF, certificates, mail or budget | `infra/cfn/app.yaml` |
| 6 | No secret rotation or OS patching procedure | this document |
| 7 | No documented first-admin procedure in production, and no upgrade rehearsal of a migration on a populated database | `TRACKER.md` |
| 8 | Publishing in the CMS is not audited | `LOCAL-COMPLETENESS.md` module 43 |
| 9 | Google sign-in never tested while enabled. Real S3, SES and Turnstile are proven only with stubs. | `TRACKER.md`, `LOCAL-COMPLETENESS.md` |
| 10 | Real-browser journeys and the manual accessibility walk-through are not done | `LOCAL-COMPLETENESS.md` modules 50 and 51 |
| 12 | **The deploy is not safe against database password rotation.** The deploy document copies the RDS-managed master password into the container's settings once, at deploy time. RDS rotates a managed master password on its own schedule (the AWS default is 7 days; reported by the evaluator, not tested here). After a rotation, the running container still holds the old password, and new database connections would fail until the next deploy. Decide how the app will read the password (for example at start-up from Secrets Manager) before launch. | `infra/cfn/app.yaml`; evaluator report |
| 13 | Rate limits cover only the listed public and member endpoints. Lab decision, cancel, respond, attendance and manage routes, lab availability and `/api/admin/*` have none. | `src/server/security/route-limits.ts` call sites |
| 14 | The test counts in `docs/delivery/LOCAL-COMPLETENESS.md` are unverified, and `FINDINGS.md`, `TRACKER.md` and `CONTRACT-TRACEABILITY.md` are out of date in places. Check the code before you trust a status word. | evaluator report |
| 15 | The owner's approvals are outstanding: scoped AWS identity, budget email, teardown roles, GoDaddy additions, the production bill and ceiling, privacy and terms approver | `AWS-NATIVE-ARCHITECTURE.md` section 6 |
