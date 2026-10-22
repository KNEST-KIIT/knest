# KNEST Google sign-in implementation plan

## Product decision

Keep the existing Auth.js and database-session architecture. Email/password and Google are two ways into the same KNEST identity. A person's member role determines their experience; server-managed staff permissions determine operational access. Use one web OAuth integration for all portals, rather than a separate Google client for each role. Staff access is never inferred from the Google email domain or an onboarding selection.

## Current evidence

- The provider, POST sign-in start route, login/signup buttons, database adapter and session revocation checks already exist. Buttons are shown only when both Google credential settings are present.
- The dedicated local launcher deliberately clears Google credentials. It needs an explicit, private opt-in configuration for real-provider testing; ordinary fictional local review must continue working without credentials.
- Existing credentials users are not automatically linked to Google. A verified, intentional linking journey and useful conflict messages are needed.
- The owner supplied the organization's Google Cloud page. Browser inspection confirmed the KNEST owner account and an existing development project. Account addresses and internal project identifiers remain outside this repository.
- Preparing **KNEST Development** as a new project without selecting billing failed with **Billing account is required**. No project was created and no billing association was changed. Inspect the existing project's unused OAuth configuration before reusing it for development. Do not overwrite an unrelated OAuth application.

## Console configuration completed — 18 October 2026

The existing project's Google Auth Platform was unused. With the owner's explicit approval of the API user-data policy and local OAuth credential creation, configured **KNEST Development**, External audience in Testing, and the web client **KNEST Web — Development**. No billing association or hosting resources were created.

Saved callbacks, verified in the client's detail page:

- `http://127.0.0.1:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`
- `https://kiitnest.com/api/auth/callback/google` — added on the owner's further request. This reserves the canonical callback; it does not deploy or enable the production site. Use a separate production project/client at launch.

Google's original credential dialog lost its browser-control connection before the secret could be saved. With specific owner approval, recovered the same client using a replacement secret. A diagnostic response exposed that replacement; with further explicit approval, disabled and deleted both unused secrets and saved one clean replacement privately, with a Windows ACL restricted to the local owner. The console now shows one enabled secret. No credential is recorded here or in the repository. Live local Google sign-in was verified on 19 October 2026, as recorded below.

Saved only the three non-sensitive identity scopes: `openid`, `userinfo.email`, `userinfo.profile`. Sensitive and restricted scope lists are empty. The app requests `openid email profile`, with state and PKCE, and does not persist Google's access/refresh/ID tokens.

The KNEST owner account is saved as the development test user. Publishing remains **Testing / External**, with no public publishing change.

## Implementation and verification

- Google and password sign-in share the existing database session and user tables. Verified Google email and stable subject are required. Staff permissions come only from KNEST's database.
- Existing password accounts require an intentional same-email connection with password proof and a short-lived, single-use grant bound to the current session. No dangerous email auto-linking is enabled.
- Account settings expose sign-in method status without serializing password hashes or Google tokens. Google-first users can request a single-use emailed password setup link, preserving the existing account and revoking sessions when the password is saved.
- Shared sign-in completion routes assigned staff to their work area and new members to onboarding. Safe return paths survive provider errors and password recovery.
- Preserved exact local callback addresses with the installed Next.js `skipProxyUrlNormalize` setting. The full callback test reproduced a token exchange asking for `localhost` after authorization used `127.0.0.1`; the setting resolves this mismatch. The strict provider stand-in still rejects mismatched redirects, bad PKCE and missing state cookies.
- The integration harness now launches the repository's installed Next.js executable directly. Its previous `npx` launch from a temporary directory had selected a different framework version.
- **576 unit tests passed across 59 files.** Production compilation and TypeScript checking passed. The build completed while the persistent local preview database was paused, so it logged local connection/fallback warnings; this is not hosted production acceptance.
- **49 targeted API tests passed across five files** after the callback fix: document boundaries, token hygiene, edge/cache controls, complete Google callbacks/linking/password setup/deactivation and remaining workflow handoffs. No automated browser driver was used for these API checks.
- Full lint reported zero errors and one pre-existing unused-import warning. Real Google browser consent/callback acceptance was subsequently completed below.

### Real Google acceptance — 19 October 2026

The owner explicitly approved the identity-only consent. The earlier attempt failed with Auth.js `InvalidCheck: state value could not be parsed` after its short-lived sign-in check expired while consent was pending. A fresh browser start, choosing the same KNEST account and completing the approved consent immediately, succeeded and opened onboarding.

The Account screen shows Google connected. A guarded read of the persistent loopback-only database confirmed one verified owner account, one Google identity, no staff role, and no stored Google access, refresh or ID tokens. Logging out returned to the public site. Signing in with Google again returned to the same user ID, with one Google link and one active session. No member role, onboarding answers or staff permissions were assigned on the owner's behalf.

Callbacks missing their expired state or PKCE cookie now return an actionable `GoogleSessionExpired` message, asking the person to select Continue with Google again in the same tab. Existing cookies still undergo Auth.js's full cryptographic validation. The return-path cookie remains available to the login recovery logic. Local proof is saved outside Git under the private review directory for 19 October.

The new production build and TypeScript checks passed. All **40 API checks across four files** passed against that build (token hygiene, edge controls, Google flows, workflow handoffs), including missing state, missing PKCE, tampered state rejection and a successful fresh retry. All **576 unit tests across 59 files** passed again, and focused lint passed for the changed route, login form and integration suite. The build's local database connection/fallback warnings reflect the deliberately paused preview database; they are not production acceptance.

After the development-server restart, browser review exposed repeated development refreshes that interrupted activation of the password form. Added the explicit `--preview` local-launcher option to serve the already tested standalone build with the same loopback database, mail and storage. This avoids development compilation/refresh during product review; it does not claim to repair the development reloader itself. Application code changes require a fresh build before previewing them.

The compiled preview also completed a real returning Google login and reached onboarding. Password review then exposed a blank, indefinitely pending third-party verification widget. Added a 15-second script-load timeout and visible manual retry, preserving entered form values and refusing submission without verification. Local preview uses Cloudflare's published dummy pair and token only for that exact site key on loopback hosts; the server still validates the token. Production site keys and public domains have no local-token substitution. Boundary tests cover permitted loopback hosts, lookalike public hosts and other site keys. The published dummy token's real verification endpoint returned success during dependency checking.

After the widget changes, the final build (including TypeScript) passed again, **587 unit tests across 60 files** passed, and the same **40 API regressions across four files** passed against the new build. Focused lint passed for the widget, testing boundary and launcher; a standalone typecheck also passed after adding preview mode. Earlier totals above record the preceding checkpoints.

### Final local browser acceptance

- The final compiled preview activates the login form and shows **Local test verification ready**. An incorrect fictional reviewer password showed **That email and password don’t match**, preserved the fields, and left retry enabled. The correct password authenticated and routed to `/admin/applications`.
- Opening that staff route exposed missing Sharp DLLs in Next's Windows standalone trace. Copied the already installed DLLs and added this packaging repair to the local launcher. The image processor loaded successfully; after restarting the runtime, the reviewer page displayed the existing accepted fictional application. Launcher typecheck and lint passed after the repair. No package or lockfile changed.
- Reviewer logout returned to the public site. The expired-Google recovery message was visible with both sign-in choices available. Starting Google again, choosing the approved KNEST account, and completing the callback returned to onboarding; Account then showed the same verified Google connection. No onboarding choices or staff roles were assigned for the real owner.
- Left the final Account page open in Brave. Local screenshots of the successful reviewer workspace and final connected Google account are saved outside the repository in the private review directory for 19 October 2026. The preview runs with `pnpm dev:local --preview --google`; database, mail and upload data remain local and persistent.

## Implementation sequence

1. **Cloud ownership and consent.** Use the KNEST-owned Google account. Use an unused development project/OAuth app; production must use a separate project. Configure a clear KNEST development name, support email, External audience to support approved non-KIIT contributors, and only `openid`, `email`, `profile`. Keep production publishing separate from local acceptance.
2. **Exact callbacks and secrets.** Register the web application callback `http://127.0.0.1:3000/api/auth/callback/google`, and `http://localhost:3000/api/auth/callback/google` if localhost is supported in the running configuration. These must exactly match the authorization request. Production uses `https://kiitnest.com/api/auth/callback/google` in its separate project once hosting, domain and public legal pages are ready. The persona subdomains on port 3100 are synthetic review aids, not production OAuth identities. Keep the client secret in private local settings/server environment, outside Git, browser bundles, screenshots and reports.
3. **New and returning people.** New Google users with a verified Google email create one ordinary member account and continue through onboarding. Returning linked users retain the same member ID, applications, profile and roles. Require Google's verified-email assertion; use the provider's stable subject/account ID. Disabled accounts stay blocked through either sign-in method.
4. **Existing password accounts.** Never blindly merge accounts just because email strings match. Ask the person to sign in to their existing account, then intentionally connect Google using a recent proof of account ownership and a protected OAuth flow. Show a clear account-conflict recovery route rather than a generic provider error. Keep existing account data and staff assignments intact.
5. **Password option for Google members.** Offer a secure emailed password-setup flow so Google-first members can choose email/password too. Preserve the original destination through setup and login. Do not require a new account or an administrator to reset the person's credential.
6. **Consistent entry and return.** Offer the same two choices on login and signup. Preserve application/event/staff return paths, handle cancellation and provider outages gracefully, and leave the password option available. Route authorized staff to the appropriate operating destination; ordinary users cannot acquire staff access through Google or URLs.
7. **Acceptance.** Run unit and API regressions, verify the live Google redirect/callback in the user's normal browser, and check new Google member, returning member, existing password account/link, password setup, cancellation, wrong account, disabled account, expired session, original destination, logout and each staff-role boundary. Real Google consent, institutional Workspace restrictions and production-domain acceptance are separate from stub-provider tests.

## Boundaries

This work uses Google for authentication only. Cloud hosting, databases, storage, Gemini services, IAM grants and production deployment are outside this setup. Preserve all local data and existing changes. OAuth credential creation and accepting Google's API user-data agreement require the browser's action-time confirmation when those concrete forms are ready.

## Primary references

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth policies, including separate deployment-tier projects](https://developers.google.com/identity/protocols/oauth2/policies)
- [Google OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)
- [Auth.js Google provider](https://authjs.dev/reference/core/providers/google)
