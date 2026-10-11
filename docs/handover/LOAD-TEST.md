# Load test: target concurrency and pass criteria

Status: script written and exercised against a trivial local HTTP stub (200 requests, exit 0) and
for argument handling and the remote-host guard. It has not been run against the application, and it has never been run against AWS. Drill D7 in
`docs/delivery/DRILLS.md` stays NOT RUN until the release owner approves a run on the preview.

Script: `scripts/ops/load-test.mjs` (Node 20+, no dependencies).

## What it does

Sends anonymous `GET` requests in a fixed round-robin over nine paths: `/`, `/programs`,
`/events`, `/mentors`, `/blog`, `/about`, `/contact`, `/login`, `/api/health`. It never signs in,
never writes, and sends no header that bypasses an edge control. Request order and counts are
fixed, so two runs differ only by the machine and the network.

Writes are protected by the rate limits in `src/server/security/rate-limit.ts`, not by this
test. Authenticated and write behaviour at concurrency is covered by the integration suites
(`26-concurrency`, `24-last-admin-concurrency`).

## Profiles and pass criteria

| Profile | Concurrent clients | Requests | p95 limit | Error rate limit | Purpose |
|---|---|---|---|---|---|
| `smoke` | 5 | 200 | 1500 ms | 0 | Harness and app agree; run on a laptop |
| `d7` | 20 | 6000 | 1500 ms | 0.1% | DRILLS.md D7: one `t4g.small`, one `db.t4g.micro` |
| `peak` | 50 | 5000 | 1200 ms | 0.5% | The 50-concurrent-user figure in `S-1-SPEC.md` |
| `stress` | 100 | 10000 | 3000 ms | 2% | Finds the knee; informational |

A run fails (exit code 1) when any of these holds: error rate over the limit, p95 over the limit,
or any `429` response. A `429` is treated as a failure because the public read paths have no
limiter; a 429 means a rate-limit rule or the edge is interfering and the test is measuring that,
not the application. A `3xx` is an answer; a `4xx` or `5xx` is an error.

Thresholds are proposals. The release owner approves or changes them before D7 is recorded.

## How to run

```
# local, against a production build with a real database
pnpm build && pnpm start
node scripts/ops/load-test.mjs --base=http://localhost:3000 --profile=smoke
node scripts/ops/load-test.mjs --base=http://localhost:3000 --profile=d7 --json=d7.json
```

The script refuses any host that is not `localhost`, a loopback address or an RFC 1918 address,
unless `LOAD_TEST_ALLOW_REMOTE=1`. Setting that variable against the AWS preview or production
needs the release owner's written approval; the person running it records the result in
`DRILLS.md` D7 with the commit SHA.

## What to watch while it runs (D7)

- Container CPU and memory (`docker stats` locally, CloudWatch on AWS). Pass: memory under 75% of
  the instance, no OOM kill, no swap-in.
- Database connection count against the pool size and the `db.t4g.micro` limit.
- The `p95` and `error` figures in the JSON output.
- Origin behaviour behind CloudFront: with the origin-verification secret in place, a direct run
  against the origin is refused (`403`), so a hosted run goes through the distribution, and the
  CloudFront-Viewer-Address header then makes every request come from one client address.
  Nothing on these paths is limited per address, so this is harmless for D7 but it means the
  run says nothing about per-address limits.

## Not covered

- Authenticated dashboards and the Payload admin under load.
- Uploads (10 MB bodies) under load. S-1-SPEC.md asks for a 5 MB upload in the k6 mix; use k6
  for that run if the release owner wants it.
- Network distance from India to the region: run from a client in India for latency figures.
