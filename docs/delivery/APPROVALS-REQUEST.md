# Approvals and inputs needed from the owner (2026-10-09)

**Nothing below has been done.** Each item says exactly what I would do, to what, the side effects, cost, rollback and why. Answer by number (for example "A1 yes, A2 yes, A3 USD 25, B1 no"). Work that does not depend on these continues in the meantime.

Detail for group A is in `S-1-APPROVAL-PACKET.md` (full resource table, teardown). This file is the single list.

## A. AWS sandbox test (S-1), to prove the hosting design before any production build

| # | Decision | What exactly | Side effects / cost | Rollback | Recommendation |
|---|---|---|---|---|---|
| A1 | Whose AWS account is this (HD-19)? | Written confirmation of the owner. The contract says KNEST/KIIT-owned accounts. | None. If it is not KIIT-owned, nothing built there can become production without migration. | n/a | Confirm in writing; S-1 can run here either way because it is disposable. |
| A2 | Approve the S-1 resources | One VPC with no NAT gateway, one `t4g.small` EC2 (no inbound ports, SSM access), one private `db.t4g.micro` RDS PostgreSQL 16, one private S3 test bucket, SSM parameters, a 7-day log group. All tagged `project=knest-s1`, `expires=<today+14d>`. Synthetic data only. | About USD 8-9 per week before credits; the account shows USD 100 credits. | One teardown script deletes everything in reverse order; then I re-run the inventory and confirm only today's pre-existing bucket/user/policy remain. | Approve |
| A3 | Spending ceiling | A budget `knest-s1` with alerts at 50/80/100%. | The account currently has no budget. | Delete the budget. | USD 25 |
| A4 | Who creates the IAM objects | One EC2 instance role and profile (`knest-s1-ec2`: SSM core + S3 access to the test bucket only), created with the current root session. No IAM users, no access keys. | Root session used for these steps only. | Delete the role/profile in teardown. After S-1 you replace root with a scoped role. | Approve exactly this list |
| A5 | Image delivery | GitHub Actions builds an arm64 image and publishes it to GitHub's container registry as a public package (the repo is public; the image holds no secrets). | A public package; no AWS credentials in CI. | Delete the package. | Approve |
| A6 | Budget alert e-mail address | The address AWS Budgets should notify. Using it sends AWS notification mail to that address. | One or more automated e-mails. | Remove the subscriber. | Give me the address |
| A7 | SES check | Skip in S-1; do it later with the real domain. | None now. | n/a | Skip |

## B. Credentials and existing AWS objects

| # | Decision | Detail |
|---|---|---|
| B1 | The long-lived key on IAM user `knest-app` (created 2026-10-08, before my session; I did not create it) | The target design uses an instance role instead of a stored key. Options: leave it as is until staging exists, or rotate/deactivate it later. I will not touch it without a yes. Also: who created it and the missing `setup-aws.ps1`? |
| B2 | The uncommitted change in `src/server/storage/index.ts` (explicit `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`) | It is not mine. Tell me whether to keep it, adapt it (also allow the default credential chain) or drop it. I have left it alone. |

## C. The live site (knest-kiit.vercel.app)

| # | Decision | Detail |
|---|---|---|
| C1 | Release of the fixed build | Today production shows a maintenance page. Replacing it means a deploy to the public production hostname. I will prepare a release manifest (commit, tests, what is and is not verified, what the public will see) and ask again. I will not release without a yes. Note the fixed build still has open gates (privacy/terms text, HD-04 copy, no production database or hosting plan). My recommendation is to stay on the maintenance page until Pilot-A gates pass. |
| C2 | Vercel Deployment Protection | I cannot see the Vercel dashboard. If you want the site protected in addition to the maintenance page, someone with access to team `knest1` has to enable it (or give me a way to verify it). |
| C3 | Decision on Vercel vs AWS | You said "we need to deploy on AWS, not Vercel". Confirm: Vercel stays only as the maintenance holding page until AWS production exists, then the domain moves to AWS. |

## D. Information I need (no cost, no risk)

| # | Item | Why |
|---|---|---|
| D1 | The domain name (GoDaddy), and whether I should only prepare a DNS/Cloudflare/SES runbook until you approve live changes | Blocks all DNS, Cloudflare and SES-domain work. No DNS change is made without a separate yes. |
| D2 | The commercial document KIIT actually received | Contract status is UNVERIFIED until I see it. Either re-authenticate Gmail with `/mcp` or put the file in the repo folder. |
| D3 | Who approves the public copy (HD-04), who owns the privacy notice and terms (HD-06, `HD-06-PRIVACY-INPUTS.md`), and who answers the lab policy (HD-16, `HD-16-LAB-POLICY-QUESTIONNAIRE.md`) | These are KIIT decisions. I will not write approvals or sign-offs for anyone. Lab booking and QR work stay blocked until HD-16 and the lab-head review (`LAB-HEAD-REVIEW-PACKET.md`) are done. |
| D4 | Who is the support contact for the AMC priority-1 incidents and which e-mail should receive system mail | Needed before staging and for the notices in the app. |

## Not requested now (and not planned without a separate request)

Production AWS resources, any real student data, a public/production deployment beyond the maintenance page, DNS or nameserver changes, domain purchase or transfer, credential rotation, sending any message, changing the contract, or raising the spending ceiling.
