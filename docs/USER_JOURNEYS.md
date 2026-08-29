# KNEST — User Journeys

> End-to-end flows for every user type. Each journey states where it starts, what the
> person sees, what the system does, and **where the journey currently ends** in this
> slice — so nothing dead-ends silently.
>
> Legend: `▸` user action · `→` system response · `⊣` end of journey in this slice

---

## The seven journeys at a glance

| # | Who | Entry | This slice ends at | Next slice |
|---|---|---|---|---|
| 1 | Student — exploring | Homepage | Dashboard with one next step | Event registration |
| 2 | Aspiring founder — has an idea | Homepage / program link | Submitted application, tracked | Acceptance → programme |
| 3 | Accepted founder | Email → login | Dashboard showing accepted status | Founder workspace |
| 4 | Mentor | `/mentors` or invite | Profile live in directory | Requests, sessions |
| 5 | Investor | `/invest` | Contact pathway | Dealflow |
| 6 | Partner | `/about` → contact | Contact pathway | Partner portal |
| 7 | Admin / staff | `/login` → `/admin` | Full operating console | — |

---

## Journey 1 — The student who isn't sure they're an entrepreneur

**The most important journey in the product.** Most KIIT students do not think of
themselves as founders. If KNEST only speaks to people who already self-identify as
founders, it addresses a tiny fraction of its actual audience.

```
▸ Lands on knest.kiit.ac.in (poster QR, a friend, a search)
→ "WHAT IF YOU ACTUALLY BUILT IT?"
   Not "KNEST is a university-wide entrepreneurship ecosystem."
   The first screen is about THEM, not about the institution.

▸ Scrolls. Reads: "maybe you've never thought of yourself as an
  entrepreneur — you don't need to."
→ The objection they were about to raise is answered before they raise it.

▸ Reaches WHERE ARE YOU IN YOUR JOURNEY? → picks "I'M CURIOUS"
→ "You don't need an idea yet. Start by finding problems worth solving."
   Choice is stored client-side. NO signup wall yet — asking for an
   account before giving anything is where curiosity dies.

▸ Sees what "curious" leads to: upcoming events, starter resources
▸ Clicks START YOUR JOURNEY
→ /signup, with the earlier choice carried through

▸ Enters name, email, password (min 12 chars)
→ Account created, session issued, straight into onboarding.
   No "check your email to continue" wall — verification is asynchronous
   and never blocks the first session (see Journey note below).

▸ Onboarding
   1 Who are you?        → Student          (pre-answered where inferable)
   2 What are you        → "Explore entrepreneurship"
     looking for?
   3 Where are you?      → Exploring        (PRE-FILLED from the homepage
                                             choice — the site does not ask twice)
   4 Interests           → AI, Climate
   5 Profile             → school, year, optional photo/LinkedIn/bio
   6 YOUR KNEST PATH     → "Start by exploring."
                           "Because you're exploring and want to understand
                            entrepreneurship, we'd start you at events and
                            foundational resources rather than an application."
                           ↑ the reason is shown, always

▸ Lands on /dashboard
→ WELCOME BACK, [NAME]
   Your journey: EXPLORATION
   YOUR NEXT STEP: one card, one action
   Below: upcoming events, starter resources
   ⊣ Ends here. They have an account, a stage, and exactly one next action.
```

**Design constraint this journey imposes:** the dashboard for a curious student must
show **one** next step. Twelve panels tells them they are behind on eleven things.

**On email verification:** the account works immediately; verification is required
only before submitting an application (Journey 2), where identity actually matters.
Blocking the first session on an email round-trip loses people at the exact moment
they were most willing.

---

## Journey 2 — The student with an idea → a submitted application

**The conversion journey. Everything public exists to produce this.**

```
▸ Homepage → WHERE ARE YOU? → "I HAVE AN IDEA"
→ "Good. Now let's find out if it's actually worth building."

▸ VALIDATE → /programs pre-filtered to stage=idea
→ Only programs that accept them at their stage. Not a catalogue —
   a shortlist. Filters live in the URL, so the view is shareable.

▸ Opens a program
→ /programs/[slug], structured to answer "is this for me?" BEFORE "apply":
     Who it's for  ·  What you'll build  ·  What you'll get
     Timeline  ·  Mentors  ·  Requirements  ·  Deadline  ·  FAQs
   The APPLY button is not the first thing on the page. Someone who
   applies without fitting wastes their time and a reviewer's.

▸ APPLY
→ Not signed in → /signup?next=/apply/[program]
   The intent survives the detour. After signup and onboarding they land
   back on the application, not on a generic dashboard.

▸ Onboarding (stage pre-filled to "Idea" from the homepage choice)
→ Step 6 recommends this same program — the recommendation agrees with
   what they already chose, which confirms rather than contradicts.

▸ /apply/[program] — multi-step, one section per screen
   Questions are configured per program by a program manager. No hardcoded
   form. Progress saved on every step transition.

▸ Closes the laptop mid-application
→ Draft persists. Dashboard shows "Draft — continue".
   Returning restores every answer. Applications are written in fragments
   between classes, not in one sitting.

▸ Returns, uploads a deck, hits SUBMIT
→ Validation: required questions, file types, sizes — server-side.
→ Email verification required here if not yet done. This is the point
   where identity matters.
→ Status: SUBMITTED
→ Confirmation screen: "Your application is in." + what happens next + when
→ Confirmation email, immediately
→ Dashboard now shows: [Program] — Submitted — [date]
   ⊣ Ends here. The applicant never wonders whether it went through.
```

**Every status change from here is visible and notified.** Silence after submitting is
the single worst experience an application system can produce.

---

## Journey 3 — The accepted founder

```
▸ Receives "Your application to [Program] — an update"
  Subject line does not reveal the outcome; the decision belongs on
  a page, not in a preview pane.
▸ Clicks through → /login → /dashboard/applications
→ Status: ACCEPTED, with next steps from the program manager

▸ /dashboard now renders the FOUNDER view rather than the student view
→ YOUR STARTUP · current stage · program · next milestone · resources
   ⊣ Ends here in this slice. Milestones, mentor sessions, documents
     and team are the founder workspace — next slice.
```

**Role transition is explicit, never silent:** acceptance offers to change
`platformRole` to `founder`; it is not flipped underneath them. A person's own
description of themselves is theirs to change.

---

## Journey 4 — The mentor

```
▸ Arrives via invitation from KNEST staff, or /mentors → "Want to help founders?"
▸ Signs up → onboarding, role = Mentor
→ Different step 2: "Support founders" / "Partner with KNEST"
→ Different step 3: NOT asked their journey stage — a mentor has no
   founder stage, and asking would signal the form was built for someone else.
→ Step 5 asks instead for expertise areas, years of experience, availability

▸ Step 6: "Your mentor profile is with our team."
→ Staff review before a profile goes public. KNEST vouches for who
   appears in its directory; an open directory is an unvouched one.

▸ Once approved → appears in /mentors under their expertise areas
   ⊣ Ends here. Founder requests, scheduling and sessions are next slice.
```

**Not built:** availability calendars, booking, session feedback. Below a certain
mentor count, "I need help with X → here are three people" beats a marketplace and is
honest about scale.

---

## Journey 5 — The investor

```
▸ /invest, usually from a KNEST conversation or an event
→ INVEST IN THE ECOSYSTEM — demo days, showcase, founder stories, contact
→ NOT a dealflow dashboard. There is no dealflow yet, and a filterable
   pipeline over an empty table tells an investor exactly one thing:
   that this ecosystem is younger than its website claims.

▸ Registers interest / contacts the team
   ⊣ Ends at a human conversation, which is where early investor
     relationships actually happen anyway.
```

---

## Journey 6 — The partner

```
▸ /about or /ecosystem → partnership section
→ What KNEST offers a partner: talent, research, corporate challenges,
   event presence
▸ Contact pathway
   ⊣ Ends at a human conversation. A partner portal needs partners first.
```

---

## Journey 7 — Staff, operating KNEST

**The test: can KNEST run for a week without a developer?**

### 7a — Program manager opens a cohort

```
▸ /login (same login as everyone; staffRole opens /admin)
▸ /admin → Programs → Create
   Name, who it's for, stage, sector, duration, dates, description, FAQs
▸ Builds the application form IN THE ADMIN:
   text · textarea · select · multi-select · URL · file upload
   marks required fields, sets the deadline
▸ Publishes
→ Live at /programs and /programs/[slug]. Filters index it automatically.
   No deploy. No developer.
```

### 7b — Reviewing applications

```
▸ /admin → Applications → filter by program, status
▸ Opens one: answers in the configured order, documents inline, applicant profile
▸ Sets status → SHORTLISTED
→ Applicant notified in-app and by email
→ Change written to the audit log: who, what, when, from → to
   ⊣ Reviewer role reaches applications and nothing else.
```

### 7c — Content admin updates the homepage

```
▸ /admin → Homepage
   Hero copy · hero media · featured programs/startups/events · testimonials
   · metrics · per-section enable + order
▸ Disables a section that has no content yet, reorders two others
→ Live immediately. Cannot break the layout: sections are a fixed set,
   toggled and reordered, never freely composed.
```

### 7d — Attaching a startup to a cohort

```
▸ /admin → Startups → Create → assign cohort
→ Appears automatically on that program's page, in the directory,
   and on its founders' profiles.
   Entered once, surfaces everywhere — relationships, not copies.
```

---

## Cross-cutting rules

Every journey obeys these. They are testable assertions, not aspirations.

1. **Never a dead end.** Every screen has a next action. Every empty state says what
   would fill it and what to do meanwhile.
2. **Never ask twice.** A homepage choice pre-fills onboarding. Onboarding pre-fills
   applications. Re-asking signals nothing was listened to.
3. **Intent survives interruption.** `?next=` through signup and onboarding; drafts
   survive a closed browser.
4. **The reason is always shown.** Recommendations state why. Rejected input states
   what to fix. No unexplained outcomes.
5. **Status is never silent.** Every application state change notifies in-app and by
   email.
6. **Progressive disclosure.** A first-time student sees one next step; a founder sees
   a journey; an admin sees the operating system.
7. **Roles change what you see, never whether you're locked out client-side.** Every
   boundary is enforced server-side by a guard.

---

## Journey coverage in this slice

| Stage | 1 Student | 2 Applicant | 3 Founder | 4 Mentor | 5 Investor | 6 Partner | 7 Admin |
|---|---|---|---|---|---|---|---|
| Discover | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Sign up | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Onboard | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Act | ✅ one next step | ✅ apply | ✅ see status | ⏳ profile only | ⏳ contact | ⏳ contact | ✅ full console |
| Participate | ⏳ next slice | ⏳ | ⏳ workspace | ⏳ requests | ⏳ dealflow | ⏳ portal | ✅ |

✅ built in this slice · ⏳ deferred, with the extension point in place
