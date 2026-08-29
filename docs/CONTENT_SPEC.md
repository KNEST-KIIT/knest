# KNEST — Content Specification

> **This is production copy, not placeholder text.** Every string below ships as
> written unless changed here first. Copy is a product decision, so it is made once,
> reviewably, rather than improvised inside components.
>
> **Voice:** direct, warm, unhurried, never institutional. Short sentences. Second
> person. No exclamation marks. No "revolutionary", "cutting-edge", "world-class",
> "unleash", "empower", "ecosystem synergies". KNEST talks to one person at a time.
>
> **Test for every string:** would a 19-year-old who has never called themselves an
> entrepreneur read this and feel spoken to rather than sold at?

---

## 1. Homepage

Sections are CMS-controlled and individually disableable. Order is fixed; copy below
is the default the seed installs.

### 1.1 Hero — signature experience 01: WHAT IF?

```
WHAT IF YOU
ACTUALLY BUILT IT?
```

Sub:

> Most ideas stay ideas. Not because they were bad — because nobody ever took
> the next step.

Primary CTA: **START YOUR JOURNEY** · Secondary: **EXPLORE PROGRAMS**

> **Why not "KNEST is KIIT's entrepreneurship ecosystem"?** That sentence is about
> the institution. The first screen has to be about the reader, or they leave before
> reaching the part that is about them.

### 1.2 The problem

```
THE HARDEST PART ISN'T THE IDEA.
```

> You've probably had one. In a lecture, on a commute, watching something
> work badly and thinking *someone should fix this*.
>
> Then the semester moved on.
>
> The gap between noticing something and building something is where almost
> everything is lost. Not to a lack of talent. To a lack of a next step.

### 1.3 The person

```
YOU DON'T HAVE TO BE
"AN ENTREPRENEUR" YET.
```

> Maybe you've had an idea.
> Maybe you've noticed something that doesn't work.
> Maybe you've wondered why nobody has fixed it.
> Maybe you've never thought of yourself as an entrepreneur.
>
> You don't need to.
>
> Start with the question.

### 1.4 KNEST

```
KNEST IS WHERE YOU FIND OUT
WHAT HAPPENS NEXT.
```

> We're KIIT's innovation and entrepreneurship ecosystem: programs,
> mentors, workspace, industry access and a community of people building
> things — open to every student, at every stage, including the stage
> where you have nothing but a question.

### 1.5 Journey selector — signature experience 02: WHERE ARE YOU?

```
WHERE ARE YOU RIGHT NOW?
```

> There's no wrong answer, and no stage that's too early.

| Choice | Response | CTA | Leads to |
|---|---|---|---|
| **I'M CURIOUS** | You don't need an idea yet. Start by finding problems worth solving. | EXPLORE → | Events + starter resources |
| **I HAVE AN IDEA** | Good. Now let's find out if it's actually worth building. | VALIDATE → | `/programs?stage=idea` |
| **I'M BUILDING** | The idea is no longer hypothetical. Now it needs users, feedback and momentum. | BUILD → | `/programs?stage=mvp` |
| **I HAVE A STARTUP** | You've crossed the first line. Now the question is how far it can go. | GROW → | `/programs?stage=scaling` |
| **I WANT TO HELP FOUNDERS** | Founders need people who've already done the hard part. | GET INVOLVED → | `/mentors` |

Selection is remembered and pre-fills onboarding step 3.

### 1.6 The journey — signature experience 03

```
FROM QUESTION TO VENTURE.
```

> Nobody goes from idea to company in one leap. Here's the path, and where
> KNEST meets you on it.

`CURIOUS → IDEA → VALIDATION → BUILDING → LAUNCH → GROWTH`

Under each, in the live product: which programs serve that stage, drawn from the CMS.
When a stage has no program yet: *"Programs for this stage are being built."*

### 1.7 What you get

```
WHAT KNEST ACTUALLY GIVES YOU.
```

| | |
|---|---|
| **PROGRAMS** | Structured paths from idea to venture, run in cohorts. |
| **MENTORS** | People who've built things, made mistakes, and will tell you about both. |
| **SPACE** | Labs, studios and desks. Somewhere to build that isn't your hostel room. |
| **INDUSTRY** | Introductions to companies, customers and partners you couldn't reach alone. |
| **COMMUNITY** | Other people building things. This turns out to matter more than anyone expects. |

### 1.8 The ecosystem — signature experience 04

```
NOBODY BUILDS ALONE.
```

> KNEST connects students, founders, mentors, researchers, industry
> partners and investors across KIIT. Your idea is one introduction away
> from someone who can help.

### 1.9 Built with KNEST — signature experience 05

Once startups exist:

```
BUILT WITH KNEST.
```

**Until then (§46 — the honest version ships first):**

```
THE FIRST GENERATION
IS BEING BUILT.
```

> KNEST's first ventures are taking shape now. Their stories will be here.
> If you'd like one of them to be yours, this is the moment to start.

CTA: **START YOUR JOURNEY**

### 1.10 Closing

```
THERE IS SOMETHING
YOU COULD BUILD.
```

> Let's find out what it is.

Primary CTA: **START YOUR JOURNEY** · Secondary: **BROWSE PROGRAMS**

---

## 2. Programs

**`/programs` header**

```
FIND WHERE YOU FIT.
```

> Every program is built for a particular stage. Start with where you
> actually are, not where you think you should be.

Filters: `Stage · Sector · Who it's for · Format · Status`
Filter empty: *"No programs match that combination yet. Try widening one filter."*
Page empty: *"Programs are being finalised. Applications open soon — create an account and we'll tell you first."*

**Card:** name · who it's for · stage · duration · next cohort · status badge · **VIEW PROGRAM**

Status badges: `APPLICATIONS OPEN` · `CLOSING SOON` · `OPENS [date]` · `IN PROGRESS` · `CLOSED`

**`/programs/[slug]` section headings** — in this order, apply last:

```
WHO THIS IS FOR          ← first. Fit before commitment.
WHAT YOU'LL BUILD
WHAT YOU'LL GET
HOW IT RUNS
WHO YOU'LL MEET
WHAT WE ASK OF YOU
QUESTIONS
READY?
```

Apply block: **APPLY TO [PROGRAM]** · *Applications close [date] · Takes about 20 minutes · You can save and come back.*

Closed: *"Applications for this cohort have closed. The next cohort opens [date]."* → **NOTIFY ME**
Not eligible: *"This program is for founders at [stage]. Based on your profile you're at [stage] — [other program] may fit better."* (Never blocks; only advises.)

---

## 3. Sign up / log in

**`/signup`**

```
START YOUR JOURNEY.
```

> One account. It follows you from your first event to your first venture.

Fields: `Your name` · `Email` · `Password` — *At least 12 characters. Length matters more than symbols.*
Button: **CREATE ACCOUNT** · *Already have one? Log in.*
Google: **Continue with Google** — divider: *or*

**`/login`**

```
WELCOME BACK.
```

Button: **LOG IN** · *Forgot your password?* · *New to KNEST? Start your journey.*

**`/reset`**

```
RESET YOUR PASSWORD.
```

> Enter your email and we'll send you a link.

After submit — deliberately identical whether or not the account exists:
*"If there's an account for that address, the link is on its way. Check your inbox."*

**`/verify`**

```
CHECK YOUR EMAIL.
```

> We've sent a link to **[email]**. It expires in 24 hours.

*Didn't arrive? Check spam, or* **send it again**.

---

## 4. Onboarding

Progress: `Step [n] of 6`. Every step: **BACK** and **CONTINUE**. Steps 4 and 5 skippable.

**Step 1** — `WHO ARE YOU?` / *This changes what KNEST shows you. You can change it later.*
Student · Founder · Mentor · Investor · Alumni · Partner · Something else

**Step 2** — `WHAT BRINGS YOU HERE?` / *Pick as many as apply.*
Build a startup · Explore entrepreneurship · Join a program · Find mentors · Meet co-founders · Learn something new · Support founders · Partner with KNEST

**Step 3** — `WHERE ARE YOU RIGHT NOW?` / *Be honest — there's no stage that's too early.*
Just exploring · I have an idea · Validating it · Building an MVP · Early revenue · Scaling · Established company

*(Pre-filled from the homepage choice. Banner: "You told us this on the way in — change it if that's not right.")*
*(Skipped for mentors, investors and partners: they have no founder stage, and asking would signal the form was built for someone else.)*

**Step 4** — `WHAT ARE YOU INTERESTED IN?` / *For recommending programs, events and people. Skip if you're not sure.*
AI · FinTech · Health · Climate · DeepTech · SaaS · Consumer · Education · Hardware · Agriculture · Mobility · Space · Social Impact · Media · Gaming

**Step 5** — `TELL US ABOUT YOU` / *Only your name is required. The rest helps people find you.*
Photo *(optional)* · Name · School or department · Year of study · LinkedIn *(optional)* · A line about yourself *(optional — "What are you interested in building, or figuring out?")* · Skills *(optional)*

**Step 6** — `YOUR KNEST PATH`

> Based on what you've told us, here's where we'd start.

Card: **[PATH NAME]** + one sentence + *Why this: [explicit reason]* + **[ACTION]** + *Not quite right? Change your answers.*

| Path | Copy | Reason shown | Action |
|---|---|---|---|
| **EXPLORE** | Start with events and the fundamentals. No idea required. | You're exploring and want to understand entrepreneurship — so we'd start you with people and ideas, not an application. | SEE WHAT'S ON |
| **VALIDATE** | You have an idea. The next job is finding out if it's real. | You have an idea but haven't tested it yet — validation comes before building. | FIND A PROGRAM |
| **BUILD** | Time to put something in front of real users. | You're building — what you need now is momentum, feedback and structure. | SEE PROGRAMS |
| **GROW** | You've got a startup. Now: customers, capital, scale. | You already have a startup, so we'd point you at growth and investor access rather than early-stage work. | SEE PROGRAMS |
| **MENTOR** | Founders need people who've done the hard part. | You're here to support founders — the next step is completing your mentor profile. | COMPLETE PROFILE |
| **CONNECT** | Let's find the right conversation. | Partnerships start with a conversation rather than a form. | GET IN TOUCH |

---

## 5. Dashboard

**Student:** `WELCOME BACK, [FIRST NAME].` / *Here's where you are.*
`YOUR JOURNEY: [STAGE]` → `YOUR NEXT STEP` (one card, one action) → `WHAT'S COMING UP` → `WORTH READING`

**Founder:** `[FIRST NAME], HERE'S WHERE THINGS STAND.`
`YOUR APPLICATIONS` · `YOUR PROGRAM` · `NEXT MILESTONE` · `RESOURCES FOR YOUR STAGE`

**Mentor:** `THANKS FOR BEING HERE, [FIRST NAME].`
`YOUR PROFILE` · `PROGRAMS YOU SUPPORT` · `UPCOMING`

Nothing scheduled: *"Nothing on your calendar yet. Here's what's coming up at KNEST."*

**`/dashboard/applications`** — `YOUR APPLICATIONS`
Columns: Program · Submitted · Status · Action
Empty: *"You haven't applied to anything yet. When you do, you'll be able to track it here."* → **BROWSE PROGRAMS**

| Status | Label | Sub-line |
|---|---|---|
| draft | **DRAFT** | Not submitted yet — pick up where you left off. |
| submitted | **SUBMITTED** | We have it. You'll hear from us by [date]. |
| under_review | **UNDER REVIEW** | Someone is reading your application now. |
| shortlisted | **SHORTLISTED** | You're through the first round. |
| interview | **INTERVIEW** | We'd like to talk. Details in your email. |
| accepted | **ACCEPTED** | You're in. Welcome to [program]. |
| waitlisted | **WAITLISTED** | Not a no. We'll be in touch if a place opens. |
| rejected | **NOT THIS TIME** | Not this cohort — but not never. See what else fits. |

> `rejected` is never labelled "Rejected". The person is not rejected; this application
> was. Programs that turn people away permanently do not get second applications from
> people who got better in the meantime.

---

## 6. Application flow

**Intro** — `APPLY TO [PROGRAM]`
> About [n] questions, roughly 20 minutes. You can save and come back — nothing is
> submitted until you say so.

Button: **START APPLICATION** · resuming: **CONTINUE APPLICATION** *(Saved [relative time])*

Per step: `Section [n] of [m]` · **BACK** · **SAVE & CONTINUE** · *Saved automatically*
File upload: *Drop a file, or* **choose one** — *PDF, DOC or PPT. Up to 10 MB.*

**Review** — `BEFORE YOU SUBMIT` / *Have a last look. You won't be able to edit after this.*
→ **SUBMIT APPLICATION**

**Confirmation** — `YOUR APPLICATION IS IN.`
> We've got it. Here's what happens next:
> 1. Our team reads every application.
> 2. Shortlisted applicants hear from us by **[date]**.
> 3. You can track the status any time from your dashboard.
>
> A confirmation is on its way to **[email]**.

**TRACK YOUR APPLICATION** · **BACK TO DASHBOARD**

---

## 7. Emails

Plain, signed by a person, never by "The KNEST Team, Automated".

| Email | Subject | Opening |
|---|---|---|
| Verify | `Confirm your email for KNEST` | You're one click from finishing your KNEST account. |
| Reset | `Reset your KNEST password` | Someone asked to reset the password for this address. If it wasn't you, ignore this — nothing has changed. |
| Application received | `We've got your application to [Program]` | Thanks for applying to [Program]. Your application is in and our team will read it. We'll be in touch by [date]. |
| Status change | `Your application to [Program] — an update` | There's an update on your application to [Program]. |
| Shortlisted | `Your application to [Program] — an update` | Good news: you've been shortlisted for [Program]. |
| Accepted | `Your application to [Program] — an update` | You're in. Welcome to [Program]. |
| Not selected | `Your application to [Program] — an update` | We're not able to offer you a place in this cohort of [Program]. That's a decision about this cohort, not about you or your idea. Here's what else might fit. |
| Deadline | `Applications for [Program] close [day]` | You started an application to [Program] and haven't submitted it yet. Applications close on [date]. |
| Event reminder | `[Event] is tomorrow` | Just a reminder — [Event] is tomorrow at [time], [location]. |

Footer: *You're receiving this because you have a KNEST account. Manage what we send you.*

> **Status subjects are deliberately identical.** A subject line that reveals the
> outcome delivers a rejection in a notification preview, in public, with no context.

---

## 8. Empty states

Format: what's here · why it's empty · what to do meanwhile.

| Where | Heading | Body |
|---|---|---|
| Startups | **THE FIRST GENERATION IS BEING BUILT.** | KNEST's first ventures are taking shape. Their profiles will appear here as they launch. |
| Mentors | **OUR MENTOR NETWORK IS FORMING.** | We're bringing together founders, operators and investors who want to help. If that's you, we'd like to hear from you. |
| Events | **NOTHING SCHEDULED RIGHT NOW.** | New sessions, workshops and talks are added regularly. Create an account and we'll let you know. |
| Programs | **PROGRAMS ARE BEING FINALISED.** | Applications open soon. Create an account and we'll tell you first. |
| Resources | **RESOURCES ARE ON THE WAY.** | Guides, templates and playbooks for each stage are being written. |
| Search | **NOTHING MATCHED "[QUERY]".** | Try a shorter phrase, or browse programs, events and resources. |
| Admin (no data) | **NOTHING HERE YET.** | [Items] you create will appear here. |

> Never "No data available", never a spinner that resolves to blank, never a fake
> skeleton row.

---

## 9. Errors

**Form-level**

| Situation | Message |
|---|---|
| Required | This one's needed. |
| Bad email | That doesn't look like an email address. |
| Short password | Use at least 12 characters. |
| Login failed | That email and password don't match. |
| Email taken | That email can't be used to sign up. *(Deliberately vague — enumeration.)* |
| File too large | That file is over 10 MB. Try compressing it. |
| Wrong file type | We can take PDF, DOC or PPT files. |
| Rate limited | Too many attempts. Wait a minute and try again. |
| Deadline passed | Applications for this program closed on [date]. |

**Page-level**

| Code | Heading | Body | Action |
|---|---|---|---|
| 404 | **THIS PAGE DOESN'T EXIST.** | It may have moved, or the link may be wrong. | GO HOME · SEARCH |
| 403 | **YOU DON'T HAVE ACCESS TO THIS.** | If you think you should, get in touch. | BACK TO DASHBOARD |
| 500 | **SOMETHING WENT WRONG ON OUR END.** | Not your fault. We've been told about it — try again in a moment. | TRY AGAIN · GO HOME |
| Offline | **YOU'RE OFFLINE.** | Check your connection. Your work is saved. | RETRY |

> No error blames the user, uses a code as a headline, or says "Oops!".

---

## 10. Navigation & footer

**Nav:** `KNEST` · Programs · Startups · Ecosystem · Events · Resources · About · **START BUILDING** · Log in
**Signed in:** Programs · Startups · Ecosystem · Events · Resources · **DASHBOARD** · [avatar]

**Footer**
- *Explore:* Programs · Startups · Events · Resources · Ecosystem
- *KNEST:* About · Infrastructure · Partners · Mentors · Contact
- *Get involved:* Apply · Become a mentor · Partner with us · Invest

> KNEST — KIIT's innovation and entrepreneurship ecosystem.
> KIIT University, Bhubaneswar, Odisha.

Bottom: *© [year] KNEST, KIIT University.* · Privacy · Terms

---

## 11. Microcopy

| Element | Text |
|---|---|
| Save (idle / active / done) | Save · Saving… · Saved |
| Submit (idle / active) | Submit application · Submitting… |
| Loading | Loading… *(never "Please wait")* |
| Optional field | *(optional)* — lowercase, in the label |
| Required marker | Nothing. Mark optional fields instead; most are required. |
| Character count | [n] left — appears at 80% of the limit, not before |
| Unsaved changes | You have unsaved changes. Leave anyway? |
| Destructive confirm | This can't be undone. Delete [item]? |
| Success toast | Saved. / Published. / Sent. |
| Sign out | Log out |

**Dates:** `12 March 2026`. Relative under 7 days (*"in 3 days"*, *"2 hours ago"*).
Deadlines always absolute **and** relative: *"Closes 12 March — 5 days left."*

---

## 12. Words KNEST does not use

| Never | Instead |
|---|---|
| Utilize · Leverage | Use |
| Cutting-edge, world-class, revolutionary, game-changing | *(delete — say the specific thing)* |
| Unleash / unlock your potential | *(delete)* |
| Synergy, ideate, disrupt | *(delete)* |
| Users | Students, founders, mentors, people |
| Onboarding *(user-facing)* | Getting started |
| Submit your candidature | Apply |
| Kindly note / Please be advised | *(delete)* |
| We are pleased to inform you | *(get to the point)* |
| Oops! | *(say what happened)* |

**Sentence case for body copy. ALL CAPS reserved for display headings and buttons.**
