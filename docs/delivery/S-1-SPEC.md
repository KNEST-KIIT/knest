# S-1: hosting architecture validation gate

**Status: NOT AUTHORISED TO START.** It needs a sandbox AWS account, HD-19 (who owns the account) and your explicit go-ahead. Nothing here provisions anything.

Purpose: decide, with evidence, whether Option C (one EC2 Graviton host running the Next.js standalone build in Docker, private RDS) is a viable home for KNEST, before any production infrastructure exists. A successful `next build` proves nothing about this.

Managed Amplify Hosting is not assumed to work: AWS documents Next.js SSR support only "up through Next.js 15" and describes no private-VPC path for its compute (see blueprint R1 section 3).

## Memory capacity (additional requirement B)

A 2 GiB `t4g.small` has to hold, at the same instant during a blue/green deploy: the OS, the Docker daemon, the reverse proxy, the SSM and CloudWatch agents, **two** copies of the app (old and new, overlapping while the new one warms up and the old one drains), and any pool of idle database connections. The instance must not swap or be OOM-killed.

### What is known today (input only, not proof)
Measured locally on 2026-10-08 with `node .next/standalone/server.js` (Node 24, Windows x64, commit `a1ff0b9`):

| Point | Resident memory |
|---|---|
| After boot, idle | about 130 MB |
| After one request to each public page | about 170 MB |
| Peak under 6 rounds x 48 parallel requests | about 160 MB |
| After an anonymous `/admin` request | about 160 MB |

**This is a lower bound and must not be used for sizing.** There was no database, so Payload never initialised fully (every CMS query failed fast), no session was authenticated, and the Payload admin bundle was never loaded. It also ran on a different OS and CPU architecture from the target. The realistic figure is expected to be several times higher and has to be measured.

### Required measurements (all on the actual instance type, arm64, with a real RDS)
1. Resident memory (`docker stats` and `/proc`) for one container at: idle after warm-up; after a Payload admin login and opening a collection with the rich-text editor; during a 50-concurrent-user k6 run of browse, apply and submit with a 5 MB upload; after 30 minutes soak.
2. **Overlap test:** start container B while A is serving the k6 load, wait for B's health check, switch traffic, drain A, stop A. Record the combined peak of A+B+proxy+agents, swap activity and any OOM kill, across at least 5 consecutive deploys.
3. The same overlap test with the new container starting cold (first request triggers Payload init).
4. Behaviour with `NODE_OPTIONS=--max-old-space-size` set, and with Docker memory limits per container.
5. Image build memory. **The host must never build the image**; builds happen in CI and the host only pulls (ECR). Record the CI build's peak, since it fails on small runners.

### Pass criteria (proposed; needs your approval)
- Combined peak during the overlap, including the OS and agents, stays at or below 75% of the instance RAM, with zero swap-in and zero OOM kills over 5 deploys.
- p95 request latency during the overlap is no worse than 1.5x the steady-state p95.
- If it fails: first choice `t4g.medium` (4 GiB, about 8 USD/month more in Mumbai at on-demand prices); second choice a sequential swap (stop old, start new) with a short, announced deploy window; third choice Option D (ECS Fargate). Do not "fix" a failing result by adding swap.

## Other S-1 checks (from R1)
1. Payload admin login through the Auth.js bridge and CRUD on a collection.
2. RSC pages, server actions, `proxy.ts` behaviour, streaming `loading.tsx`.
3. `next/image` through sharp on arm64.
4. Presigned S3 upload with post-upload magic-byte verification.
5. SES send through the instance role.
6. Private RDS over TLS with a stable connection pool at 50 concurrency; the connection count recorded against RDS `max_connections` on a `db.t4g.micro`.
7. Client IP derivation behind Cloudflare (`CF-Connecting-IP` trusted only from Cloudflare's ranges).
8. Cold restart within 60 seconds.
9. Blue/green swap with zero failed requests.
10. Rollback to the previous image tag.

Each check produces a pass/fail record in `EVIDENCE/S-1.md` with command output. No check may be marked passed from documentation alone.

## Out of scope for S-1
Production resources, real data, DNS on any KIIT domain, SES production access requests, and any lab-booking code.
