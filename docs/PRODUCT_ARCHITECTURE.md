# KNEST — Product Architecture

> What this product actually is, where its boundaries sit, and what it deliberately
> does not do. Written before the UI, so those decisions are made once here rather
> than improvised screen by screen.

---

## 1. The product in one line

**KNEST is the digital front door and operating layer for entrepreneurship at KIIT.**

Not a website with an admin panel. Three connected surfaces around one shared model
of a person and their journey:

| Surface | Who | What it does | Success looks like |
|---|---|---|---|
| **PUBLIC** | Anyone | Discover, understand, self-locate, apply | A stranger finds the one program that fits them |
| **MEMBER** | Signed-in | Onboard, track, participate, build | Someone always knows their next step |
| **ADMIN** | Staff | Operate programs, review applications, publish | KNEST runs without developers |

The surfaces are not three apps. They are three views of one graph: a person has a
stage, a stage suggests programs, a program takes applications, an application has a
status, a status changes what the person's dashboard says next.

### What KNEST is not

- **Not a brochure.** A brochure ends at "contact us". This ends at a submitted application.
- **Not a social network.** No feed, no chat, no follower counts. Community here means
  a people directory, events, and mentor requests.
- **Not a startup CRM.** Founders get program, milestones and next action — not a
  Notion clone.
- **Not a marketplace.** Mentors are people to reach, not inventory to browse and book.

---

## 2. The core loop

Everything in this slice serves one loop. A feature that does not touch it is deferred.

```
                 DISCOVER
                    │           public site: homepage → programs
                    ▼
                 SELF-LOCATE
                    │           "where are you in your journey?"
                    ▼
                 ONBOARD
                    │           6 steps → a recommended path, with its reason
                    ▼
                 FIND PROGRAM
                    │           filters, then "is this for me?" before "apply"
                    ▼
                 APPLY  ◀────── the conversion event of the entire public site
                    │
                    ▼
                 TRACK
                    │           status, visible, never ambiguous
                    ▼
                 PARTICIPATE    (next slice)
```

**Why applications are in this slice and the founder workspace is not.** The public
site exists to produce applications. Shipping discover → onboard → "this is for me"
→ *nothing* would break the only journey the site is for. The founder workspace, by
contrast, serves people who have already converted — valuable, but it cannot be the
thing that is missing when the first cohort applies.

---

## 3. Surface boundaries

### Public — optimised for a stranger in 30 seconds

Server-rendered, cached, no authentication required, no client-side data fetching for
primary content. Every page answers four questions: what is this, who is it for, why
does it matter, what do I do next.

Routes: `/`, `/programs`, `/programs/[slug]`, `/startups`, `/startups/[slug]`,
`/mentors`, `/ecosystem`, `/invest`, `/events`, `/events/[slug]`, `/resources`,
`/about`, `/search`.

**Rule:** a public page may read only public content. Private operational data is not
merely hidden in the markup — it is never fetched into the component tree at all.

### Member — optimised for "what do I do next"

Requires a session. Personalised by `platformRole` and `journeyStage`.

Routes: `/onboarding`, `/dashboard`, `/dashboard/applications`, `/apply/[program]`,
`/profile`.

**Rule:** progressive disclosure. A first-time student sees ONE next step. A founder
sees a journey. Density is earned by engagement, never presented up front.

### Admin — optimised for operating, not admiring

Payload's console, gated by `staffRole`. Content editors control *content*; developers
control *experience*. That boundary is what protects the design system.

**Rule:** an admin can change what the homepage says and which items it features. An
admin cannot invent a layout. There is no drag-and-drop page builder, deliberately —
the alternative is twelve fonts and a broken mobile layout within six months.

---

## 4. Data architecture

### The split

One Postgres database, two schemas, one ORM.

```
 ┌──────────────── cms  (Payload) ────────────────┐   ┌─────────── app  (Drizzle) ───────────┐
 │ Program    Cohort     Startup    Founder       │   │ users            sessions            │
 │ Mentor     Partner    Event      Article       │   │ accounts         verification_tokens │
 │ Resource   Infrastructure        Testimonial   │   │ onboarding_responses                 │
 │ FAQ        Metric     Page       Media         │   │ applications     application_answers │
 │                                                │   │ application_documents                │
 │ EDITORIAL — publishable, versioned, public     │   │ notifications    audit_logs          │
 │                                                │   │ analytics_events                     │
 └────────────────────────────────────────────────┘   │                                      │
                                                      │ OPERATIONAL — private, transactional │
                                                      └──────────────────────────────────────┘
```

**Why.** A CMS is excellent at editorial content and bad at being a backend. Putting
applications, credentials and audit logs inside Payload would mean access control for
private data lives in CMS config, an editor UI becomes the place where sensitive rows
can be edited, and the operational model gets shaped by what the CMS finds easy.
Keeping them apart means each system does what it is good at.

**Verified physically.** `\dt cms.*` and `\dt app.*` return disjoint sets. Payload has
`schemaName: 'cms'`; drizzle-kit has `schemaFilter: ['app']`, so neither can migrate
the other's tables out from under it.

**Crossing the boundary.** By stable ID only (`applications.program_id` →
`cms.programs.id`), resolved in `src/server/services/`. Never a cross-schema join
inside a page component — that would couple the public render path to the operational
model and make the private/public separation a matter of care rather than structure.

**One ORM.** Payload 3 runs on Drizzle already, so using Drizzle for `app` avoids a
second ORM, a second connection pool, and two migration stories.

### Extension points (built, not used yet)

Designed now because retrofitting them costs a migration and a rewrite:

- **Applications are generic.** A program owns a *question set*; an application stores
  *answers keyed by question ID*. Adding a question is data, not a deploy. This is what
  makes "create a program without developers" true.
- **Notifications have a channel field.** In-app and email today; push later without
  reshaping the table.
- **Analytics events are funnel-staged**, so outcome tracking slots in without a
  re-instrumentation pass.
- **Startups carry a cohort relation** from day one, so program pages populate
  themselves rather than being curated by hand.

---

## 5. Identity and authorization

### One account, one login

A single `app.users` row per person, whatever they are. There is no separate staff
table: `staffRole` is what opens `/admin`, via a Payload auth strategy that consumes
the Auth.js session. Proved in Phase 0a before anything was built on it.

### Two role axes

```
platformRole   student · founder · mentor · investor · alumni · partner · other
staffRole      null · reviewer · content_admin · program_manager
               · startup_manager · mentor_manager · super_admin
```

Separate columns, not one enum, so a founder who also runs the mentor programme is
one account with two truthful roles rather than a permission matrix. Both stay coarse
deliberately — granular permissions are a V2 problem and a V1 liability.

### Enforcement

`src/server/auth/guards.ts` is the only enforcement point. Every server action, route
handler and protected page calls a guard as its **first statement**. Role checks inside
components decide what to *render*; a hidden button is not access control.

Three deliberate choices:

1. **Database sessions, not JWTs.** A JWT cannot be revoked — a demoted admin keeps
   access until it expires. Deleting a session row locks them out on the next request.
   *(Verified: deleting the row turned a working `/admin` into a 404 immediately.)*
2. **404, not 403, for `/admin`.** A 403 confirms the console exists and tells an
   attacker where to aim.
3. **Roles re-read from the database on every session read**, never trusted from the
   session payload, so revocation does not wait for a session to expire.

---

## 6. Content honesty

KNEST's ecosystem is beginning. The product must not pretend otherwise.

**Never invented:** startups, funding figures, mentors, investors, metrics, success
stories, partnerships, testimonials.

Every counter reads a real table, so an empty ecosystem renders `0` — and `0` is
correct, not a bug to be papered over. `EmptyState` is a first-class component, not a
fallback: at launch it is one of the most-seen surfaces in the product.

> **THE NEXT GENERATION IS BEING BUILT.**
> KNEST startups will appear here as they emerge.

beats a fabricated *"Acme AI — ₹5Cr raised"* — and the difference matters most to the
audience KNEST most needs to convince. A real first cohort is worth more than a
convincing fake one, and fake data makes the real one indistinguishable from it.

---

## 7. Deliberately absent

Each of these is a real feature that a "complete platform" would list. Each is absent
for a reason, not from lack of time.

| Absent | Why |
|---|---|
| Investor dashboard | There is no dealflow yet. A dashboard over an empty pipeline is a furnished empty room. `/invest` is an ecosystem surface until there is something to show. |
| Mentor matching / booking | Requires enough mentors that browsing fails. Below that threshold, "I need help with X → here are people" is better *and* honest. |
| Founder workspace (full) | Serves people who already converted. Program, milestones, next action is enough until real cohorts report what they actually need. |
| Messaging / community feed | A feed with nobody posting is worse than no feed. Needs a population first. |
| Infrastructure booking | Needs an operational booking policy that does not exist yet. Showcase only. |
| Co-founder discovery | Needs a critical mass of profiles. |
| Page builder | Would destroy the design system. Permanently absent, not deferred. |
| AI recommendation engine | The rule-based recommender is explainable, testable, and instant. An ML model here would be less accurate and less trustworthy. |

**The test each future feature must pass:** does it help KNEST acquire founders,
onboard people, operate programs, help founders build, demonstrate outcomes, or
connect the ecosystem? If not — defer it.

---

## 8. Technology

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16, React 19, TypeScript strict | Server rendering for performance and SEO |
| Content | Payload CMS 3, embedded | A real CMS without building one |
| Database | Postgres 16, Drizzle ORM | One ORM across both schemas |
| Auth | Auth.js v5, database sessions | Revocable; OIDC/SAML university SSO later |
| Styling | Tailwind v4 + CSS-variable tokens | Identity retunable in one file |
| Motion | `motion`, only for the 5 signature moments | Restraint is what makes them land |
| Hosting | ECS Fargate + ALB, RDS, S3/CloudFront, SES | AWS, containerised, no SaaS lock-in |

**Version constraint discovered in Phase 0a:** Payload 3.88 requires Next `>=16.2.6 <17`
and graphql `^16`. Upgrading Next past 17 requires a Payload upgrade in the same change.

---

## 9. Build sequence

```
0  Architecture proof + product artifacts    ← blocking gate
1  Design system
2  Database + CMS
3  Auth + roles
4  Onboarding
5  Programs
6  Applications          ← closes the loop
7  Dashboard
8  Public storytelling
9  Events / resources / startups / mentors / invest
10 Search + analytics
11 Security + performance
12 Polish
```

Phase 0 is complete. Phases 1–12 build against the approved artifacts in this
directory rather than improvising product decisions while writing components.
