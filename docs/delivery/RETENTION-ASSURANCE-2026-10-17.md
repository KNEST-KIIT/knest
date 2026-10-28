# Five-year retention, then approved backup and archive: engineering assessment

Revised 2026-10-28 (first written 2026-10-17). **This revision replaces the earlier ten-year assessment.** The file name is unchanged because code, templates and other documents link to it.

## The requirement

The stakeholder Terms and Conditions and privacy text now say (published verbatim at `/privacy`, section "Retention and deletion", from `src/content/policies.ts`):

> KIITNEST shall retain records and information collected, generated or stored through the platform for a period of 5 years, after which the records shall be transferred to an approved backup and archive in accordance with KIITNEST’s approved record management and archiving procedures.

The same section lists the record classes it applies to: user accounts and profiles, successful and unsuccessful applications, uploaded documents, laboratory bookings, QR-code attendance records, event registrations, mentor records, communications, support tickets, and system access and security logs. It also says that where the Digital Personal Data Protection Act, 2023 or another law requires a different period, or a legal hold or investigation applies, that requirement takes precedence.

**Five years then backup supersedes the earlier ten-year wording.** No ten-year language remains in any published page, template, script or delivery document; this is enforced by tests (`src/content/policies.test.ts`, `tests/integration/48-stakeholder-content.test.ts`, `infra/cfn/malware-protection.test.ts`). The cloud-side value for five years is **1827 days** (five years including one leap day), which is one of the retention values CloudWatch Logs accepts; the evidence script treats anything shorter as short.

This document does not claim hosted compliance. It states what the repository now does, what it cannot do, and what the owner still has to decide.

## What "transferred to an approved backup and archive" means here

The owner has not named an archive destination. The repository therefore implements the narrowest safe default and says plainly that it is a default:

- **Applicant documents** move to **S3 Glacier Deep Archive in the same AWS account** when they are 1827 days old (parameter `ArchiveDocumentsAfterDays`, default 1827, minimum 90). The template never deletes a current document. The transition is a lifecycle rule on the clean documents bucket, so it needs no job and no code path that can fail silently.
- Small files are included. Since September 2024, S3 does not move objects under 128 KB to any storage class unless the configuration opts in (AWS documentation, "Transitioning objects using Amazon S3 Lifecycle", checked 2026-10-28). Applicant scans and photos are often that small, so the bucket sets `TransitionDefaultMinimumObjectSize: varies_by_storage_class`. The evidence script reports a gap if the deployed bucket does not carry that setting.
- **Application logs** are kept hot for 1827 days (`LogRetentionDays`, default 1827; it was seven). CloudWatch only expires logs; it does not archive them. Moving logs to an archive before they expire is a separate procedure that this change does not create (see "What is not done" below).
- **Database records** (accounts, applications, answers, bookings, attendance, registrations, enquiries) stay in PostgreSQL. No code expires or moves them. Their five-year transfer is an operating procedure the owner must define.

Deep Archive is a deliberate choice for records that are kept and almost never read. Its costs and limits are AWS facts, quoted from the same lifecycle documentation: retrieval is not real time (an object must be restored to a temporary copy first); the minimum storage duration is 180 days; each archived object adds 40 KB of overhead (8 KB billed at S3 Standard rates and 32 KB at Deep Archive rates); each transition is a billed request; and a transition to Deep Archive is one-way through lifecycle rules.

## Mapping and gaps

| Scope | What exists now | What remains |
|---|---|---|
| Accounts, profiles, applications and answers | PostgreSQL `app` schema. Nothing expires them. | Define the retention clock (creation, last activity or decision), the archive destination, transfer manifests, legal holds, and a restore test. A row that simply stays forever is not a controlled archive. |
| Uploaded application documents | Every upload lands in a private quarantine bucket, is scanned by GuardDuty, and only a clean, version-bound result copies it to the **separate clean documents bucket** (`docs/delivery/MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md`). The documents bucket is versioned, KMS-encrypted, never expires current objects, keeps superseded versions 90 days for recovery, and moves current objects to Deep Archive at 1827 days. The database row keeps the verdict evidence (event id, versions, checksums, decision time) with the application. | Owner approval of the destination. A restore drill. Treatment of rejected files: an infected or unscannable upload is never copied to clean storage and its quarantine copy is removed by lifecycle after 14 days in production; the row keeps the file name, size and verdict but not the bytes. If the owner wants rejected files kept for investigation, that is a new decision with a security cost. `storage/reconcile.ts` (dry run by default, 48-hour grace) only ever looks at the clean bucket. |
| Events | `src/server/events/actions.ts` deletes the registration on cancellation. | Keep the registration and cancellation history under an accepted record model if the policy covers cancelled registrations. Not changed here. |
| Mentor, media and CMS records | Payload collections and audit hooks; delete audit rows keep identifiers and titles, not full deleted documents. The media bucket expires noncurrent versions after 90 days. | Decide whether CMS history and deleted media fall under the five-year rule and preserve them accordingly. An audit label is not an archived record. |
| Communications and enquiries | Database enquiries and notifications; the email outbox clears delivered and expired bodies and clears dead-message bodies after seven days. | Separate transient credential-bearing delivery payloads from retained correspondence. Never retain password-reset or verification secrets for five years. |
| Lab and QR attendance | Database booking, attendance and audit records. | Record history, hold, export and device-data treatment are unaccepted; lab, QR and offline flags stay off. |
| Application, system and security logs | CloudWatch group `/knest-production`, retention 1827 days, `Retain` on stack deletion or replacement. | An export or subscription pipeline into an archive **before** day 1827, with alarms against silent gaps. Hot storage for five years has a real monthly cost; the cost plan carries the current estimate and it should be reviewed against the archive design. Raising retention cannot recover logs that already expired. |
| Database, edge, WAF, ALB and provider logs | RDS exports PostgreSQL logs; the templates do not establish a complete access or security-log archive. | Inventory every log source and provider-managed expiry. The app log group is one source, not the whole set. |
| Recovery backups | RDS rolling backups, seven days; production snapshot and retain policies; S3 versioning. | Backups follow the separately approved backup and recovery procedures. They do not replace the archive, and seven-day backups do not by themselves breach a five-year live-record policy. Prove recovery, holds and approved deletion treatment. |
| Auth sessions and one-time tokens | Logout and reset revoke or delete the rows. | These are security credentials, not institutional records. Keep redacted audit events separately and never retain usable secrets. |

This is a focused code and template review, not a legal classification of every table or provider.

## What changed in this release

1. `infra/cfn/app.yaml`
   - `LogRetentionDays` default 7 → **1827**; the parameter text states that lowering it contradicts the published policy.
   - New parameter `ArchiveDocumentsAfterDays` (default 1827, minimum 90) and the production-only rule `archive-after-five-years` on the documents bucket (`DEEP_ARCHIVE`), with `TransitionDefaultMinimumObjectSize: varies_by_storage_class`.
   - Production lifecycle rules contain no `Expiration` on the documents bucket; the disposable S-1 variant expires everything after one day so teardown can empty it. S-1 holds no real applicant data.
   - Log group, documents bucket, quarantine bucket and key keep `Retain` in production.
2. `scripts/ops/retention-evidence.mjs` now measures against the five-year floor (`FIVE_YEAR_LOG_DAYS = 1827`), examines the **documents** bucket, recognises an enabled archive rule at 1827 days or more, flags any rule that expires current records or versions, and flags a bucket that would skip files under 128 KB. It never reads log messages, objects, rows or secrets. It still exits 1 ("inventory complete, acceptance blocked") by design: it cannot certify institutional procedures, collection coverage or restore.
3. Published wording and tests: `src/content/policies.ts` (five years then approved backup and archive), `src/content/policies.test.ts`, `tests/integration/48-stakeholder-content.test.ts`.

## What is not done

These are real gaps, not omissions to be hidden:

- **No archive destination has been approved** by the owner, so "approved backup and archive" is not yet satisfied in the policy's own terms. Deep Archive in this account is a proposal.
- **No log export pipeline exists.** Logs expire from CloudWatch at day 1827. If they must also be archived, a pipeline must be designed, costed and alarmed first.
- **No database archive worker, legal-hold mechanism or automated erasure workflow exists.** Correction and erasure requests go through the grievance route in the privacy policy (contact@kiitnest.com). Where law or a hold requires a different treatment, the policy says that treatment takes precedence; the platform does not yet automate it.
- **No restore drill** from Deep Archive has been performed. Do it with a synthetic object before relying on the archive.
- **Nothing was run against AWS.** Every statement about deployed state is a statement about templates until Phase 2.

## Provider and operator steps (not executed)

Use a verified scoped **assumed role** in account `166917387892`, Mumbai. Never use the root-equivalent `claude-deploy` profile. Metadata permissions needed: `sts:GetCallerIdentity`, `cloudformation:DescribeStackResource` on `knest-production-app`, `logs:DescribeLogGroups`, `s3:GetBucketVersioning` and `s3:GetLifecycleConfiguration` on the documents bucket, and `rds:DescribeDBInstances`. The operator policy draft in `infra/iam/operator-policy.json` allows each of these calls (`infra/iam/iam-policies.test.ts` asserts it, including wildcard grants) and denies reading documents or using the key. An earlier draft listed only the plural `cloudformation:DescribeStackResources`, which would have made this script fail with AccessDenied; that was found and fixed on 2026-10-28.

```sh
mkdir -p work
node scripts/ops/retention-evidence.mjs --profile <verified-scoped-role-profile> --stack knest-production-app > work/retention-evidence.json
```

Expected after the app stack is deployed: `logPreservation: "five-year-floor"`, `archiveTransition: "five-year-archive-transition"`, no gap mentioning 128 KB, and `status: "blocked"` because the approved destination, legal holds, access and restore evidence are still required. Store the output in a restricted operator workspace; do not publish unreviewed infrastructure inventory.

Then, as operating work that is not part of this repository:

- Name the approved archive destination, its access owners, key custody and rotation, transfer manifest and integrity checks, legal holds and exceptions, and the authorised retrieval and restoration procedure. This is implementation of accepted policy, not policy-source reconfirmation.
- Cost and review the log-archive design against the budget before creating anything billable.
- Prove restore: put a synthetic object through a lifecycle rule with a short test value of `ArchiveDocumentsAfterDays` in a disposable environment, restore it, and compare checksums. Never use real applicant data for this.
- Record the exact commit, configuration, collection coverage, restore result and the archive operator's acceptance before claiming hosted compliance. Public deployment, DNS and cutover remain separate gates.

## Verification

Evidence is recorded in `docs/delivery/RELEASE-EVIDENCE-2026-10-27.md` with exact counts. Retention-specific checks: `infra/cfn/retention.test.ts` (23 tests: short, missing, invalid and five-year log values; archive rule recognition and rejection; small-file gap; read-only collection; root-profile and root-session refusal; exact log-group and documents-bucket selection) and `infra/cfn/malware-protection.test.ts` (documents bucket never expires current versions, archives at the parameterised age, includes small files, S-1 expires quickly, `Retain` policies). No live AWS metadata collection, provisioning, deletion, deployment or migration was performed.
