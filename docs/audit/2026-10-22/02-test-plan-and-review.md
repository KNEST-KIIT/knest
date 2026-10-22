# Test plan and pre-execution review — in progress

The initial catalogue contains 306 **case families**, all NOT RUN. Families are not counted as individual executed assertions. Route, handler and component families must be decomposed using actual fixtures, role boundaries, interactions and states before execution. Detailed machine ledger: `test-results/qa-2026-10-22/test-cases-draft.json`.

## Review findings to resolve before execution

- Accessible functional specifications conflict with later security changes: verify-first signup supersedes the early low-friction flow, but approval provenance must remain transparent.
- The 53-module contract copy is explicitly unauthenticated; historical status columns are not current test oracles. AWS-native owner decisions supersede obsolete vendor wording.
- Existing accessibility scans fail serious/critical impacts only; green scans cannot prove all WCAG AA criteria or manual screen-reader/device behavior.
- The analytics rotating-forwarded-IP expected-failure case uses a deliberately trusted-header test configuration. It is not proof of a public-production proxy bypass. Re-evaluate its threat-model assumption separately.
- Shared onboarding helpers select the first goal/stage and exercise only a student branch. They do not prove every role, goal, stage or skip combination.
- Browser scripts may use reduced motion and a synthetic human-check script; real widget delays, default motion, failure recovery and unusual browser state need separate cases.
- Existing browser suites must be reproduced through the connected browser controls. A command-line browser driver will not be used to operate the user browser. API-only suites and pure code tests can use their existing runners.
- Empty/error-state requirements need populated and empty datasets plus controlled failure; a 200 response or screenshot alone is insufficient.
- Physical devices, long-term key retention, camera behavior, institutional sign-offs and hosted operations cannot be inferred from laptop unit tests.

**Review gate is not complete. No functional test execution has begun in this audit.**

## Pre-execution second pass — local baseline batch

The build, pure-unit and API-only baseline cases have now been reviewed against their implementation boundaries, test setup and the current specifications. Review is by the current auditor in a separate pass over the existing suite; no independent human reviewer is claimed. Broader UI/state families remain pending and are not accepted by these checks.

- All three old preview addresses were probed outside the sandbox and refused connections. A sandbox EACCES was recorded as a tool restriction, not an application failure.
- Fresh compilation uses explicit synthetic credentials and unreachable loopback service endpoints, with dotenv/shell provider settings blanked. No production data can be reached. Two build workers are selected using the installed Next.js CIRCLE_NODE_TOTAL setting.
- API fixtures use the existing guarded disposable PostgreSQL, SMTP/storage/verifier stand-ins and least-privilege runtime identity. Their allowed writes are synthetic local fixture state.
- Nine browser-suite files are excluded from command-line browser execution. The API-only portions of the QR file can be executed with the real-browser describe block excluded, and their exact skipped cases remain NOT RUN.
- The migration drift assertion in the dependency suite can write generated migrations under src; that one assertion will be executed equivalently in an isolated copy instead of the worktree.
- The analytics expected-failure is retained visibly, and will be interpreted separately from framework pass counts. A trusted-header harness does not prove a deployed spoofing defect.

Baseline execution gate: **READY**. All other case-family review gates remain **PENDING**.
