# Production continuation checkpoint, 2026-10-17

Public production deployment and domain cutover are **not complete**. This checkpoint supersedes the current-state statements in the historical 2026-10-09 audit implementation note; it does not alter the historical evidence.

## Owner-confirmed policy update

The owner confirmed the three WhatsApp policy documents as final on October 17. The candidate now publishes privacy, mentorship/facility service terms and disclaimer text, with source hashes and publication adjustments in [policy acceptance](POLICY-ACCEPTANCE-2026-10-17.md). The written ten-year retention requirement is used. Do not ask for reconfirmation of those supplied documents. Hosted retention/archiving, the remaining content approval, operating acceptance and public-cutover evidence are separate work.

Candidate validation: production build (including TypeScript) passed with the loopback database deliberately unreachable; lint passed with the existing unused-import warning; all 528 unit tests passed with two workers. The first unit run had one 5-second source-scan timeout while build/lint ran concurrently (527 passed); no assertion or timeout was weakened, and the complete rerun passed. Source-fidelity comparisons verified every supplied heading and body paragraph, and secret scanning passed across 993 candidate files. Targeted production-build integration/browser checks are running; their final result and exact-SHA CI remain required before release.

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
- All 44 currently open GitHub dependency alerts were compared against the resolved lockfile; none affects a locked version. No alert was dismissed. See `DEPENDENCY-TRIAGE.md` for the deployed-image limitation.
- Populated upgrades: 13→14, 12→14 and 11→14 Drizzle migrations, 200 users and 50 enquiries preserved in each run; second migration runs were no-ops. See `DRILLS.md` for the limitations.
- Targeted production-build integration: 3 suites, 69 tests passed (`34-lab-booking`, `38-journey-lab-booking`, `44-lab-attendance-qr`), against a disposable PostgreSQL 16 and stub providers. The browser booking journey passed as part of this run. Clean-run CI for the pushed commit remains the release gate.

## Access and launch dependencies

The legacy CLI picker returned zero environments, but the current web UI showed a private, published `knest` environment already connected to `KNEST-KIIT/knest`. The user selected Codex Cloud, and a [cloud continuation](https://chatgpt.com/local/01a14afa-eeee-778e-a8bd-0ebaa1a7b077) was started in that environment. The page explicitly identifies it as a Cloud chat and its first assistant response confirms it is reading the handoff and checking the workflow. This is a running cloud session, not evidence of a deployed application. It was instructed to use a separate branch and avoid a competing production rollout.

AWS CLI is installed, but the only configured local profile is `claude-deploy`, documented as the root identity in `IAM-OPERATOR-AND-SETTINGS.md`; it was not used. No scoped local operator profile was available. Repository-level GitHub variables do configure the existing scoped OIDC push and deploy roles. [Release run 39054914611](https://github.com/KNEST-KIIT/knest/actions/runs/39054914611) succeeded for `7dffe0ac6f72453b540e23c532a30d1406543799`, after [exact-SHA CI 39053901622](https://github.com/KNEST-KIIT/knest/actions/runs/39053901622) passed all jobs (528 unit tests, 391 integration passes and one documented expected failure). Both ARM64 images were published and passed the completed image-scan gate. App digest: `sha256:610639ca57dcff22722303001d5891a262b6c88099d96832aa41854d4c29875e`; migrator: `sha256:e058342d84c1c529afb11eae4705437d4a98dff1ad38a02bff5343f8da0184d6`. Deploy was skipped (`deploy=false`). These images precede the policy publication candidate and do not contain its changes. No new host deployment, migration, CloudFormation update or DNS change was performed in this continuation.

[Read-only inspection 39055427820](https://github.com/KNEST-KIIT/knest/actions/runs/39055427820) used the existing deployment role to recover the interrupted command's metadata, without printing command output. SSM command `8cd6b03e-a29e-4050-a69b-5bd0dd2339a7` on `i-0dbccc58bd903416e` succeeded with response code 0, finishing at `2026-10-11T15:09:44.734Z`. This resolves the unknown result in the October 11 report; it does not establish current host health, exact running image, updated deploy document or runtime database privileges. The pending app-stack update remains required.

External HTTPS checks on October 17 found `kiitnest.com` serving a GoDaddy parking shim, `www.kiitnest.com` failing TLS name negotiation, both `.in` names unresolved, and the CloudFront health path returning 401 at the gate. None proves origin health. Public launch is still incomplete.

Finishing the release still requires scoped AWS and GoDaddy access, the remaining public-content/operating approvals, hosted implementation of the accepted policy obligations, real Turnstile/SES/S3 acceptance, hosted recovery/rotation/alarms/capacity/accessibility evidence, and verification of the four public hostnames after cutover. The supplied policy texts are owner-confirmed; do not reopen that resolved input. Never substitute passing CI or the existing preview for hosted results.
