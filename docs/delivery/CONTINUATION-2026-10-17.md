# Production continuation checkpoint, 2026-10-17

Public production deployment and domain cutover are **not complete**. This checkpoint supersedes the current-state statements in the historical 2026-10-09 audit implementation note; it does not alter the historical evidence.

## Verified baseline

On resumption, `codex/production-v1` was already pushed at `958e20f`. [CI run 38243018772](https://github.com/KNEST-KIIT/knest/actions/runs/38243018772) passed all three jobs: static checks, production build and integration, and the production image migration/start check. Its logs record 528 unit tests and 389 integration passes with one expected failure. These are automated local/CI results, not hosted acceptance.

Later work already added the runtime database role, durable mail outbox, upload reconciliation, account recovery tests, analytics and the QR/offline device application. The 2026-10-09 continuation note's list of unimplemented code is therefore stale. Hosted application of these changes and the institutional/device gates remain separate.

## Lab workflow recovery candidate

- **E3 D-01:** closed labs remain visible to their own staff and lab administrators through a separate, session-authorized lookup. Member discovery and availability still use the active-only lookup. Only administrators can open or close a lab; heads retain their existing settings permissions.
- **E3 D-13 / D-14:** checked-in bookings remain in the QR roster and current duties until the existing roster/time windows end, allowing checkout after a roster refresh. The console keeps ongoing completed bookings visible and removes their attendance/cancellation controls.
- Roster queries now require current lab membership as well as the assistant assignment. A stale assignment after membership removal grants no roster visibility.
- Both lab flags remain off by default. This patch does not resolve the absent key/review screens, device key recovery, policy approval or real-phone acceptance, and does not authorize enabling QR.

Regression coverage includes closing/reopening through the real management endpoint, denial for members/unrelated staff/assistants and heads attempting the admin-only switch, refreshing a roster after QR check-in, and removing an assigned assistant's membership. The existing browser lab journey is updated to match the in-progress section label.

## Validation

- `pnpm typecheck`: passed.
- `pnpm lint`: zero errors, one pre-existing unused-import warning in `70-core-journey.test.ts`.
- `pnpm test`: 54 files, 528 tests passed.
- `pnpm build`: passed with an intentionally unreachable loopback database; CMS fallback diagnostics were expected. This did not contact the production database.
- `pnpm audit --prod`: the two previously documented ignored advisories remain (one high and one moderate); no new finding was reported.
- Populated upgrade: 13→14 Drizzle migrations, 200 users and 50 enquiries preserved; second migration run a no-op. See `DRILLS.md` for the limitations.
- Targeted production-build integration: 3 suites, 69 tests passed (`34-lab-booking`, `38-journey-lab-booking`, `44-lab-attendance-qr`), against a disposable PostgreSQL 16 and stub providers. The browser booking journey passed as part of this run. Clean-run CI for the pushed commit remains the release gate.

## Access and launch dependencies

The supported Codex Cloud picker still returned **zero environments** on 2026-10-17; no cloud execution task was created. The repository is on GitHub, which is not the same as a running cloud session. A Codex Cloud environment connected to `KNEST-KIIT/knest` is required.

AWS CLI is installed, but the only configured profile is `claude-deploy`, documented as the root identity in `IAM-OPERATOR-AND-SETTINGS.md`. No scoped operator profile was available. No AWS or DNS mutation was attempted in this continuation. The password-gated AWS preview in `V1-DEPLOYMENT-REPORT.md` was reported live on 2026-10-11 and has not been re-certified here.

Finishing the release still requires scoped AWS and GoDaddy access, approved privacy/terms/content and named operating owners, real Turnstile/SES/S3 acceptance, hosted recovery/rotation/alarms/capacity/accessibility evidence, and verification of the four public hostnames after cutover. Never substitute passing CI or the existing preview for those results.
