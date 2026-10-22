# Local platform testing

Run `pnpm dev:local` from the repository. It creates a separate PostgreSQL 16 database, local SMTP capture and local S3 stand-in, applies committed migrations, inserts demo content and accounts, and starts the app at http://127.0.0.1:3000. No Docker or AWS login is needed. Existing environment files and databases are untouched.

All services bind to loopback. Data and logs persist under `%LOCALAPPDATA%\KNEST\local-platform` on Windows (or `$HOME/KNEST/local-platform` otherwise). Stop with Ctrl+C; run the same command to resume. Port 3000 and 8025 must be free. Existing account passwords are preserved when restarting.

Every account below initially uses **`Knest-Local-Test-2026!`**. These are fictional local accounts only.

| Account | Purpose |
| --- | --- |
| student@knest.local | Start onboarding, discover programs, apply and track |
| founder@knest.local | Completed onboarding, member dashboard |
| investor@knest.local | Investor experience |
| mentor@knest.local | Mentor experience |
| alumni@knest.local | Alumni experience |
| partner@knest.local | Partner experience |
| reviewer@knest.local | Review console |
| manager@knest.local | Program operations |
| content@knest.local | CMS publishing |
| admin@knest.local | Full staff console and CMS |
| labadmin@knest.local | Lab administration |
| labhead@knest.local | Head of Local Test Maker Lab |
| assistant@knest.local | Assistant of Local Test Maker Lab |
| student-ready@knest.local | Completed onboarding; returning student dashboard |
| startupmanager@knest.local | Startup publishing and operations |
| mentormanager@knest.local | Mentor publishing and operations |

Start at `/login`. Staff use `/admin` after signing in. The **local test inbox** is http://127.0.0.1:8025; refresh it to read verification, recovery and notification messages. Copy the local links into the application tab. Messages never leave the laptop.

### Review several roles at once

With `pnpm dev:local` running, start `pnpm dev:portals` in another terminal and open http://review.localhost:3100/. The hub links to 16 fictional persona sessions. Each named `*.localhost` host has its own host-only session cookie, so signing in as admin does not replace the student, founder or investor session. Sign in once per host with the accounts above. The browser must resolve localhost subdomains to loopback (the supported Chromium browser does this).

This helper binds only to 127.0.0.1 and forwards only to the local application on port 3000. It validates named hosts and browser origins, translates local origins for the upstream server, supports development WebSockets, and uses a stable loopback client address per persona. It does not bypass authentication or grant roles. It is a manual review aid, not evidence of production proxy or rate-limit acceptance. OAuth and email links use the canonical local address; following those links may move out of the isolated persona host.

The initial product review and proposed journey improvements are in `docs/PRODUCT-JOURNEY-REVIEW.md`.

The local launcher adds six questions to the empty fictional Validation Bootcamp demo, including a document requirement. It preserves any existing question set and all applications. Create a small fictional PDF locally to test uploads; uploaded documents and saved test data are not committed. Seeding this demo requirement is restricted to the loopback `knest_local_test` database. It is not an institutional application requirement.

Suggested testing sequence:

1. Browse programs, mentors, startups, events, resources, ecosystem and legal pages while signed out.
2. Create a fictional student account, verify it from the local inbox and complete onboarding. Or use the seeded student to start at onboarding.
3. Open a demo program, save a draft, upload a synthetic document, validate, submit and track it.
4. Sign in as reviewer or program manager, open the submitted application, review and decide; check the student notification and captured email. The current review queue is shared by authorized application-review staff.
5. Register for an event, submit a contact enquiry, edit a profile and exercise password recovery using the local inbox.
6. Publish and unpublish CMS content as content/admin; verify the public listing changes.
7. Request a slot in Local Test Maker Lab, approve it as labhead, and explore attendance and reports. Hours are 09:00–18:00 IST daily, with no minimum lead time in this fictional lab.
8. Repeat the important paths at phone width and with keyboard navigation; disconnect/reconnect to check recovery.

Labs and QR attendance are enabled only in this sandbox. Local development skips the external human check and disables Google OAuth by default. Automated integration tests separately enforce the human check using a controlled verifier and test browser script. Local S3/SMTP substitutes exercise the application paths, not AWS permissions or real delivery. Physical camera scanning, mobile installation, real-device offline behavior and hosted provider acceptance still need separate testing.

### Optional real Google sign-in

For stable product review after a successful `pnpm build`, run `pnpm dev:local --preview --google`. This serves the compiled standalone application on the same loopback address, using the same persistent local database, inbox and upload substitutes. It uses [Cloudflare's published dummy Turnstile pair](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Only that exact dummy site key on loopback hosts receives the published dummy token locally, with a visible test-mode label; server validation still calls Cloudflare. Real site keys and public domains use the normal widget. The production configuration checks remain enabled. It does not host anything publicly. It avoids development-only page compilation and live refresh; rebuild after changing application code. Omit `--google` for fictional password-only review, or omit `--preview` when actively editing with live reload. These dummy settings belong only to this loopback launcher.

On Windows the launcher also copies Sharp's installed sibling DLLs into the standalone package. Next's trace included the native `.node` file but omitted these DLLs; without them CMS/staff routes failed while simpler sign-in pages loaded. This copies existing installed dependencies and does not install or change packages.

After the private OAuth setup, run `pnpm dev:local --google`. The launcher reads `%LOCALAPPDATA%\KNEST\local-platform\google-oauth.json` (`clientId` and `clientSecret`) only with this explicit flag. It still clears unrelated shell/environment credentials and keeps database, mail and uploads on loopback. Never put this file or its contents in Git.

Use `http://127.0.0.1:3000/login` in a normal supported browser for real Google sign-in. The persona gateways are for fictional password sessions. New Google users are ordinary members; Google does not grant staff permissions. Existing password users sign in first, open **Account**, confirm their current password and connect the Google identity with the same email. Google-first users can request an emailed password setup link from Account without creating a second account.

The development client also has the owner-requested `https://kiitnest.com/api/auth/callback/google` callback registered. The public site remains undeployed; production requires separate credentials and hosted acceptance. See `GOOGLE-SIGN-IN-PLAN.md` for the setup record and test status.

For automated acceptance, `pnpm dev:local --verify` runs unit tests, a fresh production build and the full integration suite **before** starting the manual app. The integration suite uses another disposable database, restricted runtime database account, controlled email/storage/Turnstile services and real browser journeys; it does not reset the persistent manual-testing database. The command is intended to run when the local app is stopped.

## Verification on 18 October 2026

The combined local checkout passed the production build, TypeScript checking, and all 566 unit tests (57 files). Lint had zero errors and one existing unused-import warning. The complete production-build integration suite passed 417 tests across 34 files, with one documented expected failure: analytics client-IP throttling can be evaded by rotating forwarded IP headers (`40-analytics.test.ts`, KN-22c). This does not constitute hosted-provider or real-device acceptance.

Homepage, login and health returned 200 in the persistent manual sandbox. Browser sign-in as the local administrator reached the dashboard; mobile navigation opened. Visiting the CMS in development exposed an HTML hydration warning involving the public root layout and Payload's document layout. The CMS HTTP/role tests pass, but this development rendering issue remains to investigate; a green HTTP response alone does not certify its browser shell. Payload also regenerated its optional S3 media type fields while the sandbox storage plugin was enabled.

The first concurrent unit run hit two five-second timeouts while the production build and first page compilation were running. Both checks passed individually, and a fresh full run with two workers passed all 566 tests without increasing the test timeout. The local launcher limits its verification run to two unit workers for this reason.
