# KNEST V1: rollout plan and billing

Date: 2026-10-11. Account `166917387892`. Companion to `V1-DEPLOYMENT-REPORT.md`.

All dollar figures are planning estimates from public list prices in ap-south-1 and us-east-1, not invoices. The authoritative bill is AWS Billing, Cost Explorer and the monthly invoice. Check the figures there after the first full week of running.

## 1. Where we are

Private preview is live at `https://d1vipkpsr3l07w.cloudfront.net` behind a password gate. `kiitnest.com` is not public yet.

## 2. Rollout phases

Each phase has an exit gate. Do not start the next phase until the gate is met.

### Phase A: make the preview usable (now)
| # | Action | Who | Exit gate |
|---|---|---|---|
| A1 | Set app stack `SiteUrl` to the CloudFront address; re-run SSM deploy | Operator (mutating) | DONE 2026-10-11: SiteUrl set, deploy healthy. Browser sign-in from the preview address still to be confirmed (needs gate password) |
| A2 | Find why `/admin` returns 404 behind the gate | Engineering | DONE: documented as intended for anonymous and non-staff (`tests/integration/20-roles-and-media.test.ts`) |
| A3 | Signed-in smoke test with a synthetic account: sign up, apply, upload, staff review | Engineering | Script and runner committed; remote run blocked, see `OPERATOR-COMMANDS.md` item 1 |

### Phase B: release blockers (from the audit)
| # | Action | Who | Exit gate |
|---|---|---|---|
| B1 | Split runtime and migration database identities | Engineering | Code and template done and proven locally; live once the release is deployed |
| B2 | Verify SES sender `no-reply@kiitnest.com` (DKIM at GoDaddy), leave sandbox, durable retry | Engineering + domain owner | A real verification email arrives |
| B3 | Real Cloudflare Turnstile site and secret keys | Operator | Test keys removed from production |
| B4 | Upload orphan reconciliation | Engineering | Built; daily dry run, deletion opt-in (`STORAGE_RECONCILE=apply`) |
| B5 | Approved privacy, terms and content (HD-06) | Institution | Written approval on record |
| B6 | Drills on the exact release SHA: populated upgrade, snapshot restore, rollback, alarm to a person, capacity, hosted accessibility | Engineering | Each drill has a dated record |
| B7 | `AlertEmail` set; named billing and alert owner | Institution | Interim owner `pinakipattnaik@gmail.com` set; budget USD 100 created; confirmation click and a test alarm pending |

### Phase C: public cutover (needs explicit go-ahead)
1. Request one ACM certificate in us-east-1 covering the four hostnames; validate at GoDaddy.
2. Add the aliases and certificate to the edge stack.
3. Point apex and `www` (and the redirect hostnames) at CloudFront at GoDaddy. Do not touch MX, SPF, DKIM or DMARC.
4. Set `SiteUrl=https://kiitnest.com`, `SiteIndexing=on`; remove the preview gate; redeploy.
5. Verify HTTPS and redirects on all four hostnames; record the rollback state (previous distribution config and DNS values).

Exit gate: all four hostnames return the expected responses; mail still flows; alarms are quiet for a day.

### Phase D: after launch
- Scoped IAM identity with MFA replaces the root session. No root access keys.
- Allow-list routine AWS commands so deploys do not need per-step approval.
- AWS Budget with alerts to a real address.
- Merge `codex/production-v1` into the main line deliberately.
- Post-launch: a weekly look at cost, alarms and the vulnerability scan.

### Out of V1 scope
Lab booking, QR attendance, PWA and offline, permanent staging environment.

## 3. Monthly bill (one environment, steady state)

| Line item | Basis | Est. USD/month |
|---|---|---|
| EC2 `t4g.small` (app host) | on demand, 24x7 | 12 to 14 |
| EBS volume | ~30 GB gp3 | 2.5 to 3 |
| RDS `db.t4g.micro` PostgreSQL | single AZ, 24x7 | 13 to 15 |
| RDS storage and backups | ~20 GB gp3, free backup up to DB size | 2.5 to 4 |
| Application Load Balancer | hourly + low LCU | 17 to 22 |
| Public IPv4 addresses | ALB (2) + host (1), hourly charge | 9 to 11 |
| AWS WAF | 1 web ACL + managed and rate rules + requests | 9 to 12 |
| CloudFront | within monthly free allowance at this scale | 0 to 2 |
| Secrets Manager | ~5 secrets + 1 replica | 2 to 3 |
| CloudWatch logs, alarms | small | 2 to 5 |
| S3, ECR, SSM | small | 1 to 3 |
| SES | USD 0.10 per 1,000 messages | under 1 |
| ACM, Turnstile, OIDC | free | 0 |
| **Total** | | **about 70 to 95** |

The earlier report quoted 65 to 76. The public IPv4 lines and WAF rule counts push the realistic range a little higher. Plan on USD 75 to 80 and set the budget ceiling at USD 100.

### One-time and non-AWS
| Item | Notes |
|---|---|
| Domain `kiitnest.com` | Annual renewal at GoDaddy (owned by Charanjit Kaur's account). Confirm the renewal price and date there. |
| GitHub | Existing org; no new cost expected |
| Cloudflare Turnstile | Free tier |
| Credits | USD 100 shown in the account, offsets roughly the first month and a bit |

### What changes the bill
- Traffic over the CloudFront free allowance (1 TB and 10M requests monthly): adds usage fees.
- Moving RDS to Multi-AZ: roughly doubles the RDS line.
- A second environment (staging): roughly doubles the whole table.
- Larger host (`t4g.medium`): about 2x the EC2 line.
- Cheapest saving: a one-year Savings Plan or Reserved Instance for EC2 and RDS once usage is steady (typically 25 to 35 percent off those two lines).

## 4. Invoices: how to read and collect them
1. Billing console, Bills page: one bill per calendar month, itemized by service and region.
2. Cost Explorer: group by Service and by Region; filter by tag if the stacks tag resources.
3. Invoices are issued after month end. The first one arrives in the first days of the next month, and credits show as a deduction on it.
4. Billing contact and alert email should be an institutional mailbox, not a personal one.
5. Because the account is a root session today, enable "IAM user access to billing" before moving to a scoped identity so finance can read bills.

## 5. Risks to watch
| Risk | Mitigation |
|---|---|
| Root credentials in use | Scoped IAM identity and MFA in Phase D, first thing after launch |
| No alarm recipient | B7 before public traffic |
| Single host, single AZ | Accepted for V1; snapshot restore drill (B6) is the safety net |
| Test Turnstile keys always pass | B3 before public launch |
| Domain owned by an individual's account | Move to an institutional GoDaddy account or document ownership |

## 6. Status 2026-10-11

See `V1-DEPLOYMENT-REPORT.md` section 6, `OPERATOR-COMMANDS.md`, `CUTOVER-RUNBOOK.md`, `DRILLS.md`, `EMAIL-SETUP.md` and `IAM-OPERATOR-AND-SETTINGS.md`. Budget ceiling USD 100 is now an actual AWS Budget.
