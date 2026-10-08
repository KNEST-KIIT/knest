# KNEST current state (2026-10-08, evening)

Facts with their evidence. Sources: `docs/delivery/` (tracker, findings, evidence), GitHub deployment records, read-only HTTP probes.

## Code
- Fixed work lives on `delivery/p1-containment` (local, 19+ commits ahead of the old default, **not pushed**). Local verification: 194 unit tests, 104 integration tests + 1 documented expected-fail (KN-22c), lint 0 errors, build passes, on an ephemeral PostgreSQL 16 with the production build. Details: `docs/delivery/EVIDENCE/phase1-verification-matrix.md`.
- Default branch `claude/knest-ecosystem-platform-g9erjs` = `aa725f4` = old `00181d4` + one maintenance file. The fixed work is **not** on it.
- Uncommitted in the working tree: `src/server/storage/index.ts` (another person's change: explicit S3 credentials). Preserved, unreviewed.
- CI workflow exists (`.github/workflows/ci.yml`) but has **never run on GitHub**.

## Live
- `https://knest-kiit.vercel.app` (Vercel team `knest1`, project `knest-kiit`) serves a 503 maintenance page for every request. Evidence: `docs/delivery/EVIDENCE/containment-2026-10-08.md`. It is containment, not protection and not a release.
- The earlier vulnerable deployment (`00181d4`) still exists behind Vercel SSO. Never re-promote it.
- No database is attached by anything done here. Whether the project holds a database is UNVERIFIED (no dashboard access).

## Infrastructure and domain
- AWS: the owner reports a root-user session (profile `claude-deploy`, ap-south-1). The AWS CLI is not installed in this environment, so nothing has been inspected. Plan type (Free/Paid) unknown. No AWS resource exists from this work.
- Domain: not supplied. DNS, Cloudflare and SES-domain work is blocked.

## Open gates
HD-04 copy approver, HD-06 privacy/terms, HD-16 lab policy, HD-19 AWS account owner, HD-21 invoice record, HD-22 contract variation, the exact commercial document KIIT holds, S-1 approval (bill of materials and spending ceiling).
