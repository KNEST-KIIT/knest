# Lab operations guide

Audience: lab heads, lab assistants and lab administrators.

After reading this you can set up a lab, run its daily requests, record attendance, and pull a report.

## Read this first: lab booking is switched off

**Lab booking stays off until the lab operating policy (HD-16) is answered and signed by people.**

- The feature is controlled by `FEATURE_LAB_BOOKING`. It is off by default. While it is off, every lab page and lab API address answers "not found", and the Labs link is hidden from the staff console.
- HD-16 is `docs/delivery/HD-16-LAB-POLICY-QUESTIONNAIRE.md`. As of 2026-10-09 its status is BLOCKED. No answers have been given and its sign-off table is blank. The sign-off must be completed by KNEST and the lab heads. Engineering never completes it.
- **Every policy number in this guide is an unapproved default.** They are the "recommended default" column of HD-16. They are a starting point for discussion, not a decision. Nobody has approved them. Each lab head and KNEST set the real values, and you can change every one of them in the lab console.
- The privacy notice and terms (HD-06) are also unapproved. The platform must not collect real student data until KIIT approves a notice.
- The screens described here exist. The delivery record says they were tested locally behind the flag, but no integration test runs with the flag off. They have not been used by a real lab, on a real site, by real people.

Sign-off record (to be filled in by people):

| Item | Who | Date | Evidence |
|---|---|---|---|
| HD-16 answered and signed | [PLACEHOLDER: KNEST lead name] | [PLACEHOLDER: date] | [PLACEHOLDER: reference] |
| Lab heads accepted the rules for their lab | [PLACEHOLDER: lab head names] | [PLACEHOLDER: date] | [PLACEHOLDER: reference] |
| Privacy notice approved (HD-06) | [PLACEHOLDER: approver name] | [PLACEHOLDER: date] | [PLACEHOLDER: reference] |
| Booking switched on | [PLACEHOLDER: engineering contact] | [PLACEHOLDER: date] | [PLACEHOLDER: reference] |

## What is and is not built

| Built | Not built |
|---|---|
| Lab registry, opening hours, closed dates | Signed QR passes and scanning |
| Request, approve, decline, suggest another time | Two-sided check-in |
| Assistant roster | Offline mode and phone install (PWA) |
| Manual attendance, labelled "manual" | Door control (not planned) |
| Reports and spreadsheet download | Automatic expiry of unanswered requests |

QR and offline features wait for a threat-model review, tests on real phones and your review (`docs/delivery/LAB-ATTENDANCE-THREAT-MODEL.md`, `LAB-DEVICE-TEST-PROTOCOL.md`, `LAB-HEAD-REVIEW-PACKET.md`). Until then, attendance is recorded by hand.

## Who does what

| Role | How a person gets it | What they can do |
|---|---|---|
| Lab administrator | The `lab_admin` staff role, or super admin | Create labs. Appoint and remove heads. Everything a head can do in every lab. Open or close a lab. Reports for every lab. |
| Lab head | Added to a lab as "head" by a lab administrator | In their own lab: decide requests, cancel bookings, change rules, hours and closed dates, add and remove assistants, mark attendance, see the lab report |
| Lab assistant | Added to a lab as "assistant" by a head or administrator | In their own lab: see approved bookings and recent history, mark attendance. See their own upcoming duties. |
| Member | Anyone with a KNEST account who meets the lab's rule for who can book | Request time, accept or decline a suggested time, cancel their own booking |

Lab roles come only from the lab's own staff list. A head or assistant does not need a staff role in the main console.

Every lab person must:

- have a KNEST account with a **verified email address**, and
- have **finished onboarding**. The lab console sends people who have not finished onboarding back to finish it.

## Where to work

| Who | Address | What it is |
|---|---|---|
| Heads and assistants | `/dashboard/lab-staff` | The list of your labs and your upcoming duties |
| Heads and assistants | `/dashboard/lab-staff/<lab>` | One lab's console |
| Heads and administrators | `/dashboard/lab-staff/<lab>/report` | That lab's report |
| Administrators | `/admin/labs` | Create labs, see all labs |
| Administrators | `/admin/labs/report` | The report for all labs |
| Members | `/dashboard/lab-booking` | See labs, request time, see their bookings |

Anyone who is not on a lab's staff list gets "not found" for that lab's console. The lab's existence is not revealed to them.

## Set up a lab (administrator)

1. Open `/admin/labs`. Under "Create a lab" enter **Name**, **Department** (optional) and **People at a time** (capacity). Press Create lab.
2. The new lab starts **closed to bookings in practice**: it has no opening hours, so nothing can be booked. It starts with the unapproved default rules in the table below. It has no staff.
3. Open the lab's console from the list ("Open console").
4. Under **Head and assistants**, enter the head's email address, pick the role "Head", and press Add. The person must already have an account with a verified email. Otherwise you see "No active account has that email address. They need to sign up first." or "That person has not verified their email address yet."
5. Ask the head to check **Rules and details**, set **Opening hours**, and add **Closed dates**. Do not open the lab to members until the head has agreed the rules. [PLACEHOLDER: name of the person who gives that go-ahead]

Only an administrator can appoint or remove a head. Heads add and remove assistants.

### Warning: do not untick "Open for booking" unless an engineer can re-open the lab

In the lab's rules form, an administrator sees an "Open for booking" box. In the code, the lab console looks labs up by "active" labs only. A lab that is not open for booking therefore answers "not found" in its own console. The list screens still show it with a link, and that link also ends in "not found". I found no screen that re-opens a closed lab.

Treat that box as one-way until an engineer confirms otherwise. To stop new requests, use **Closed dates** or remove the lab's opening hours instead. Report this to engineering: [PLACEHOLDER: engineering contact]. This is a finding from reading the code. It has not been tried on a running system.

## The rules of a lab

Open the lab console, then **Rules and details**. Change a value and press **Save settings**. A change applies to **new requests only**. Bookings already made are not changed.

All "default" values below are the unapproved HD-16 recommendations. The "allowed" column is what the screen accepts.

| Setting (screen label) | Default (unapproved) | Allowed | What it does |
|---|---|---|---|
| People at a time | 1 on creation | 1 to 500 | The most people one booking can declare |
| Block length (minutes) | 60 | 15 to 480 | The size of one slot. Bookings are whole blocks. |
| Most blocks in a row | 3 | 1 to 24 | The longest single booking, in blocks |
| Minimum notice (minutes) | 240 (4 hours) | 0 to 43,200 | How far ahead a booking must start |
| Book up to (days ahead) | 14 | 1 to 365 | How far into the future people can book |
| Requests waiting, per person | 3 | 1 to 50 | How many undecided requests one person may hold in this lab |
| Hours per week, per person | 6 | 1 to 168 | A weekly cap per person in this lab (Monday to Sunday, India time) |
| Cancel up to (minutes before) | 120 (2 hours) | 0 to 20,160 | How late a member may cancel an approved booking |
| Who can book | Members who finished their profile | Finished profile, or any member with a verified email | Eligibility |
| An assistant must be assigned to approve | Off | On or off | When on, you cannot approve without choosing an assistant |

Also on this form: **Name**, **Department**, **About this lab**. An administrator also sees **Open for booking** (see the warning above).

Other things the system enforces for every lab, with no setting:

- A booking must start and end on the same day (India time).
- It must fit inside one opening window.
- It must start on a block boundary counted from the window's opening time.
- It must not overlap another live booking in the same lab. The database enforces this. Two people cannot both get one slot.
- The account must be active and have a verified email.

### Opening hours

1. In **Opening hours**, press **Add a window**. Choose the day, the opening time and the closing time.
2. You can add several windows on one day (for example a morning and an afternoon). They must not overlap.
3. Press **Save opening hours**. This replaces the whole weekly timetable.

Times are India Standard Time. A slot that does not fit entirely inside a window is not offered. For example, with 60-minute blocks, a window of 09:00 to 17:30 offers eight slots, and the last half hour is unused. The latest closing time the picker accepts is 23:59.

**Changing hours does not touch bookings already made.** If new hours no longer fit an approved booking, cancel it yourself and give a reason.

### Closed dates

Use these for exams, holidays and maintenance.

1. In **Closed dates**, enter **From**, optionally **To** (leave blank for one day), and a **Reason**.
2. Press **Close these dates**. Nothing can be booked on those dates.
3. To reopen a date, press **Remove** beside it.

Closing a date does not cancel bookings already approved for it. Cancel them yourself.

## Run the daily requests (head)

### Where requests arrive

A new request appears under **Requests waiting** in the lab console. The head gets a notice in the app and an email for each new request. Each request shows the member's name and email, the time, the headcount, the purpose and any equipment they named.

Only heads and administrators see this queue. Assistants do not.

### Decide a request

You have three choices on each request.

| Choice | What to do | What the member gets |
|---|---|---|
| **Approve** | Optionally choose an **Assistant**. If the lab requires one, you must. Press Approve. | A notice and an email that the booking is approved |
| **Decline...** | Type a reason (at least 3 characters). Press Send decision. | A notice and an email with your reason |
| **Suggest another time...** | Enter a new start and end in India time and an optional note. Press Send suggestion. | A notice and an email: "Nothing is booked until you accept." |

Notes:

- Every decision is recorded in the audit trail, with your name, in the same step as the change.
- If two heads decide the same request at once, the second sees "Someone else decided this request first. Reload to see its current state." Nothing is written twice.
- A suggested time must pass the same rules as a normal request (hours, closed dates, notice, block size). Otherwise you see "That alternative doesn't work" and the reason.
- The suggested time is **not held** for the member. The original request keeps holding its original slot until the member answers.
- If the member **accepts**, the booking becomes approved at the new time. If someone took that time in the meantime, the member is told, and must ask the lab for another time. If the member **declines**, the request is cancelled and the slot is freed. You get a notice that they declined.
- While you wait for the member, the request stays in **Requests waiting** with the line "Waiting for them to answer your suggestion".

### Requests nobody answers

**There is no automatic expiry and no reminder.** The HD-16 defaults mention an answer deadline of 2 working days and expiry at the slot's start. Those are discussion points, not features. In the code, a request you do not answer keeps its slot blocked until you answer it or the member cancels. Agree a house rule for how often heads check the queue: [PLACEHOLDER: agreed response time, set by the lab heads]

### Cancel an approved booking

1. Under **Approved and coming up**, find the booking. Press **Cancel this booking...**.
2. Type a reason (at least 3 characters). Press **Cancel and tell them**.
3. The member gets a notice and an email with your reason. The slot is freed.

Only heads and administrators can cancel for a member. A member cancelling their own approved booking must do it before the lab's cut-off time (default 2 hours before). After that they see a message to contact the lab, and you cancel it for them.

### Assistants

- Add an assistant under **Head and assistants** with their email address and the role "Assistant". They need a verified account.
- Assign an assistant when you approve. The assistant then sees that booking under "Your duties coming up" on `/dashboard/lab-staff`.
- The assigned assistant is shown on the approved booking.
- Any assistant of the lab can mark attendance for any approved booking in that lab, not only their own duties.

## Record attendance (assistant or head)

Attendance is recorded **by hand** and labelled "manual". No automatic check-in exists.

1. Open the lab console. Under **Approved and coming up**, find the booking.
2. Before the start time you see "Attendance can be recorded once it has started." After the start time you see two buttons.
3. Press **Mark attended** if the member came. The booking becomes "Attended".
4. Press **Mark no-show...** if they did not. Type a reason (at least 3 characters). Press **Record no-show**. The booking becomes "No-show".

Rules:

- You can record attendance once per booking. The booking must be approved and must have started.
- **There is no way in the screens to change or undo a recorded outcome.** Both outcomes are final in the code. HD-16 suggests that corrections need a reason. That correction path is not built. If you record the wrong outcome, tell engineering and the lab head and keep a note: [PLACEHOLDER: who handles corrections].
- Each record stores who marked it, when, and the reason. It also writes an audit row.
- Manual entries are counted separately in reports.
- The member is not notified when you mark attendance.
- HD-16 asks what to do about repeated no-shows (question 12). The system takes no action on no-shows. A head decides what to do. [PLACEHOLDER: the no-show rule once HD-16 is signed]

## Reports (head and administrator)

Open the report from the lab console ("Utilisation report for this lab"), or as an administrator from `/admin/labs/report`.

1. Choose **From** and **To** dates and press **Show**. The default range is the last 30 days up to today.
2. Press **Download as a spreadsheet** for a CSV file.

A head sees only their own labs. An administrator sees every lab. Assistants cannot open reports.

What the columns mean:

| Column | Meaning |
|---|---|
| Requests | Every booking whose start date is in the range, whatever its status |
| Approved | Bookings that were approved and not since cancelled or declined. This includes those later marked attended or no-show. |
| Rejected | Bookings declined |
| Cancelled | Bookings cancelled, including a suggestion the member declined |
| Attended | Bookings marked attended |
| No-shows | Bookings marked no-show |
| Hours booked | Hours of the approved bookings |
| Hours attended | Hours of the bookings marked attended |
| Manual entries | How many attendance records were entered by hand. Until QR exists, this equals the number of attendance records. |

Notes:

- A booking is counted in the range its **start** falls in, in India time.
- Figures come straight from the booking and attendance tables. Nothing is estimated. An engineer can reproduce any number with a query.
- A department table appears when there are two or more departments.
- The CSV neutralises cells that begin with `=`, `+`, `-` or `@`, so a spreadsheet does not run them as formulas.
- Approved bookings still in the future count as "Approved" but not yet as attended or no-show. Expect the totals to fill in as attendance is recorded.

## What people can see

| Person | Sees |
|---|---|
| Member | Free and busy slots by date (never who holds a slot), and their own bookings |
| Assistant | Booker name and email for approved and past bookings in their lab |
| Head | The same, plus the request queue |
| Administrator | Everything, in every lab |

`docs/delivery/LAB-BOOKING-DESIGN.md` says an assistant sees only their own upcoming duties. The code does not do that. The console shows an assistant **every** approved booking in the lab and its recent history, with booker name and email. Either the design text or the code must change. That is a decision for KNEST and the lab heads (HD-16).

HD-16 question 15 asks what booker data heads and assistants may see. It is unanswered. The console currently shows name and email to heads and assistants. The recommended default in HD-16 is: name, purpose and headcount for assistants, with email for the head only. If KNEST decides that, it is a code change. How long records are kept (HD-16 question 16, HD-06) is also undecided. [PLACEHOLDER: retention period set by KIIT legal]

## What the member sees and why it matters to you

- A member must be signed in, have a verified email, and (by default) have finished onboarding.
- They pick a date, pick consecutive free blocks, say what they will do (at least a few words, at most 500 characters), state the headcount and optionally the equipment, pass the human check, and submit.
- They see "Waiting for the lab head" until you decide.
- They are limited by the lab's rules for open requests and weekly hours, and by a rate limit of 20 requests per hour.
- If someone else just took the slot they see "Someone else just took that time. Pick another slot."

## Problems and what they mean

| Message | What it means | What to do |
|---|---|---|
| This lab needs an assistant assigned before a booking is approved. | The lab requires an assistant | Choose one in the Assistant list, then Approve |
| That person is not on this lab's staff. | You chose someone who is not in the lab's staff list | Add them under Head and assistants first |
| Someone else decided this request first. | A second head acted first | Reload |
| Give a short reason so the person knows why. | A reason of at least 3 characters is required to decline or cancel | Type a reason |
| Attendance can only be recorded for an approved booking that has not been closed. | The booking is not approved, or an outcome is already recorded | Check the booking's status |
| That booking has not started yet. | You tried to record attendance early | Wait until the start time |
| Only a lab administrator can appoint a head. | You are a head, not an administrator | Ask an administrator |
| No active account has that email address. | The person has not signed up | Ask them to sign up and verify their email |
| A lab you expect does not appear | You are not on its staff list, or it is closed | Ask an administrator |
| Everything in the lab area says "not found" | Lab booking is switched off | Expected until HD-16 is signed. Ask: [PLACEHOLDER: engineering contact] |

## If something fails at the lab

The contract treats a failure at the lab door as a priority-1 incident (HD-16 question 18). Booking and attendance are not connected to any door. Who answers during opening hours and after them is undecided. [PLACEHOLDER: named support contact per lab during opening hours] [PLACEHOLDER: KNEST support contact after hours]

## Before you switch booking on: a checklist for people

- [ ] HD-16 is answered and signed by KNEST and the lab heads
- [ ] Each pilot lab's rules were set to the values the head agreed
- [ ] Each pilot lab has hours and, if needed, closed dates
- [ ] Each head and assistant has a verified account and has finished onboarding
- [ ] The privacy notice is approved (HD-06)
- [ ] Heads agreed a response time for requests
- [ ] The support contacts above are filled in
- [ ] Engineering has turned on `FEATURE_LAB_BOOKING` and confirmed it with a test booking on the real site
