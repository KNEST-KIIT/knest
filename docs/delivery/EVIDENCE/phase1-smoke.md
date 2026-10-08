# Phase 1 smoke test: production build, no database
Fresh `next start` of the build at HEAD a1ff0b9. No Postgres is reachable, so this proves boot, fail-closed behaviour and the absence of fabricated content, not DB-backed flows.

| Request | Result |
|---|---|
| `GET /` | 200  |
| `GET /programs` | 200  |
| `GET /startups` | 200  |
| `GET /mentors` | 200  |
| `GET /events` | 200  |
| `GET /blog` | 500  |
| `GET /about` | 200  |
| `GET /ecosystem` | 200  |
| `GET /login` | 200  |
| `GET /admin` | 404  |
| `GET /privacy` | 404  |
| `GET /dashboard/lab-booking` | 307  |
| `GET /api/lab-bookings?limit=0` | 500  |

| Forged analytics event (application_accepted) | 204 (4xx/204 = rejected, never 200) |
| Home hero contains approved spec copy | 1 match(es) |
