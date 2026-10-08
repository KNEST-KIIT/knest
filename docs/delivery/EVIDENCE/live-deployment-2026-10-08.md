# Live deployment findings (read-only), 2026-10-08

Method: unauthenticated HTTP GET of public URLs from the engineer workstation, repeated at two points during the session (the second at 16:50 IST, 11:20 GMT). Nothing was written or modified. The KN-02 probes used `limit=0`, so no row could be returned. No account was created and no login was attempted (a login attempt writes to the rate-limit table). No student data was read, extracted or reproduced. There is no Vercel or AWS access from this machine (no CLI, no token), so everything below is what a visitor can observe.

## A. Findings

| Question | Finding | Basis |
|---|---|---|
| Publicly accessible? | **Yes.** `https://knest-kiit.vercel.app` serves KNEST over HTTPS from Vercel (`Server: Vercel`, edge `bom1`). `knest.vercel.app` is a different project; `knest.kiit.ac.in` does not respond. | OBSERVED |
| Which commit? | **Exact SHA UNVERIFIED** (not exposed publicly). It is at or after `00181d4` (2026-09-17): the lab-booking route exists (`/dashboard/lab-booking` answers 307 to login rather than 404), the Blog nav item and the invented `/blog` articles are present, and the footer still says "Campus Labs are Open". | INFERRED from content and routes |
| CMS API reachable? | **No.** Every Payload REST route returns HTTP 500 `{"message":"There was an error initializing Payload"}`: `/api/programs`, `/api/lab-bookings`, `/api/globals/homepage`, `/api/startups` (4 of 4 probes, both times). | OBSERVED |
| Database connected? | **The CMS database is not working.** Payload cannot initialise. Auth.js also reports "a problem with the server configuration" at `/api/auth/providers`, so sign-in is not functional either. Whether any database is attached at all, and which, is **UNVERIFIED** (the error text is generic). | OBSERVED / INFERRED |
| Anonymous access to lab-booking records? | **No records were retrievable** at either probe time, because Payload does not start. | OBSERVED |
| Could PII be exposed? | **Not by anything observed.** No student data was returned. The condition that would expose it is latent: the deployed code allows anonymous reads of lab bookings including booker e-mails (KN-02). If a working database with a `cms` schema is attached to this deployment before it is redeployed, those records become readable by anyone. Vercel environment variables, the project's database and its deployment history were not visible, so this cannot be ruled out for other deployments or preview URLs. | OBSERVED + code |

## Severity and evidence

| Item | Severity | State |
|---|---|---|
| KN-02, anonymous booker PII on the live deployment | **High, latent** (conditional on a database being attached) | Not exploitable at the times probed. Evidence: HTTP 500 on `/api/lab-bookings?limit=0` at both probes. |
| KN-01, fabricated public content | **Medium-High, active** | Visible now: `/blog` renders the invented "From Hostel Dorm to First 10,000 Users" and other invented articles; the programs page shows invented programs; the hero reads "The most dangerous thing you can do is graduate with just a degree". This is a public misrepresentation under KIIT's name. |
| KN-16, `/privacy` and `/terms` | Medium | Both return 404 although the footer links to them. |
| Sign-in broken | Medium (functional) | Auth.js configuration error; no one can log in or sign up. |

## Recommended containment (not performed; needs your authorisation)

1. **Do not attach a database to this deployment** until it has been redeployed from a build that includes the Phase 1 fixes.
2. Either put **Vercel Deployment Protection** (password or SSO) on the project, or **take it offline**, so the invented content is no longer public. Both are reversible and neither changes code.
3. Redeploying this branch would fix the content and the data exposure but needs your approval and a working configuration (a database with the `cms` schema created by `pnpm migrate`); it would also change what visitors see.
4. Check the Vercel dashboard for other deployments and domains, and for the environment variables the project holds. That answer decides whether anything else is exposed.

Nothing in the repository or on the live deployment was changed to produce this report.
