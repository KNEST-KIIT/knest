# D-00: Is any KNEST deployment live? (2026-10-08)

Method: read-only HTTP GETs from the engineer workstation. No credentials were used and no data was written.
The KN-02 probe used `limit=0` so that no booking rows could be returned.

| Probe | Result |
|---|---|
| `GET https://knest-kiit.vercel.app/` | 200, `<title>KNEST — What if you actually built it? — KNEST</title>`, `Server: Vercel`, edge `bom1`. **A KNEST deployment is live.** |
| `GET https://knest.vercel.app/` | 404 (not this project) |
| `GET https://knest.kiit.ac.in/` | connection failed (no site) |
| `GET /api/lab-bookings?limit=0&depth=0` | **HTTP 500** `{"message":"There was an error initializing Payload"}`. Payload cannot start, probably because the DB or `cms` schema is missing, so no booking data was reachable at probe time. |
| `GET /api/programs?limit=0` | HTTP 500 (same cause) |
| `GET /blog` | 200, contains the fabricated article titles "From Hostel Dorm to First 10,000 Users" and "KNEST Investment Desk" (**KN-01 is live in public**) |
| `GET /privacy`, `/terms`, `/admin` | 404, 404, 404 |
| Response headers | CSP present with `unsafe-inline`; HSTS present (set by the platform: `max-age=63072000; includeSubDomains; preload`) |

## Conclusions
- KN-02: **latent, not currently exploitable on this deployment** (Payload fails to initialise). It becomes exploitable the moment a working `DATABASE_URL` with a `cms` schema is attached.
- KN-01: **actively live** on the public deployment (fallback content).
- KN-16: legal pages 404 in public.
- The deployment is on Vercel, which confirms the HD-01 ambiguity. The contract names AWS.

## Not verifiable from here (needs owner action)
- Which Vercel team owns the project, and which environment variables and database it is linked to.
- Whether the DB (probably Supabase, per the local `.env` variable names) is empty or holds data.

## Owner decisions requested (not acted on)
- Whether to take the live deployment offline or enable Vercel deployment protection until the Phase 1 fixes ship.
- Any production redeploy requires explicit owner approval (execution rules).
