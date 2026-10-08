# pnpm audit --prod, before and after

Before (HEAD 00181d4, recorded in the forensic audit and re-run 2026-10-08): 4 critical, 21 high, 23 moderate, 7 low.

After (HEAD a1ff0b9):
```
{'info': 0, 'low': 0, 'moderate': 1, 'high': 1, 'critical': 0}
moderate esbuild GHSA-67mh-4wv8-2f99 patched: >=0.25.0 path: .>@payloadcms/db-postgres>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild
high braces GHSA-vfj7-8cjw-p6xm patched: <0.0.0 path: .>@payloadcms/next>sass>chokidar>braces
```

Both remaining advisories are accepted risks on build/dev-only paths; see FINDINGS.md (KN-03).
